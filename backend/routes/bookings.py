from flask import Blueprint, request, jsonify, current_app
from bson import ObjectId
from datetime import datetime, time, timedelta, timezone
import re

bookings_bp = Blueprint("bookings", __name__)
LOCAL_TIMEZONE = timezone(timedelta(hours=5, minutes=30))

def get_collection():
    return current_app.config["DB"]["bookings"]

def serialize(booking):
    booking["_id"] = str(booking["_id"])
    return booking

def validate_booking(data, booking_id=None):
    try:
        title = data["title"].strip()
        start = datetime.fromisoformat(data["start"].replace("Z", "+00:00"))
        end = datetime.fromisoformat(data["end"].replace("Z", "+00:00"))
        start = start.replace(tzinfo=LOCAL_TIMEZONE) if start.tzinfo is None else start.astimezone(LOCAL_TIMEZONE)
        end = end.replace(tzinfo=LOCAL_TIMEZONE) if end.tzinfo is None else end.astimezone(LOCAL_TIMEZONE)
        seat_value = data.get("seats", 1)
        if isinstance(seat_value, bool):
            raise ValueError("Seat count must be a whole number.")
        numeric_seats = float(seat_value)
        if not numeric_seats.is_integer():
            raise ValueError("Seat count must be a whole number.")
        seats = int(numeric_seats)
    except (AttributeError, KeyError, TypeError, ValueError):
        return None, (jsonify({"error": "Provide a lab, valid start and end times, and a positive seat count."}), 400)

    duration = (end - start).total_seconds() / 60
    if (
        not title
        or end <= start
        or seats < 1
        or duration not in (60, 90)
        or start.date() != end.date()
        or start.time().replace(tzinfo=None) < time(9)
        or end.time().replace(tzinfo=None) > time(16)
    ):
        return None, (jsonify({"error": "Choose a lab, a valid time range, and at least one seat."}), 400)

    lab = current_app.config["DB"]["labs"].find_one({"name": title})
    if not lab:
        return None, (jsonify({"error": "Choose a lab from the lab directory."}), 400)

    department_name = data.get("department", "")
    course_name = data.get("course", "")
    if not isinstance(department_name, str) or not isinstance(course_name, str):
        return None, (jsonify({"error": "Department and course must be selected from the catalog."}), 400)
    department_name = department_name.strip()
    course_name = course_name.strip()
    department = None
    course = None

    if department_name:
        department = current_app.config["DB"]["departments"].find_one({
            "name": {"$regex": f"^{re.escape(department_name)}$", "$options": "i"}
        })
        if not department:
            return None, (jsonify({"error": "Choose a department from the department list."}), 400)
    if course_name:
        if not department:
            return None, (jsonify({"error": "Choose a department before selecting a course."}), 400)
        course = current_app.config["DB"]["courses"].find_one({
            "name": {"$regex": f"^{re.escape(course_name)}$", "$options": "i"},
            "department": department["name"],
        })
        if not course:
            return None, (jsonify({"error": "Choose a course from the selected department."}), 400)

    capacity = int(lab.get("equipmentCount", 0) or 0)
    occupied = lab.get("occupiedSeats")
    if occupied is None:
        occupied = capacity if lab.get("status") == "Occupied" else 0
    available_capacity = capacity - int(occupied or 0)

    overlap_query = {
        "title": title,
        "start": {"$lt": end},
        "end": {"$gt": start},
    }
    if booking_id:
        overlap_query["_id"] = {"$ne": ObjectId(booking_id)}

    existing = list(get_collection().find(overlap_query))
    already_booked = sum(int(booking.get("seats", 1) or 1) for booking in existing)
    seats_left = max(0, available_capacity - already_booked)
    if seats > seats_left:
        return None, (jsonify({
            "error": f"Only {seats_left} seat(s) remain in {title} for that time period.",
            "availableSeats": seats_left,
        }), 409)

    booking = {"title": title, "start": start, "end": end, "seats": seats}
    if "department" in data:
        booking["department"] = department["name"] if department else ""
    if "course" in data:
        booking["course"] = course["name"] if course else ""
    return booking, None

@bookings_bp.route("/", methods=["GET"])
def get_bookings():
    bookings = list(get_collection().find())
    return jsonify([serialize(b) for b in bookings])

@bookings_bp.route("/", methods=["POST"])
def create_booking():
    booking, error = validate_booking(request.get_json(silent=True) or {})
    if error:
        return error
    result = get_collection().insert_one(booking)
    return jsonify({"_id": str(result.inserted_id)}), 201

@bookings_bp.route("/<id>", methods=["PUT"])
def update_booking(id):
    try:
        booking_id = ObjectId(id)
    except Exception:
        return jsonify({"error": "Invalid booking ID."}), 400
    if not get_collection().find_one({"_id": booking_id}):
        return jsonify({"error": "Booking not found."}), 404
    updated, error = validate_booking(request.get_json(silent=True) or {}, booking_id)
    if error:
        return error
    get_collection().update_one({"_id": booking_id}, {"$set": updated})
    return jsonify({"message": "Booking updated"})

@bookings_bp.route("/<id>", methods=["DELETE"])
def delete_booking(id):
    try:
        booking_id = ObjectId(id)
    except Exception:
        return jsonify({"error": "Invalid booking ID."}), 400
    result = get_collection().delete_one({"_id": booking_id})
    if not result.deleted_count:
        return jsonify({"error": "Booking not found."}), 404
    return jsonify({"message": "Booking deleted"})
