import unittest
from datetime import datetime
import re

from bson import ObjectId
from pymongo.errors import DuplicateKeyError

import app as application
from routes.bookings import validate_booking


class MemoryCollection:
    def __init__(self, documents=None):
        self.documents = documents or []
        self.inserted = []

    def find_one(self, query):
        for document in self.documents:
            matches = True
            for key, value in query.items():
                actual = document.get(key)
                if isinstance(value, dict) and "$regex" in value:
                    flags = re.IGNORECASE if value.get("$options") == "i" else 0
                    matches = bool(re.search(value["$regex"], actual or "", flags))
                else:
                    matches = actual == value
                if not matches:
                    break
            if matches:
                return document
        return None

    def find(self, _query):
        return []

    def insert_many(self, documents, ordered=True):
        self.inserted.extend(documents)

    def find_one_and_update(self, query, update, upsert, return_document):
        now = query["$or"][0]["leaseUntil"]["$lte"]
        document = next((item for item in self.documents if item.get("_id") == query["_id"]), None)
        if document and document.get("owner") and document.get("leaseUntil") > now:
            raise DuplicateKeyError("Lock is currently held.")
        if not document:
            document = {"_id": query["_id"]}
            self.documents.append(document)
        document.update(update["$set"])
        return document

    def delete_many(self, query):
        ids = query["_id"]["$in"]
        self.documents = [
            document for document in self.documents
            if document.get("_id") not in ids or document.get("owner") != query["owner"]
        ]


class MemoryDatabase:
    def __init__(self, collections):
        self.collections = collections

    def __getitem__(self, name):
        return self.collections[name]


class BookingValidationTests(unittest.TestCase):
    def setUp(self):
        self.booking_id = ObjectId()
        self.existing = {
            "_id": self.booking_id,
            "title": "Lab A",
            "start": datetime(2025, 2, 3, 3, 30),
            "end": datetime(2025, 2, 3, 4, 30),
        }
        self.bookings = MemoryCollection([self.existing])
        self.database = MemoryDatabase({
            "settings": MemoryCollection([{
                "_id": "timetable",
                "startTime": "09:00",
                "endTime": "10:00",
                "slotInterval": 60,
                "bookingDurationMinutes": 60,
                "slots": [{"startTime": "09:00", "endTime": "10:00", "enabled": False}],
            }]),
            "labs": MemoryCollection([{"name": "Lab A", "equipmentCount": 10, "occupiedSeats": 0}]),
            "departments": MemoryCollection([{"name": "Science"}]),
            "courses": MemoryCollection([{"name": "Biology", "department": "Science"}]),
            "bookings": self.bookings,
            "booking_locks": MemoryCollection(),
        })
        self.context = application.app.app_context()
        self.context.push()
        self.original_database = application.app.config["DB"]
        application.app.config["DB"] = self.database

    def tearDown(self):
        application.app.config["DB"] = self.original_database
        self.context.pop()

    def test_unchanged_disabled_interval_normalizes_naive_utc(self):
        payload = {
            "title": "Lab A",
            "start": "2025-02-03T09:00:00+05:30",
            "end": "2025-02-03T10:00:00+05:30",
            "seats": 1,
            "department": "Science",
            "course": "Biology",
        }

        booking, error = validate_booking(payload, self.booking_id)

        self.assertIsNone(error)
        self.assertEqual(booking["start"].isoformat(), "2025-02-03T09:00:00+05:30")

    def test_disabled_interval_cannot_be_reused_on_another_date(self):
        payload = {
            "title": "Lab A",
            "start": "2025-02-10T09:00:00+05:30",
            "end": "2025-02-10T10:00:00+05:30",
            "seats": 1,
            "department": "Science",
            "course": "Biology",
        }

        _booking, error = validate_booking(payload, self.booking_id)

        self.assertIsNotNone(error)
        self.assertEqual(error[1], 400)

    def test_batch_booking_saves_all_valid_occurrences_together(self):
        self.database["settings"].documents[0]["slots"][0]["enabled"] = True
        occurrence = {
            "title": "Lab A",
            "start": "2025-02-03T09:00:00+05:30",
            "end": "2025-02-03T10:00:00+05:30",
            "seats": 1,
            "department": "Science",
            "course": "Biology",
        }

        response = application.app.test_client().post(
            "/bookings/batch",
            json={"bookings": [occurrence, {
                **occurrence,
                "start": "2025-02-10T09:00:00+05:30",
                "end": "2025-02-10T10:00:00+05:30",
            }]},
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(len(response.get_json()["ids"]), 2)
        self.assertEqual(len(self.bookings.inserted), 2)

    def test_invalid_batch_occurrence_prevents_any_insert(self):
        self.database["settings"].documents[0]["slots"][0]["enabled"] = True
        occurrence = {
            "title": "Lab A",
            "start": "2025-02-03T09:00:00+05:30",
            "end": "2025-02-03T10:00:00+05:30",
            "seats": 1,
            "department": "Science",
            "course": "Biology",
        }

        response = application.app.test_client().post(
            "/bookings/batch",
            json={"bookings": [occurrence, {**occurrence, "course": "Unknown"}]},
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(self.bookings.inserted, [])

    def test_batch_capacity_includes_overlapping_occurrences(self):
        self.database["settings"].documents[0]["slots"][0]["enabled"] = True
        occurrence = {
            "title": "Lab A",
            "start": "2025-02-03T09:00:00+05:30",
            "end": "2025-02-03T10:00:00+05:30",
            "seats": 6,
            "department": "Science",
            "course": "Biology",
        }

        response = application.app.test_client().post(
            "/bookings/batch",
            json={"bookings": [occurrence, occurrence]},
        )

        self.assertEqual(response.status_code, 409)
        self.assertEqual(self.bookings.inserted, [])


if __name__ == "__main__":
    unittest.main()
