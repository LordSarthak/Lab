import re

from bson import ObjectId
from flask import Blueprint, current_app, jsonify, request

from utils.import_data import load_import_rows


departments_bp = Blueprint("departments", __name__)


def get_collection():
    return current_app.config["DB"]["departments"]


def serialize(department):
    department["_id"] = str(department["_id"])
    return department


def validate_department(data):
    if not isinstance(data, dict):
        return None, "Department details must be an object."

    name = data.get("name")
    code = data.get("code")
    description = data.get("description", "")
    if not isinstance(name, str) or not name.strip():
        return None, "Department name is required."
    if not isinstance(code, str) or not code.strip():
        return None, "Department code is required."
    if not isinstance(description, str):
        return None, "Description must be text."

    return {
        "name": name.strip(),
        "code": code.strip().upper(),
        "description": description.strip(),
    }, None


def duplicate(field, value, department_id=None):
    query = {field: {"$regex": f"^{re.escape(value)}$", "$options": "i"}}
    if department_id:
        query["_id"] = {"$ne": ObjectId(department_id)}
    return get_collection().find_one(query) is not None


@departments_bp.route("/", methods=["GET"])
def get_departments():
    return jsonify([serialize(department) for department in get_collection().find().sort("name", 1)])


@departments_bp.route("/import", methods=["POST"])
def import_departments():
    upload = request.files.get("file")
    if upload is None or not upload.filename:
        return jsonify({"message": "Choose a file to import."}), 400
    try:
        rows, ignored_columns = load_import_rows(upload, "departments")
    except ValueError as error:
        return jsonify({"message": str(error)}), 400

    imported = 0
    errors = []
    seen_names = set()
    seen_codes = set()
    for item in rows:
        department, reason = validate_department(item["data"])
        if not reason:
            name_key = department["name"].casefold()
            code_key = department["code"].casefold()
            if name_key in seen_names or duplicate("name", department["name"]):
                reason = "A department with this name already exists."
            elif code_key in seen_codes or duplicate("code", department["code"]):
                reason = "A department with this code already exists."

        if reason:
            errors.append({"row": item["row"], "reason": reason})
            continue

        get_collection().insert_one(department)
        seen_names.add(department["name"].casefold())
        seen_codes.add(department["code"].casefold())
        imported += 1

    return jsonify({
        "totalRows": len(rows),
        "imported": imported,
        "skipped": len(errors),
        "errors": errors,
        "ignoredColumns": ignored_columns,
    })


@departments_bp.route("/", methods=["POST"])
def create_department():
    department, error = validate_department(request.get_json(silent=True))
    if error:
        return jsonify({"message": error}), 400
    if duplicate("name", department["name"]):
        return jsonify({"message": "A department with this name already exists."}), 409
    if duplicate("code", department["code"]):
        return jsonify({"message": "A department with this code already exists."}), 409
    result = get_collection().insert_one(department)
    return jsonify({"_id": str(result.inserted_id)})


@departments_bp.route("/<id>", methods=["PUT"])
def update_department(id):
    department, error = validate_department(request.get_json(silent=True))
    if error:
        return jsonify({"message": error}), 400
    try:
        department_id = ObjectId(id)
    except Exception:
        return jsonify({"message": "Invalid department ID."}), 400

    existing = get_collection().find_one({"_id": department_id})
    if not existing:
        return jsonify({"message": "Department not found."}), 404
    if duplicate("name", department["name"], department_id):
        return jsonify({"message": "A department with this name already exists."}), 409
    if duplicate("code", department["code"], department_id):
        return jsonify({"message": "A department with this code already exists."}), 409

    get_collection().update_one({"_id": department_id}, {"$set": department})
    if existing["name"].casefold() != department["name"].casefold():
        current_app.config["DB"]["courses"].update_many(
            {"department": existing["name"]},
            {"$set": {"department": department["name"]}},
        )
        current_app.config["DB"]["students"].update_many(
            {"department": existing["name"]},
            {"$set": {"department": department["name"]}},
        )
        current_app.config["DB"]["bookings"].update_many(
            {"department": existing["name"]},
            {"$set": {"department": department["name"]}},
        )
    return jsonify({"message": "Department updated"})


@departments_bp.route("/<id>", methods=["DELETE"])
def delete_department(id):
    try:
        department_id = ObjectId(id)
    except Exception:
        return jsonify({"message": "Invalid department ID."}), 400

    department = get_collection().find_one({"_id": department_id})
    if not department:
        return jsonify({"message": "Department not found."}), 404
    department_name = {"$regex": f"^{re.escape(department['name'])}$", "$options": "i"}
    if (
        current_app.config["DB"]["courses"].find_one({"department": department_name})
        or current_app.config["DB"]["students"].find_one({"department": department_name})
        or current_app.config["DB"]["bookings"].find_one({"department": department_name})
    ):
        return jsonify({"message": "Reassign or delete this department's courses, students, and bookings before deleting it."}), 409

    get_collection().delete_one({"_id": department_id})
    return jsonify({"message": "Department deleted"})