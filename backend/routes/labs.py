from flask import Blueprint, request, jsonify
from bson import ObjectId
from pymongo import MongoClient

labs_bp = Blueprint("labs", __name__)
client = MongoClient("mongodb://localhost:27017")
db = client["lab_management"]
collection = db["labs"]

def serialize(lab):
    lab["_id"] = str(lab["_id"])
    return lab

@labs_bp.route("/", methods=["GET"])
def get_labs():
    labs = list(collection.find())
    return jsonify([serialize(lab) for lab in labs])

@labs_bp.route("/", methods=["POST"])
def create_lab():
    lab = request.json
    result = collection.insert_one(lab)
    return jsonify({"_id": str(result.inserted_id)})

@labs_bp.route("/<id>", methods=["PUT"])
def update_lab(id):
    data = request.json
    collection.update_one({"_id": ObjectId(id)}, {"$set": data})
    return jsonify({"message": "Lab updated"})

@labs_bp.route("/<id>", methods=["DELETE"])
def delete_lab(id):
    collection.delete_one({"_id": ObjectId(id)})
    return jsonify({"message": "Lab deleted"})
