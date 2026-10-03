from bson import ObjectId
from datetime import datetime, timedelta, timezone
import re

from flask import Blueprint, current_app, jsonify, request
from pymongo.errors import PyMongoError

from routes.timetable import get_settings
from utils.booking_locks import (
    BookingLockTimeout,
    acquire_booking_locks,
    booking_lock_keys,
)

bookings_bp = Blueprint("bookings", __name__)
LOCAL_TIMEZONE = timezone(timedelta(hours=5, minutes=30))


def get_collection():
    return current_app.config["DB"]["bookings"]


def serialize(booking):
    booking["_id"] = str(booking["_id"])
    return booking


def normalize_stored_datetime(value):
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(LOCAL_TIMEZONE)


def parse_local_datetime(value):
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return parsed.replace(tzinfo=LOCAL_TIMEZONE) if parsed.tzinfo is None else parsed.astimezone(LOCAL_TIMEZONE)


def lock_keys_for_booking(data):
    if not isinstance(data, dict) or not isinstance(data.get("title"), str):
        return set()
    try:
        start = parse_local_datetime(data["start"])
    except (AttributeError, TypeError, ValueError):
        return set()
    return booking_lock_keys(data["title"], start)


def lock_keys_for_existing_booking(booking):
    return booking_lock_keys(booking["title"], normalize_stored_datetime(booking["start"]))


def available_lab_capacity(lab):
    capacity = int(lab.get("equipmentCount", 0) or 0)
    occupied = lab.get("occupiedSeats")
    if occupied is None:
        occupied = capacity if lab.get("status") == "Occupied" else 0
    return capacity - int(occupied or 0)


def booking_changed(current, original):
    return (
        current.get("title") != original.get("title")
        or normalize_stored_datetime(current["start"])
        != normalize_stored_datetime(original["start"])
    )


def capacity_lock_error():
    return jsonify({"error": "This lab's capacity is being updated. Please retry shortly."}), 409


def validate_batch_capacity(bookings):
    bookings_by_title = {}
    for booking in bookings:
        bookings_by_title.setdefault(booking["title"], []).append(booking)

    for title, lab_bookings in bookings_by_title.items():
        lab = current_app.config["DB"]["labs"].find_one({"name": title})
        capacity = available_lab_capacity(lab)
        first_start = min(booking["start"] for booking in lab_bookings)
        last_end = max(booking["end"] for booking in lab_bookings)
        existing_bookings = list(get_collection().find({
            "title": title,
            "start": {"$lt": last_end},
            "end": {"$gt": first_start},
        }))
        existing_intervals = [
            (
                normalize_stored_datetime(booking["start"]),
                normalize_stored_datetime(booking["end"]),
                int(booking.get("seats", 1) or 1),
            )
            for booking in existing_bookings
        ]
        points = {
            point
            for booking in lab_bookings
            for point in (booking["start"], booking["end"])
        }
        points.update(
            point
            for start, end, _seats in existing_intervals
            for point in (start, end)
            if first_start < point < last_end
        )
        ordered_points = sorted(points)
        for start, end in zip(ordered_points, ordered_points[1:]):
            midpoint = start + (end - start) / 2
            requested = sum(
                booking["seats"]
                for booking in lab_bookings
                if booking["start"] <= midpoint < booking["end"]
            )
            if not requested:
                continue
            already_booked = sum(
                seats for existing_start, existing_end, seats in existing_intervals
                if existing_start <= midpoint < existing_end
            )
            seats_left = max(0, capacity - already_booked)
            if requested > seats_left:
                return jsonify({
                    "error": f"Only {seats_left} seat(s) remain in {title} for that time period.",
                    "availableSeats": seats_left,
                }), 409
    return None


