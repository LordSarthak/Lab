from bson.objectid import ObjectId

def get_all_bookings(db):
    bookings = list(db.bookings.find())
    for b in bookings:
        b['_id'] = str(b['_id'])
    return bookings

def create_booking(db, data):
    db.bookings.insert_one(data)
    return {"message": "Booking created"}

def update_booking(db, booking_id, data):
    db.bookings.update_one({'_id': ObjectId(booking_id)}, {"$set": data})
    return {"message": "Booking updated"}

def delete_booking(db, booking_id):
    db.bookings.delete_one({'_id': ObjectId(booking_id)})
    return {"message": "Booking deleted"}
