from flask import Blueprint, request, jsonify
from bson import ObjectId
from pymongo import MongoClient

students_bp = Blueprint("students", __name__)
client = MongoClient("mongodb://localhost:27017")
db = client["lab_management"]
collection = db["students"]

def serialize(student):
    student["_id"] = str(student["_id"])
    return student

@students_bp.route("/", methods=["GET"])
def get_students():
    return jsonify([serialize(s) for s in collection.find()])

@students_bp.route("/", methods=["POST"])
def add_student():
    data = request.json
    result = collection.insert_one(data)
    return jsonify({"_id": str(result.inserted_id)})

@students_bp.route("/<id>", methods=["PUT"])
def update_student(id):
    data = request.json
    collection.update_one({"_id": ObjectId(id)}, {"$set": data})
    return jsonify({"message": "Student updated"})

@students_bp.route("/<id>", methods=["DELETE"])
def delete_student(id):
    collection.delete_one({"_id": ObjectId(id)})
    return jsonify({"message": "Student deleted"})