def validate_booking(data, booking_id=None):
    try:
        title = data["title"].strip()
        start = parse_local_datetime(data["start"])
        end = parse_local_datetime(data["end"])
        seat_value = data.get("seats", 1)
        if isinstance(seat_value, bool):
            raise ValueError("Seat count must be a whole number.")
        numeric_seats = float(seat_value)
        if not numeric_seats.is_integer():
            raise ValueError("Seat count must be a whole number.")
        seats = int(numeric_seats)
    except (AttributeError, KeyError, TypeError, ValueError):
        return None, (jsonify({"error": "Provide a lab, valid start and end times, and a positive seat count."}), 400)

    timetable_settings = get_settings()
    start_time = start.strftime("%H:%M")
    end_time = end.strftime("%H:%M")
    matching_slot = any(
        slot["enabled"] and slot["startTime"] == start_time and slot["endTime"] == end_time
        for slot in timetable_settings["slots"]
    )
    existing_booking = get_collection().find_one({"_id": booking_id}) if booking_id else None
    existing_start = existing_booking.get("start") if existing_booking else None
    existing_end = existing_booking.get("end") if existing_booking else None
    if existing_start and existing_end:
        existing_start = normalize_stored_datetime(existing_start)
        existing_end = normalize_stored_datetime(existing_end)
        is_unchanged_interval = (
            existing_start == start
            and existing_end == end
        )
    else:
        is_unchanged_interval = False
    duration = (end - start).total_seconds() / 60
    if (
        not title
        or end <= start
        or seats < 1
        or not duration.is_integer()
        or not 1 <= duration <= 480
        or start.date() != end.date()
        or start.second != 0
        or start.microsecond != 0
        or end.second != 0
        or end.microsecond != 0
        or not (matching_slot or is_unchanged_interval)
    ):
        return None, (jsonify({"error": "Choose one of the enabled timetable intervals and a positive seat count."}), 400)

    lab = current_app.config["DB"]["labs"].find_one({"name": title})
    if not lab:
        return None, (jsonify({"error": "Choose a lab from the lab directory."}), 400)

    department_name = data.get("department", "")
    course_name = data.get("course", "")
    if not isinstance(department_name, str) or not department_name.strip():
        return None, (jsonify({"error": "Choose a department from the department list."}), 400)
    if not isinstance(course_name, str) or not course_name.strip():
        return None, (jsonify({"error": "Choose a course from the selected department."}), 400)
    department_name = department_name.strip()
    course_name = course_name.strip()
    department = None
    course = None

    department = current_app.config["DB"]["departments"].find_one({
        "name": {"$regex": f"^{re.escape(department_name)}$", "$options": "i"}
    })
    if not department:
        return None, (jsonify({"error": "Choose a department from the department list."}), 400)
    course = current_app.config["DB"]["courses"].find_one({
        "name": {"$regex": f"^{re.escape(course_name)}$", "$options": "i"},
        "department": department["name"],
    })
    if not course:
        return None, (jsonify({"error": "Choose a course from the selected department."}), 400)

    overlap_query = {
        "title": title,
        "start": {"$lt": end},
        "end": {"$gt": start},
    }
    if booking_id:
        overlap_query["_id"] = {"$ne": ObjectId(booking_id)}

    existing = list(get_collection().find(overlap_query))
    already_booked = sum(int(booking.get("seats", 1) or 1) for booking in existing)
    seats_left = max(0, available_lab_capacity(lab) - already_booked)
    if seats > seats_left:
        return None, (jsonify({
            "error": f"Only {seats_left} seat(s) remain in {title} for that time period.",
            "availableSeats": seats_left,
        }), 409)

    booking = {"title": title, "start": start, "end": end, "seats": seats}
    if "department" in data:
        booking["department"] = department["name"]
    if "course" in data:
        booking["course"] = course["name"]
    return booking, None

@bookings_bp.route("/", methods=["GET"])
def get_bookings():
    bookings = list(get_collection().find())
    return jsonify([serialize(b) for b in bookings])

@bookings_bp.route("/", methods=["POST"])
def create_booking():
    data = request.get_json(silent=True) or {}
    keys = lock_keys_for_booking(data)
    if not keys:
        _booking, error = validate_booking(data)
        return error if error else (jsonify({"error": "A lab and valid start time are required."}), 400)
    try:
        with acquire_booking_locks(keys):
            booking, error = validate_booking(data)
            if error:
                return error
            result = get_collection().insert_one(booking)
            return jsonify({"_id": str(result.inserted_id)}), 201
    except BookingLockTimeout:
        return capacity_lock_error()

