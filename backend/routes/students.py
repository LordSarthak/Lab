from flask import Blueprint, request, jsonify, current_app
from bson import ObjectId
import re
from utils.import_data import load_import_rows

students_bp = Blueprint("students", __name__)

def serialize(student):
    student["_id"] = str(student["_id"])
    return student

def get_collection():
    return current_app.config["DB"]["students"]

def duplicate_email(email, student_id=None):
    query = {"email": {"$regex": f"^{re.escape(email)}$", "$options": "i"}}
    if student_id:
        query["_id"] = {"$ne": ObjectId(student_id)}
    return get_collection().find_one(query) is not None

def duplicate_roll_number(roll_number, student_id=None):
    query = {"rollNumber": {"$regex": f"^{re.escape(roll_number)}$", "$options": "i"}}
    if student_id:
        query["_id"] = {"$ne": ObjectId(student_id)}
    return get_collection().find_one(query) is not None

def validate_course_assignment(course_name, department):
    if not course_name:
        return "", None
    if not isinstance(course_name, str):
        return None, "Course must be selected from the course list."

    course = current_app.config["DB"]["courses"].find_one({
        "name": {"$regex": f"^{re.escape(course_name.strip())}$", "$options": "i"}
    })
    if not course:
        return None, "Choose a course from the course list."
    if course["department"].casefold() != department.strip().casefold():
        return None, "The selected course does not belong to the selected department."
    return course["name"], None

def validate_student_data(data, existing_student=None):
    if not isinstance(data, dict):
        return None, "Student details must be an object."

    name = data.get("name")
    email = data.get("email")
    roll_number = data.get("rollNumber")
    department = data.get("department")
    if not isinstance(name, str) or not name.strip():
        return None, "Student name is required."
    if not isinstance(email, str) or not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email.strip()):
        return None, "Enter a valid email address."
    if isinstance(roll_number, bool) or not isinstance(roll_number, (str, int)) or not str(roll_number).strip():
        return None, "Roll number is required."
    if not isinstance(department, str) or not department.strip():
        return None, "Department is required."
    selected_department = current_app.config["DB"]["departments"].find_one({
        "name": {"$regex": f"^{re.escape(department.strip())}$", "$options": "i"}
    })
    is_unchanged_legacy_department = (
        existing_student
        and not selected_department
        and department.strip().casefold() == existing_student.get("department", "").strip().casefold()
    )
    if not selected_department and not is_unchanged_legacy_department:
        return None, "Choose a department from the department list."
    department_name = selected_department["name"] if selected_department else existing_student["department"]
    course_value = data.get("course")
    if not isinstance(course_value, str) or not course_value.strip():
        return None, "Choose a course from the selected department."
    course, error = validate_course_assignment(course_value, department_name)
    is_unchanged_legacy_course = (
        existing_student
        and not course
        and course_value.strip().casefold() == existing_student.get("course", "").strip().casefold()
        and department_name.casefold() == existing_student.get("department", "").strip().casefold()
    )
    if error and is_unchanged_legacy_course:
        course, error = existing_student["course"], None
    if error:
        return None, error

    return {
        "name": name.strip(),
        "email": email.strip(),
        "rollNumber": str(roll_number).strip(),
        "department": department_name,
        "course": course,
    }, None

@students_bp.route("/", methods=["GET"])
def get_students():
    return jsonify([serialize(s) for s in get_collection().find()])

@students_bp.route("/import", methods=["POST"])
def import_students():
    upload = request.files.get("file")
    if upload is None or not upload.filename:
        return jsonify({"message": "Choose a file to import."}), 400
    try:
        rows, ignored_columns = load_import_rows(upload, "students")
    except ValueError as error:
        return jsonify({"message": str(error)}), 400

    collection = get_collection()
    imported = 0
    errors = []
    seen_roll_numbers = set()
    seen_emails = set()
    for item in rows:
        student = item["data"]
        name = student["name"]
        email = student["email"]
        roll_number = student["rollNumber"]
        department = student["department"]
        reason = None
        course_name = student.get("course", "").strip()
        if not all((name, email, roll_number, department, course_name)):
            reason = "Name, email, roll number, department, and course are required."
        elif not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email):
            reason = "Invalid email address."
        elif not (selected_department := current_app.config["DB"]["departments"].find_one({
            "name": {"$regex": f"^{re.escape(department)}$", "$options": "i"}
        })):
            reason = "Choose a department from the department list."
        elif validate_course_assignment(course_name, selected_department["name"])[1]:
            reason = validate_course_assignment(course_name, selected_department["name"])[1]
        elif roll_number.lower() in seen_roll_numbers or collection.find_one({"rollNumber": {"$regex": f"^{re.escape(roll_number)}$", "$options": "i"}}):
            reason = "Roll number already exists."
        elif email.lower() in seen_emails or duplicate_email(email):
            reason = "Email address already exists."

        if reason:
            errors.append({"row": item["row"], "reason": reason})
            continue

        student["department"] = selected_department["name"]
        student["course"], _ = validate_course_assignment(course_name, student["department"])
        collection.insert_one(student)
        seen_roll_numbers.add(roll_number.lower())
        seen_emails.add(email.lower())
        imported += 1

    return jsonify({
        "totalRows": len(rows),
        "imported": imported,
        "skipped": len(errors),
        "errors": errors,
        "ignoredColumns": ignored_columns,
    })

@students_bp.route("/", methods=["POST"])
def add_student():
    data, error = validate_student_data(request.get_json(silent=True))
    if error:
        return jsonify({"message": error}), 400
    if duplicate_email(data["email"]):
        return jsonify({"message": "A student with this email address already exists."}), 409
    if duplicate_roll_number(data["rollNumber"]):
        return jsonify({"message": "A student with this roll number already exists."}), 409
    result = get_collection().insert_one(data)
    return jsonify({"_id": str(result.inserted_id)})

@students_bp.route("/<id>", methods=["PUT"])
def update_student(id):
    try:
        student_id = ObjectId(id)
    except Exception:
        return jsonify({"message": "Invalid student ID."}), 400
    existing_student = get_collection().find_one({"_id": student_id})
    if not existing_student:
        return jsonify({"message": "Student not found."}), 404
    data, error = validate_student_data(request.get_json(silent=True), existing_student)
    if error:
        return jsonify({"message": error}), 400
    if duplicate_email(data["email"], student_id):
        return jsonify({"message": "A student with this email address already exists."}), 409
    if duplicate_roll_number(data["rollNumber"], student_id):
        return jsonify({"message": "A student with this roll number already exists."}), 409
    get_collection().update_one({"_id": student_id}, {"$set": data})
    return jsonify({"message": "Student updated"})

@students_bp.route("/<id>", methods=["DELETE"])
def delete_student(id):
    try:
        student_id = ObjectId(id)
    except Exception:
        return jsonify({"message": "Invalid student ID."}), 400
    result = get_collection().delete_one({"_id": student_id})
    if not result.deleted_count:
        return jsonify({"message": "Student not found."}), 404
    return jsonify({"message": "Student deleted"})
