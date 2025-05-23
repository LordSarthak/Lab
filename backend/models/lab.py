from bson.objectid import ObjectId

def get_all_labs(db):
    labs = list(db.labs.find())
    for lab in labs:
        lab['_id'] = str(lab['_id'])
    return labs

def create_lab(db, data):
    db.labs.insert_one(data)
    return {"message": "Lab created successfully"}

def update_lab(db, lab_id, data):
    db.labs.update_one({'_id': ObjectId(lab_id)}, {"$set": data})
    return {"message": "Lab updated successfully"}

def delete_lab(db, lab_id):
    db.labs.delete_one({'_id': ObjectId(lab_id)})
    return {"message": "Lab deleted successfully"}