@bookings_bp.route("/batch", methods=["POST"])
def create_bookings_batch():
    data = request.get_json(silent=True) or {}
    bookings_data = data.get("bookings") if isinstance(data, dict) else None
    if not isinstance(bookings_data, list) or not bookings_data:
        return jsonify({"error": "Provide at least one booking."}), 400

    try:
        keys = set().union(*(lock_keys_for_booking(item) for item in bookings_data))
        with acquire_booking_locks(keys):
            bookings = []
            for index, booking_data in enumerate(bookings_data, start=1):
                booking, error = validate_booking(booking_data)
                if error:
                    response, status = error
                    return jsonify({
                        "error": f"Booking {index}: {response.get_json().get('error', 'Invalid booking.')}"
                    }), status
                bookings.append(booking)
            capacity_error = validate_batch_capacity(bookings)
            if capacity_error:
                return capacity_error

            collection = get_collection()
            booking_ids = [ObjectId() for _ in bookings]
            documents = [{**booking, "_id": booking_id} for booking, booking_id in zip(bookings, booking_ids)]
            try:
                collection.insert_many(documents, ordered=True)
            except PyMongoError:
                current_app.logger.exception("Could not save the full batch of bookings")
                rollback_succeeded = True
                try:
                    collection.delete_many({"_id": {"$in": booking_ids}})
                except PyMongoError:
                    rollback_succeeded = False
                    current_app.logger.exception("Could not roll back a partially inserted booking batch")
                message = (
                    "The bookings could not all be saved and partial records may remain. Check the timetable before retrying."
                    if not rollback_succeeded
                    else "The bookings could not all be saved. No new bookings were kept; please retry."
                )
                return jsonify({"error": message}), 500
            return jsonify({"ids": [str(booking_id) for booking_id in booking_ids]}), 201
    except BookingLockTimeout:
        return capacity_lock_error()

@bookings_bp.route("/<id>", methods=["PUT"])
def update_booking(id):
    try:
        booking_id = ObjectId(id)
    except Exception:
        return jsonify({"error": "Invalid booking ID."}), 400
    existing_booking = get_collection().find_one({"_id": booking_id})
    if not existing_booking:
        return jsonify({"error": "Booking not found."}), 404
    data = request.get_json(silent=True) or {}
    keys = lock_keys_for_existing_booking(existing_booking) | lock_keys_for_booking(data)
    try:
        with acquire_booking_locks(keys):
            current_booking = get_collection().find_one({"_id": booking_id})
            if not current_booking:
                return jsonify({"error": "Booking not found."}), 404
            if booking_changed(current_booking, existing_booking):
                return jsonify({"error": "This booking changed while you were editing it. Reload and try again."}), 409
            updated, error = validate_booking(data, booking_id)
            if error:
                return error
            get_collection().update_one({"_id": booking_id}, {"$set": updated})
            return jsonify({"message": "Booking updated"})
    except BookingLockTimeout:
        return capacity_lock_error()

@bookings_bp.route("/<id>", methods=["DELETE"])
def delete_booking(id):
    try:
        booking_id = ObjectId(id)
    except Exception:
        return jsonify({"error": "Invalid booking ID."}), 400
    existing_booking = get_collection().find_one({"_id": booking_id})
    if not existing_booking:
        return jsonify({"error": "Booking not found."}), 404
    try:
        with acquire_booking_locks(lock_keys_for_existing_booking(existing_booking)):
            current_booking = get_collection().find_one({"_id": booking_id})
            if not current_booking:
                return jsonify({"error": "Booking not found."}), 404
            if booking_changed(current_booking, existing_booking):
                return jsonify({"error": "This booking changed while you were deleting it. Reload and try again."}), 409
            result = get_collection().delete_one({"_id": booking_id})
            if not result.deleted_count:
                return jsonify({"error": "Booking not found."}), 404
            return jsonify({"message": "Booking deleted"})
    except BookingLockTimeout:
        return capacity_lock_error()
