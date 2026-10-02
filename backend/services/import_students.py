import os
import pandas as pd
from flask import current_app

from utils.validators import (
    validate_required_columns,
    validate_student_row,
)

ALLOWED_EXTENSIONS = {".xlsx", ".xls", ".csv"}


def read_file(file_path):
    file_path = os.fspath(file_path)
    extension = os.path.splitext(file_path)[1].lower()

    if extension not in ALLOWED_EXTENSIONS:
        raise ValueError(f"Unsupported file type: {extension or 'no extension'}")

    if not os.path.isfile(file_path):
        raise FileNotFoundError(f"Import file not found: {file_path}")

    if extension == ".csv":
        dataframe = pd.read_csv(file_path, dtype=str, keep_default_na=False)
    else:
        dataframe = pd.read_excel(file_path, dtype=object)

    dataframe.columns = [str(column).strip() for column in dataframe.columns]
    if dataframe.columns.duplicated().any():
        raise ValueError("Import file contains duplicate column names")
    return dataframe


def clean_student(row):
    phone = _clean_text(row["Phone"]).replace(" ", "").replace("-", "")

    if phone.startswith("+91"):
        phone = phone[3:]

    if phone.startswith("91") and len(phone) == 12:
        phone = phone[2:]

    return {
        "rollNo": _clean_text(row["Roll No"]),
        "studentName": _clean_text(row["Student Name"]),
        "email": _clean_text(row["Email"]),
        "phone": phone,
        "branch": _clean_text(row["Branch"]),
        "semester": int(float(row["Semester"])),
        "section": _clean_text(row["Section"]),
    }


def _clean_text(value):
    if isinstance(value, float) and value.is_integer():
        value = int(value)
    return str(value).strip()


def import_students(file_path):
    df = read_file(file_path)
    missing_columns = validate_required_columns(df)

    if missing_columns:
        return {
            "success": False,
            "message": "Required columns missing",
            "missingColumns": missing_columns,
        }

    total_rows = len(df)
    inserted = 0
    updated = 0
    failed = 0
    errors = []
    students_collection = current_app.config["DB"]["students"]

    for row_number, (_, row) in enumerate(df.iterrows(), start=2):
        row = row.astype(object).where(pd.notna(row), None).to_dict()
        valid, reason = validate_student_row(row)
        if not valid:
            failed += 1
            errors.append({
                "row": row_number,
                "reason": reason,
            })
            continue

        student = clean_student(row)
        existing = students_collection.find_one({"rollNo": student["rollNo"]})
        if existing:
            students_collection.update_one(
                {"_id": existing["_id"]},
                {"$set": student},
            )
            updated += 1
        else:
            students_collection.insert_one(student)
            inserted += 1

    return {
        "success": True,
        "totalRows": total_rows,
        "inserted": inserted,
        "updated": updated,
        "failed": failed,
        "errors": errors,
    }