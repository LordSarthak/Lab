import re

REQUIRED_COLUMNS = [
    "Roll No",
    "Student Name",
    "Email",
    "Phone",
    "Branch",
    "Semester",
    "Section",
]


def validate_required_columns(df):
    """
    Checks if all required columns are present in the uploaded file.
    """
    missing = []

    uploaded_columns = [str(col).strip() for col in df.columns]

    for column in REQUIRED_COLUMNS:
        if column not in uploaded_columns:
            missing.append(column)

    return missing


def validate_email(email):
    if email is None:
        return False

    email = str(email).strip()

    pattern = r'^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'

    return re.match(pattern, email) is not None


def validate_phone(phone):
    if phone is None:
        return False

    phone = str(phone).strip()

    phone = phone.replace(" ", "")
    phone = phone.replace("-", "")

    if phone.startswith("+91"):
        phone = phone[3:]

    if phone.startswith("91") and len(phone) == 12:
        phone = phone[2:]

    return phone.isdigit() and len(phone) == 10


def validate_semester(semester):
    try:
        semester = float(semester)
        return semester.is_integer() and 1 <= semester <= 12
    except (TypeError, ValueError, OverflowError):
        return False


def validate_roll_number(roll):
    if roll is None:
        return False

    return str(roll).strip() != ""


def validate_name(name):
    if name is None:
        return False

    return str(name).strip() != ""


def validate_branch(branch):
    if branch is None:
        return False

    return str(branch).strip() != ""


def validate_section(section):
    if section is None:
        return False

    return str(section).strip() != ""


def validate_student_row(row):
    """
    Returns:
        (True, "")
    or
        (False, "Reason")
    """

    if not validate_roll_number(row["Roll No"]):
        return False, "Roll Number Missing"

    if not validate_name(row["Student Name"]):
        return False, "Student Name Missing"

    if not validate_email(row["Email"]):
        return False, "Invalid Email"

    if not validate_phone(row["Phone"]):
        return False, "Invalid Phone Number"

    if not validate_branch(row["Branch"]):
        return False, "Branch Missing"

    if not validate_semester(row["Semester"]):
        return False, "Invalid Semester"

    if not validate_section(row["Section"]):
        return False, "Section Missing"

    return True, ""