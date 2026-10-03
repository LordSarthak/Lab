from flask import Flask
from flask_cors import CORS
from pymongo import MongoClient
from pymongo.errors import PyMongoError
import config

from routes.labs import labs_bp
from routes.students import students_bp
from routes.bookings import bookings_bp
from routes.departments import departments_bp
from routes.courses import courses_bp
from routes.timetable import timetable_bp

app = Flask(__name__)

# Avoid redirects between collection URLs with and without a trailing slash.
app.url_map.strict_slashes = False

CORS(app, resources={r"/*": {"origins": r"^http://(localhost|127\.0\.0\.1)(:\d+)?$"}})

client = MongoClient(config.MONGO_URI)
db = client[config.MONGO_DB_NAME]

app.config['DB'] = db

app.register_blueprint(labs_bp, url_prefix='/labs')
app.register_blueprint(students_bp, url_prefix='/students')
app.register_blueprint(bookings_bp, url_prefix='/bookings')
app.register_blueprint(departments_bp, url_prefix='/departments')
app.register_blueprint(courses_bp, url_prefix='/courses')
app.register_blueprint(timetable_bp, url_prefix='/timetable')

@app.route('/ping-db', methods=['GET'])
def ping_db():
    try:
        db.command("ping")
        return {"status": "connected", "database": config.MONGO_DB_NAME}, 200
    except PyMongoError:
        app.logger.exception("Could not connect to MongoDB")
        return {
            "status": "error",
            "message": "Could not connect to MongoDB. Make sure the MongoDB server is running and MONGO_URI is correct.",
        }, 500

if __name__ == '__main__':
    app.run(debug=True)
