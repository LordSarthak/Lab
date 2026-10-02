import os
import re

import pandas as pd


ALLOWED_EXTENSIONS = {".csv", ".xls", ".xlsx"}

FIELD_ALIASES = {
    "students": {
        "name": ("name", "student name", "full name"),
        "email": ("email", "email address", "email id"),
        "rollNumber": ("roll number", "roll no", "rollnumber", "rollno", "student id", "admission number"),
        "department": ("department", "branch", "course", "program"),
        "course": ("course name", "degree program"),
    },
    "labs": {
        "name": ("lab name", "name", "room name", "room"),
        "equipmentCount": ("equipment count", "computers", "computer count", "number of computers", "capacity"),
        "occupiedSeats": ("occupied seats", "currently occupied seats", "used seats"),
        "status": ("status", "availability", "lab status"),
        "software": ("software", "installed software", "programs"),
    },
    "departments": {
        "name": ("department name", "department", "name"),
        "code": ("department code", "code", "dept code"),
        "description": ("description", "details"),
    },
    "courses": {
        "name": ("course name", "name", "title"),
        "code": ("course code", "code"),
        "department": ("department", "department name", "dept"),
        "credits": ("credits", "credit", "credit hours"),
    },
}

REQUIRED_FIELDS = {
    "students": ("name", "email", "rollNumber", "department"),
    "labs": ("name", "equipmentCount"),
    "departments": ("name", "code"),
    "courses": ("name", "code", "department", "credits"),
}


def _normalize_header(value):
    return re.sub(r"[^a-z0-9]", "", str(value).strip().lower())


def _clean_value(value):
    if pd.isna(value):
        return ""
    if isinstance(value, float) and value.is_integer():
        value = int(value)
    return str(value).strip()


def load_import_rows(upload, resource):
    filename = os.path.basename(upload.filename or "")
    extension = os.path.splitext(filename)[1].lower()
    if extension not in ALLOWED_EXTENSIONS:
        raise ValueError("Choose a CSV, XLS, or XLSX file.")

    try:
        if extension == ".csv":
            dataframe = pd.read_csv(upload.stream, dtype=object, keep_default_na=False)
        else:
            dataframe = pd.read_excel(upload.stream, dtype=object)
    except Exception as error:
        raise ValueError("The file could not be read. Check that it is a valid CSV or Excel file.") from error

    if resource not in FIELD_ALIASES:
        raise ValueError("Unsupported data type.")
    aliases = FIELD_ALIASES[resource]
    alias_lookup = {
        _normalize_header(alias): field
        for field, values in aliases.items()
        for alias in values
    }
    mapped_columns = {}
    ignored_columns = []
    for column in dataframe.columns:
        field = alias_lookup.get(_normalize_header(column))
        if field is None:
            ignored_columns.append(str(column))
        elif field in mapped_columns:
            raise ValueError(f"More than one column matches '{field}'. Keep only one matching column.")
        else:
            mapped_columns[field] = column

    required_fields = REQUIRED_FIELDS[resource]
    missing_fields = [field for field in required_fields if field not in mapped_columns]
    if missing_fields:
        labels = {field: field for field in required_fields}
        raise ValueError("Could not identify required columns: " + ", ".join(labels[field] for field in missing_fields))

    rows = []
    for row_number, (_, row) in enumerate(dataframe.iterrows(), start=2):
        rows.append({
            "row": row_number,
            "data": {field: _clean_value(row[column]) for field, column in mapped_columns.items()},
        })

    return rows, ignored_columns