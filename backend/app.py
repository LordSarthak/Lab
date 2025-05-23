from flask import Flask
from flask_cors import CORS
from pymongo import MongoClient
import config

# Route Blueprints
from routes.labs import labs_bp
from routes.students import students_bp
from routes.bookings import bookings_bp

app = Flask(__name__)

# ✅ Prevent Flask from redirecting /labs to /labs/
app.url_map.strict_slashes = False

# ✅ CORS configuration for frontend access
CORS(app, resources={r"/*": {"origins": "http://localhost:3000"}}, supports_credentials=True)

# ✅ MongoDB connection
client = MongoClient(config.MONGO_URI)  # Must include /lab_management
db = client["lab_management"]           # Access DB directly (prevents redirect)

# ✅ Share DB with route files via app config
app.config['DB'] = db

# ✅ Register route blueprints
app.register_blueprint(labs_bp, url_prefix='/labs')
app.register_blueprint(students_bp, url_prefix='/students')
app.register_blueprint(bookings_bp, url_prefix='/bookings')

# ✅ Optional: Mongo health check
@app.route('/ping-db', methods=['GET'])
def ping_db():
    try:
        db.command("ping")
        return {"status": "connected", "message": "MongoDB is working ✅"}, 200
    except Exception as e:
        return {"status": "error", "message": str(e)}, 500

# ✅ Start the server
if __name__ == '__main__':
    app.run(debug=True)
