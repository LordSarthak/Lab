# 🧪 Lab Management Backend - Flask API

This is the backend for the Lab Management System built with **Flask** and **SQLite**. It supports managing labs, students, and bookings with a RESTful API.

---

## 🚀 Quick Start

### 🔧 Requirements

- Python 3.7+
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
| POST   | `/students/`     | Add a new student        |

Example:

```json
POST /students/
{
  "name": "Alice",
  "department": "Physics"
}
```

---

### 📅 Bookings

| Method | Endpoint        | Description              |
|--------|------------------|--------------------------|
| GET    | `/bookings/`     | List all bookings        |
| POST   | `/bookings/`     | Add a new booking        |

Example:

```json
POST /bookings/
{
  "labId": 1,
  "student": "Alice",
  "date": "2025-05-01",
  "slot": "10:00 - 11:00"
}
```

---

## 🔒 CORS Support

CORS is enabled using `flask-cors` so your React frontend can connect to this backend securely.