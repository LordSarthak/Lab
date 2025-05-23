from bson.objectid import ObjectId

def get_all_students(db):
    students = list(db.students.find())
    for s in students:
        s['_id'] = str(s['_id'])
    return students

def create_student(db, data):
    db.students.insert_one(data)
    return {"message": "Student added successfully"}

def update_student(db, student_id, data):
    db.students.update_one({'_id': ObjectId(student_id)}, {"$set": data})
    return {"message": "Student updated successfully"}

def delete_student(db, student_id):
    db.students.delete_one({'_id': ObjectId(student_id)})
    return {"message": "Student deleted successfully"}
