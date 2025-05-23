from flask import Blueprint, request, jsonify
from bson import ObjectId
from pymongo import MongoClient
from datetime import datetime

bookings_bp = Blueprint("bookings", __name__)
client = MongoClient("mongodb://localhost:27017")
db = client["lab_management"]
collection = db["bookings"]

def serialize(booking):
    booking["_id"] = str(booking["_id"])
    return booking

@bookings_bp.route("/", methods=["GET"])
def get_bookings():
    bookings = list(collection.find())
    return jsonify([serialize(b) for b in bookings])

@bookings_bp.route("/", methods=["POST"])
def create_booking():
    data = request.json
    booking = {
        "title": data["title"],
        "start": datetime.fromisoformat(data["start"]),
        "end": datetime.fromisoformat(data["end"])
    }
    result = collection.insert_one(booking)
    return jsonify({"_id": str(result.inserted_id)}), 201

@bookings_bp.route("/<id>", methods=["PUT"])
def update_booking(id):
    data = request.json
    updated = {
        "title": data["title"],
        "start": datetime.fromisoformat(data["start"]),
        "end": datetime.fromisoformat(data["end"])
    }
    collection.update_one({"_id": ObjectId(id)}, {"$set": updated})
    return jsonify({"message": "Booking updated"})

@bookings_bp.route("/<id>", methods=["DELETE"])
def delete_booking(id):
    collection.delete_one({"_id": ObjectId(id)})
    return jsonify({"message": "Booking deleted"})
