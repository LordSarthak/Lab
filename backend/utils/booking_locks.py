from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
import time
from uuid import uuid4

from flask import current_app
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError, PyMongoError


class BookingLockTimeout(Exception):
    pass


def lab_lock_key(name):
    return f"lab:{name.strip().casefold()}"


def booking_lock_keys(title, start):
    normalized_title = title.strip().casefold()
    return {
        f"lab:{normalized_title}",
        f"day:{normalized_title}:{start.date().isoformat()}",
    }


@contextmanager
def acquire_booking_locks(keys, timeout_seconds=5):
    collection = current_app.config["DB"]["booking_locks"]
    token = uuid4().hex
    acquired = []
    deadline = time.monotonic() + timeout_seconds
    try:
        for key in sorted(set(keys)):
            while True:
                now = datetime.now(timezone.utc)
                try:
                    lock = collection.find_one_and_update(
                        {
                            "_id": key,
                            "$or": [
                                {"leaseUntil": {"$lte": now}},
                                {"owner": {"$exists": False}},
                            ],
                        },
                        {"$set": {
                            "owner": token,
                            "leaseUntil": now + timedelta(minutes=2),
                        }},
                        upsert=True,
                        return_document=ReturnDocument.AFTER,
                    )
                except DuplicateKeyError:
                    lock = None
                if lock:
                    acquired.append(key)
                    break
                if time.monotonic() >= deadline:
                    raise BookingLockTimeout
                time.sleep(0.05)
        yield
    finally:
        if acquired:
            try:
                collection.delete_many(
                    {"_id": {"$in": acquired}, "owner": token},
                )
            except PyMongoError:
                current_app.logger.exception("Could not release booking capacity locks")
