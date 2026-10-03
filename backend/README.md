# 🧪 Lab Management Backend - Flask API

This is the backend for the Lab Management System built with **Flask** and **MongoDB**. It supports managing labs, students, courses, departments, and bookings with a RESTful API.

---

## 🚀 Quick Start

### 🔧 Requirements

- Python 3.7+
- MongoDB Community Server running on this computer
- pip

### 📦 Install Dependencies

```bash
pip install -r requirements.txt
```

### 🏁 Run the App

```bash
python app.py
```

By default, it runs on: `http://localhost:5000`

## MongoDB connection

The backend connects to the local MongoDB server at `mongodb://localhost:27017` and uses the `lab_management` database by default. MongoDB creates the database and collections automatically when the app first writes data.

If you have MongoDB Compass installed, note that Compass is a database viewer; the MongoDB server must also be installed and running. In PowerShell, you can check and start the Windows service (starting it may require administrator privileges):

```powershell
Get-Service MongoDB
Start-Service MongoDB
```

To use a different local URI or database name, set these environment variables in the same PowerShell window before starting the backend:

```powershell
$env:MONGO_URI = "mongodb://localhost:27017"
$env:MONGO_DB_NAME = "lab_management"
python app.py
```

After starting the backend, open `http://localhost:5000/ping-db`. A successful response includes `"status": "connected"`. If it fails, check that the MongoDB server is running and that `MONGO_URI` points to it.

Start the React frontend separately from `lab-management-frontend` with `npm start`; it connects to the Flask backend at `http://localhost:5000`.

---

## 📡 API Endpoints

### 🔬 Labs

| Method | Endpoint        | Description            |
|--------|------------------|------------------------|
| GET    | `/labs/`         | List all labs          |
| POST   | `/labs/`         | Add a new lab          |
| PUT    | `/labs/<id>`     | Update lab by ID       |
| DELETE | `/labs/<id>`     | Delete lab by ID       |

Example:

```json
POST /labs/
{
  "name": "Chemistry Lab",
  "equipmentCount": 10,
  "status": "Available"
}
```

---

### 👨‍🎓 Students

| Method | Endpoint        | Description              |
|--------|------------------|--------------------------|
| GET    | `/students/`     | List all students        |
| POST   | `/students/`     | Add a student            |
| PUT    | `/students/<id>` | Update a student         |
| DELETE | `/students/<id>` | Delete a student         |
| POST   | `/students/import` | Import students from CSV or Excel |

Example:

```json
POST /students/
{
  "name": "Alice",
  "email": "alice@example.edu",
  "rollNumber": "S-1001",
  "department": "Physics",
  "course": "BSc Physics"
}
```

---

### 📅 Bookings

| Method | Endpoint        | Description              |
|--------|------------------|--------------------------|
| GET    | `/bookings/`     | List all bookings        |
| POST   | `/bookings/`     | Add a booking            |
| POST   | `/bookings/batch` | Validate and save a set of bookings together |
| PUT    | `/bookings/<id>` | Update a booking         |
| DELETE | `/bookings/<id>` | Delete a booking         |

Example:

```json
POST /bookings/
{
  "title": "Chemistry Lab",
  "start": "2025-05-01T10:00:00+05:30",
  "end": "2025-05-01T11:00:00+05:30",
  "seats": 1,
  "department": "Physics",
  "course": "BSc Physics"
}
```

The batch endpoint takes the same booking objects in a `bookings` array. It validates all occurrences before inserting any, and rejects overlapping requests that exceed lab capacity. Booking and lab update operations use atomic MongoDB lock documents so separate backend workers serialize capacity-sensitive changes; abandoned locks expire automatically.

---

## 🔒 CORS Support

CORS is enabled using `flask-cors` so your React frontend can connect to this backend securely.