import math
import re

from bson import ObjectId
from flask import Blueprint, current_app, jsonify, request

from utils.import_data import load_import_rows


courses_bp = Blueprint("courses", __name__)


def get_collection():
    return current_app.config["DB"]["courses"]


def serialize(course):
    course["_id"] = str(course["_id"])
    return course


def validate_course(data):
    if not isinstance(data, dict):
        return None, "Course details must be an object."

    name = data.get("name")
    code = data.get("code")
    department = data.get("department")
    credits = data.get("credits")
    if not isinstance(name, str) or not name.strip():
        return None, "Course name is required."
    if not isinstance(code, str) or not code.strip():
        return None, "Course code is required."
    if not isinstance(department, str) or not department.strip():
        return None, "Choose a department."
    if isinstance(credits, bool):
        return None, "Credits must be a positive number."
    try:
        credits = float(credits)
    except (TypeError, ValueError, OverflowError):
        return None, "Credits must be a positive number."
    if not math.isfinite(credits) or credits <= 0:
        return None, "Credits must be a positive number."

    department_record = current_app.config["DB"]["departments"].find_one({
        "name": {"$regex": f"^{re.escape(department.strip())}$", "$options": "i"}
    })
    if not department_record:
        return None, "Choose a department from the department list."

    return {
        "name": name.strip(),
        "code": code.strip().upper(),
        "department": department_record["name"],
        "credits": int(credits) if credits.is_integer() else credits,
    }, None


def duplicate(field, value, course_id=None):
    query = {field: {"$regex": f"^{re.escape(value)}$", "$options": "i"}}
    if course_id:
        query["_id"] = {"$ne": ObjectId(course_id)}
    return get_collection().find_one(query) is not None


@courses_bp.route("/", methods=["GET"])
def get_courses():
    return jsonify([serialize(course) for course in get_collection().find().sort("name", 1)])


@courses_bp.route("/import", methods=["POST"])
def import_courses():
    upload = request.files.get("file")
    if upload is None or not upload.filename:
        return jsonify({"message": "Choose a file to import."}), 400
    try:
        rows, ignored_columns = load_import_rows(upload, "courses")
    except ValueError as error:
        return jsonify({"message": str(error)}), 400

    imported = 0
    errors = []
    seen_codes = set()
    for item in rows:
        course, reason = validate_course(item["data"])
        if not reason:
            code_key = course["code"].casefold()
            if code_key in seen_codes or duplicate("code", course["code"]):
                reason = "A course with this code already exists."
            elif duplicate("name", course["name"]):
                reason = "A course with this name already exists."

        if reason:
            errors.append({"row": item["row"], "reason": reason})
            continue

        get_collection().insert_one(course)
        seen_codes.add(course["code"].casefold())
        imported += 1

    return jsonify({
        "totalRows": len(rows),
        "imported": imported,
        "skipped": len(errors),
        "errors": errors,
        "ignoredColumns": ignored_columns,
    })


@courses_bp.route("/", methods=["POST"])
def create_course():
    course, error = validate_course(request.get_json(silent=True))
    if error:
        return jsonify({"message": error}), 400
    if duplicate("code", course["code"]):
        return jsonify({"message": "A course with this code already exists."}), 409
    if duplicate("name", course["name"]):
        return jsonify({"message": "A course with this name already exists."}), 409
    result = get_collection().insert_one(course)
    return jsonify({"_id": str(result.inserted_id)})


@courses_bp.route("/<id>", methods=["PUT"])
def update_course(id):
    course, error = validate_course(request.get_json(silent=True))
    if error:
        return jsonify({"message": error}), 400
    try:
        course_id = ObjectId(id)
    except Exception:
        return jsonify({"message": "Invalid course ID."}), 400
    if not get_collection().find_one({"_id": course_id}):
        return jsonify({"message": "Course not found."}), 404
    if duplicate("code", course["code"], course_id):
        return jsonify({"message": "A course with this code already exists."}), 409
    if duplicate("name", course["name"], course_id):
        return jsonify({"message": "A course with this name already exists."}), 409

    existing = get_collection().find_one({"_id": course_id})
    get_collection().update_one({"_id": course_id}, {"$set": course})
    if existing["name"].casefold() != course["name"].casefold() or existing["department"].casefold() != course["department"].casefold():
        current_app.config["DB"]["students"].update_many(
            {"course": existing["name"]},
            {"$set": {"course": course["name"], "department": course["department"]}},
        )
        current_app.config["DB"]["bookings"].update_many(
            {"course": existing["name"]},
            {"$set": {"course": course["name"], "department": course["department"]}},
        )
    return jsonify({"message": "Course updated"})


@courses_bp.route("/<id>", methods=["DELETE"])
def delete_course(id):
    try:
        course_id = ObjectId(id)
    except Exception:
        return jsonify({"message": "Invalid course ID."}), 400
    course = get_collection().find_one({"_id": course_id})
    if not course:
        return jsonify({"message": "Course not found."}), 404
    if current_app.config["DB"]["students"].find_one({
        "course": {"$regex": f"^{re.escape(course['name'])}$", "$options": "i"}
    }) or current_app.config["DB"]["bookings"].find_one({
        "course": {"$regex": f"^{re.escape(course['name'])}$", "$options": "i"}
    }):
        return jsonify({"message": "Reassign or delete this course's students and bookings before deleting it."}), 409
    result = get_collection().delete_one({"_id": course_id})
    if not result.deleted_count:
        return jsonify({"message": "Course not found."}), 404
    return jsonify({"message": "Course deleted"})