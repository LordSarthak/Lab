from datetime import datetime, timedelta

from flask import Blueprint, current_app, jsonify, request


timetable_bp = Blueprint("timetable", __name__)
DEFAULT_SETTINGS = {
    "startTime": "09:00",
    "endTime": "16:00",
    "slotInterval": 60,
    "bookingDurationMinutes": 60,
}


def generate_slots(start_time, end_time, interval, duration):
    start = datetime.strptime(start_time, "%H:%M")
    end = datetime.strptime(end_time, "%H:%M")
    slots = []
    current = start
    while current + timedelta(minutes=duration) <= end:
        slot_end = current + timedelta(minutes=duration)
        slots.append({
            "startTime": current.strftime("%H:%M"),
            "endTime": slot_end.strftime("%H:%M"),
            "enabled": True,
        })
        current += timedelta(minutes=interval)
    return slots


def get_collection():
    return current_app.config["DB"]["settings"]


def get_settings():
    settings = get_collection().find_one({"_id": "timetable"})
    if not settings:
        settings = DEFAULT_SETTINGS.copy()
    return {
        "startTime": settings.get("startTime", DEFAULT_SETTINGS["startTime"]),
        "endTime": settings.get("endTime", DEFAULT_SETTINGS["endTime"]),
        "slotInterval": settings.get("slotInterval", DEFAULT_SETTINGS["slotInterval"]),
        "bookingDurationMinutes": settings.get("bookingDurationMinutes", DEFAULT_SETTINGS["bookingDurationMinutes"]),
        "slots": settings.get("slots") or generate_slots(
            settings.get("startTime", DEFAULT_SETTINGS["startTime"]),
            settings.get("endTime", DEFAULT_SETTINGS["endTime"]),
            settings.get("slotInterval", DEFAULT_SETTINGS["slotInterval"]),
            settings.get("bookingDurationMinutes", DEFAULT_SETTINGS["bookingDurationMinutes"]),
        ),
    }


def validate_settings(data):
    if not isinstance(data, dict):
        return None, "Timetable settings must be an object."

    start_time = data.get("startTime")
    end_time = data.get("endTime")
    slot_interval = data.get("slotInterval")
    booking_duration = data.get("bookingDurationMinutes")
    slots = data.get("slots")
    if not isinstance(start_time, str) or not isinstance(end_time, str):
        return None, "Choose valid opening and closing times."
    try:
        start = datetime.strptime(start_time, "%H:%M").time()
        end = datetime.strptime(end_time, "%H:%M").time()
    except ValueError:
        return None, "Choose valid opening and closing times."

    if (
        start.strftime("%H:%M") != start_time
        or end.strftime("%H:%M") != end_time
        or (end.hour * 60 + end.minute) - (start.hour * 60 + start.minute) < 15
    ):
        return None, "Closing time must be at least 15 minutes after opening time."
    if type(slot_interval) is not int or not 5 <= slot_interval <= 180:
        return None, "Slot interval must be a whole number from 5 to 180 minutes."
    if type(booking_duration) is not int or not 1 <= booking_duration <= 480:
        return None, "Default booking duration must be a whole number from 1 to 480 minutes."
    if booking_duration > (end.hour * 60 + end.minute) - (start.hour * 60 + start.minute):
        return None, "Booking duration cannot be longer than the timetable opening hours."

    if slots is None:
        slots = generate_slots(start_time, end_time, slot_interval, booking_duration)
    if not isinstance(slots, list) or not slots:
        return None, "Add at least one timetable interval."

    validated_slots = []
    for slot in slots:
        if not isinstance(slot, dict):
            return None, "Each timetable interval must include a start and end time."
        slot_start = slot.get("startTime")
        slot_end = slot.get("endTime")
        enabled = slot.get("enabled")
        if not isinstance(slot_start, str) or not isinstance(slot_end, str) or type(enabled) is not bool:
            return None, "Each timetable interval must include valid times and an enabled status."
        try:
            interval_start = datetime.strptime(slot_start, "%H:%M")
            interval_end = datetime.strptime(slot_end, "%H:%M")
        except ValueError:
            return None, "Timetable intervals must use valid 24-hour times."
        start_minute = interval_start.hour * 60 + interval_start.minute
        end_minute = interval_end.hour * 60 + interval_end.minute
        if (
            interval_start.strftime("%H:%M") != slot_start
            or interval_end.strftime("%H:%M") != slot_end
            or start_minute < start.hour * 60 + start.minute
            or end_minute > end.hour * 60 + end.minute
            or end_minute <= start_minute
        ):
            return None, "Each interval must end after it starts and stay within timetable operating hours."
        validated_slots.append({
            "startTime": slot_start,
            "endTime": slot_end,
            "enabled": enabled,
        })

    validated_slots.sort(key=lambda item: item["startTime"])
    for previous, current in zip(validated_slots, validated_slots[1:]):
        if current["startTime"] == previous["startTime"]:
            return None, "Each timetable interval must have a unique start time."

    return {
        "startTime": start_time,
        "endTime": end_time,
        "slotInterval": slot_interval,
        "bookingDurationMinutes": booking_duration,
        "slots": validated_slots,
    }, None


@timetable_bp.route("/", methods=["GET"])
def get_timetable_settings():
    return jsonify(get_settings())


@timetable_bp.route("/", methods=["PUT"])
def update_timetable_settings():
    settings, error = validate_settings(request.get_json(silent=True))
    if error:
        return jsonify({"message": error}), 400
    get_collection().update_one(
        {"_id": "timetable"},
        {"$set": settings},
        upsert=True,
    )
    return jsonify(settings)
