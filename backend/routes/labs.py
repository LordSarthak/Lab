from flask import Blueprint, request, jsonify, current_app
from bson import ObjectId
import re
from utils.import_data import load_import_rows
from utils.booking_locks import BookingLockTimeout, acquire_booking_locks, lab_lock_key

labs_bp = Blueprint("labs", __name__)

def get_collection():
    return current_app.config["DB"]["labs"]

def serialize(lab):
    lab["_id"] = str(lab["_id"])
    return lab

def validate_lab_data(data):
    if not isinstance(data, dict):
        return None, "Lab details must be an object."

    name = data.get("name")
    status = data.get("status")
    if not isinstance(name, str) or not name.strip():
        return None, "Enter a lab name."
    if status not in {"Available", "Occupied"}:
        return None, "Choose a valid lab status."

    def whole_number(value):
        if isinstance(value, bool):
            return None
        try:
            number = int(value)
            return number if float(value) == number else None
        except (TypeError, ValueError, OverflowError):
            return None

    equipment_count = whole_number(data.get("equipmentCount"))
    if equipment_count is None or equipment_count < 0:
        return None, "Number of computers must be a whole number of zero or more."
    occupied_value = data.get("occupiedSeats")
    if occupied_value is None:
        occupied_value = equipment_count if status == "Occupied" else 0
    occupied_seats = whole_number(occupied_value)
    if occupied_seats is None or occupied_seats < 0:
        return None, "Occupied seats must be a whole number of zero or more."
    if occupied_seats > equipment_count:
        return None, "Occupied seats cannot exceed the number of computers."

    software = data.get("software", [])
    if not isinstance(software, list) or any(not isinstance(item, str) for item in software):
        return None, "Installed software must be a list of names."

    return {
        "name": name.strip(),
        "equipmentCount": equipment_count,
        "occupiedSeats": occupied_seats,
        "status": status,
        "software": software,
    }, None

@labs_bp.route("/", methods=["GET"])
def get_labs():
    labs = list(get_collection().find())
    return jsonify([serialize(lab) for lab in labs])

@labs_bp.route("/import", methods=["POST"])
def import_labs():
    upload = request.files.get("file")
    if upload is None or not upload.filename:
        return jsonify({"message": "Choose a file to import."}), 400
    try:
        rows, ignored_columns = load_import_rows(upload, "labs")
    except ValueError as error:
        return jsonify({"message": str(error)}), 400

    collection = get_collection()
    imported = 0
    errors = []
    seen_names = set()
    for item in rows:
        row = item["data"]
        name = row["name"]
        occupied_value = row.get("occupiedSeats", "").strip()
        try:
            equipment_count = int(row["equipmentCount"])
            occupied_seats = int(occupied_value or 0)
        except ValueError:
            errors.append({"row": item["row"], "reason": "Computer and occupied-seat counts must be whole numbers."})
            continue

        if not name:
            reason = "Lab name is required."
        elif equipment_count < 0 or occupied_seats < 0:
            reason = "Counts cannot be negative."
        elif occupied_seats > equipment_count:
            reason = "Occupied seats cannot exceed the computer count."
        elif name.casefold() in seen_names or collection.find_one({"name": {"$regex": f"^{re.escape(name)}$", "$options": "i"}}):
            reason = "A lab with this name already exists."
        else:
            reason = None

        if reason:
            errors.append({"row": item["row"], "reason": reason})
            continue

        status_value = row.get("status", "").strip().casefold()
        if status_value in {"occupied", "busy", "in use", "in-use"}:
            status = "Occupied"
        elif status_value in {"", "available", "vacant", "free"}:
            status = "Occupied" if equipment_count and occupied_seats == equipment_count else "Available"
        else:
            errors.append({"row": item["row"], "reason": "Status must be Available or Occupied."})
            continue
        if status == "Occupied" and not occupied_value:
            occupied_seats = equipment_count

        software_value = row.get("software", "")
        software = [value.strip() for value in re.split(r"[,;|\n]", software_value) if value.strip()]
        collection.insert_one({
            "name": name,
            "equipmentCount": equipment_count,
            "occupiedSeats": occupied_seats,
            "status": status,
            "software": software,
        })
        seen_names.add(name.casefold())
        imported += 1

    return jsonify({
        "totalRows": len(rows),
        "imported": imported,
        "skipped": len(errors),
        "errors": errors,
        "ignoredColumns": ignored_columns,
    })

@labs_bp.route("/", methods=["POST"])
def create_lab():
    lab, error = validate_lab_data(request.get_json(silent=True))
    if error:
        return jsonify({"message": error}), 400
    if get_collection().find_one({"name": {"$regex": f"^{re.escape(lab['name'])}$", "$options": "i"}}):
        return jsonify({"message": "A lab with this name already exists."}), 409
    result = get_collection().insert_one(lab)
    return jsonify({"_id": str(result.inserted_id)})

@labs_bp.route("/<id>", methods=["PUT"])
def update_lab(id):
    data, error = validate_lab_data(request.get_json(silent=True))
    if error:
        return jsonify({"message": error}), 400
    try:
        object_id = ObjectId(id)
    except Exception:
        return jsonify({"message": "Invalid lab ID."}), 400
    existing = get_collection().find_one({"_id": object_id})
    if not existing:
        return jsonify({"message": "Lab not found."}), 404
    keys = {lab_lock_key(existing["name"]), lab_lock_key(data["name"])}
    try:
        with acquire_booking_locks(keys):
            existing = get_collection().find_one({"_id": object_id})
            if not existing:
                return jsonify({"message": "Lab not found."}), 404
            duplicate = get_collection().find_one({
                "name": {"$regex": f"^{re.escape(data['name'])}$", "$options": "i"},
                "_id": {"$ne": object_id},
            })
            if duplicate:
                return jsonify({"message": "A lab with this name already exists."}), 409
            result = get_collection().update_one({"_id": object_id}, {"$set": data})
            if not result.matched_count:
                return jsonify({"message": "Lab not found."}), 404
            if existing["name"] != data["name"]:
                current_app.config["DB"]["bookings"].update_many(
                    {"title": existing["name"]},
                    {"$set": {"title": data["name"]}},
                )
            return jsonify({"message": "Lab updated"})
    except BookingLockTimeout:
        return jsonify({"message": "This lab has active booking changes. Please retry shortly."}), 409


@labs_bp.route("/<id>", methods=["DELETE"])
def delete_lab(id):
    try:
        object_id = ObjectId(id)
    except Exception:
        return jsonify({"message": "Invalid lab ID."}), 400
    lab = get_collection().find_one({"_id": object_id})
    if not lab:
        return jsonify({"message": "Lab not found."}), 404
    try:
        with acquire_booking_locks({lab_lock_key(lab["name"])}):
            lab = get_collection().find_one({"_id": object_id})
            if not lab:
                return jsonify({"message": "Lab not found."}), 404
            if current_app.config["DB"]["bookings"].find_one({"title": lab["name"]}):
                return jsonify({"message": "Reassign or delete this lab's bookings before deleting it."}), 409
            result = get_collection().delete_one({"_id": object_id})
            if not result.deleted_count:
                return jsonify({"message": "Lab not found."}), 404
            return jsonify({"message": "Lab deleted"})
    except BookingLockTimeout:
        return jsonify({"message": "This lab has active booking changes. Please retry shortly."}), 409
