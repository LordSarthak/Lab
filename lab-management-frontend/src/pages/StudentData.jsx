import React, { useEffect, useState } from 'react';
import api from '../api';
import TableWithPagination from '../components/TableWithPagination';
import ModalForm from '../components/ModalForm';
import { ExportToCSV } from '../components/ExportToCSV';
import RequestState, { getRequestErrorMessage } from '../components/RequestState';
import ImportDataModal from '../components/ImportDataModal';
import { Upload } from 'lucide-react';
import { Link } from 'react-router-dom';
import './RecordPages.css';

const StudentData = () => {
    const [students, setStudents] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [courses, setCourses] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [editingStudent, setEditingStudent] = useState(null);
    const [studentToConfirm, setStudentToConfirm] = useState(null);
    const [toastMessage, setToastMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(null);
    const [actionError, setActionError] = useState(null);
    const [saving, setSaving] = useState(false);
    const [showImport, setShowImport] = useState(false);

    useEffect(() => {
        fetchStudents();
    }, []);

    const fetchStudents = () => {
        setLoading(true);
        setLoadError(null);
        Promise.all([api.get('/students'), api.get('/departments'), api.get('/courses')])
            .then(([studentResponse, departmentResponse, courseResponse]) => {
                setStudents(studentResponse.data);
                setDepartments(departmentResponse.data);
                setCourses(courseResponse.data);
            })
            .catch(setLoadError)
            .finally(() => setLoading(false));
    };

    const handleFormSubmit = (student) => {
        const email = student.email?.trim();
        const rollNumber = String(student.rollNumber ?? '').trim();
        const courseName = String(student.course ?? '').trim();
        if (!student.name?.trim() || !email || !rollNumber || !student.department?.trim() || !courseName) {
            alert("Please fill in all required fields.");
            return;
        }
        const selectedDepartment = departments.find(
            department => department.name.toLowerCase() === student.department.trim().toLowerCase()
        ) || (
            editingStudent?.department?.toLowerCase() === student.department.trim().toLowerCase()
                ? { name: editingStudent.department }
                : null
        );
        if (!selectedDepartment) {
            alert('Choose a department from the department list.');
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            alert("Please enter a valid email address.");
            return;
        }

        const duplicateEmail = students.find(s =>
            s.email?.trim().toLowerCase() === email.toLowerCase() &&
            (!editingStudent || s._id !== editingStudent._id)
        );
        if (duplicateEmail) {
            alert("A student with this email address already exists.");
            return;
        }

        const duplicate = students.find(s =>
            String(s.rollNumber ?? '').trim().toLowerCase() === rollNumber.toLowerCase() &&
            (!editingStudent || s._id !== editingStudent._id)
        );
        if (duplicate) {
            alert("A student with this roll number already exists.");
            return;
        }

        const selectedCourse = courses.find(course => course.name.toLowerCase() === courseName.toLowerCase());
        const unchangedLegacyCourse = editingStudent &&
            editingStudent.course?.toLowerCase() === courseName.toLowerCase() &&
            editingStudent.department?.toLowerCase() === student.department.trim().toLowerCase();
        if (!selectedCourse && !unchangedLegacyCourse) {
            alert('Choose a course from the course list.');
            return;
        }
        if (selectedCourse && selectedCourse.department.toLowerCase() !== selectedDepartment.name.toLowerCase()) {
            alert('The selected course does not belong to the selected department.');
            return;
        }

        setStudentToConfirm({ ...student, email, rollNumber, department: selectedDepartment.name, course: selectedCourse?.name || editingStudent.course });
    };



    const handleConfirmSave = async () => {
        if (saving) return;
        setSaving(true);
        setActionError(null);
        try {
            if (editingStudent) {
                await api.put(`/students/${editingStudent._id}`, studentToConfirm);
            } else {
                await api.post('/students', studentToConfirm);
            }
            setShowModal(false);
            setEditingStudent(null);
            setStudentToConfirm(null);
            setToastMessage("✅ Student saved successfully!");
            fetchStudents();
            setTimeout(() => setToastMessage(''), 3000);
        } catch (error) {
            setActionError(getRequestErrorMessage(error));
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (student) => {
        if (window.confirm(`Delete "${student.name}"?`)) {
            setActionError(null);
            try {
                await api.delete(`/students/${student._id}`);
                fetchStudents();
            } catch (error) {
                setActionError(getRequestErrorMessage(error));
            }
        }
    };

    const columns = [
        { key: 'serial', label: 'ID' },
        { key: 'name', label: 'Name' },
        { key: 'email', label: 'Email' },
        { key: 'rollNumber', label: 'Roll Number' },
        { key: 'department', label: 'Department' },
        { key: 'course', label: 'Course' }
    ];

    const departmentOptions = [
        { value: '', label: departments.length ? 'Choose a department' : 'No departments available' },
        ...departments.map(department => ({ value: department.name, label: `${department.name} (${department.code})` })),
        ...(editingStudent?.department && !departments.some(department => department.name === editingStudent.department)
            ? [{ value: editingStudent.department, label: `${editingStudent.department} (not in department catalog)` }]
            : []),
    ];
    const getCourseOptions = (formData) => [
        { value: '', label: formData.department ? 'Select a course' : 'Choose a department first' },
        ...courses
            .filter(course => course.department === formData.department)
            .map(course => ({
                value: course.name,
                label: `${course.name} (${course.code})`,
            })),
        ...(editingStudent?.course &&
            editingStudent.department === formData.department &&
            !courses.some(course => course.name === editingStudent.course && course.department === editingStudent.department)
            ? [{ value: editingStudent.course, label: `${editingStudent.course} (not in course catalog)` }]
            : []),
    ];

    return (
        <div className="students-data-page">
            <div className="page-header">
                <div className="page-heading">
                    <p className="page-kicker">CAMPUS DIRECTORY</p>
                    <h1>Student Data</h1>
                    <p>Maintain student records used for laboratory administration.</p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={() => { setEditingStudent(null); setShowModal(true); }}>➕ Add Student</button>
                    <button onClick={() => setShowImport(true)}><Upload size={15} aria-hidden="true" /> Import</button>
                    <ExportToCSV data={students} filename="students.csv" />
                </div>
            </div>

            <p className="catalog-prerequisite">
                Academic structure: <Link to="/departments">Departments</Link> · <Link to="/courses">Courses</Link>
            </p>

            {showImport && <ImportDataModal resource="students" title="students" onClose={() => setShowImport(false)} onImported={fetchStudents} />}

            <RequestState loading={loading} error={loadError} onRetry={fetchStudents} loadingMessage="Loading student records..." />
            {actionError && <RequestState error={actionError} />}
            {saving && <RequestState loading loadingMessage="Saving student record..." />}

            <TableWithPagination
                data={students.map((student, index) => ({ ...student, serial: index + 1 }))}
                columns={columns}
                onEdit={(student) => { setEditingStudent(student); setShowModal(true); }}
                onDelete={handleDelete}
            />

            <ModalForm
                title={editingStudent ? 'Edit Student' : 'Add Student'}
                fields={[
                    { name: 'name', label: 'Name', type: 'text' },
                    { name: 'email', label: 'Email', type: 'email' },
                    { name: 'rollNumber', label: 'Roll Number', type: 'text' },
                    {
                        name: 'department',
                        label: 'Department',
                        type: 'select',
                        options: departmentOptions,
                        disabled: departments.length === 0,
                    },
                    { name: 'course', label: 'Course', type: 'select', options: getCourseOptions, dependsOn: 'department' },
                ]}
                initialData={editingStudent ? {
                    ...editingStudent,
                    course: editingStudent.course || '',
                    _id: undefined,
                } : { department: '', course: '' }}
                onSubmit={handleFormSubmit}
                onClose={() => setShowModal(false)}
                show={showModal}
            />


            {studentToConfirm && (
                <div className="confirmation-modal">
                    <form
                        className="modal-content"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="student-confirm-title"
                        onSubmit={(event) => { event.preventDefault(); handleConfirmSave(); }}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter' && event.target.type !== 'button') {
                                event.preventDefault();
                                event.currentTarget.requestSubmit();
                            }
                        }}
                    >
                        <h3 id="student-confirm-title">Confirm Student Details</h3>
                        <p><strong>Name:</strong> {studentToConfirm.name}</p>
                        <p><strong>Email:</strong> {studentToConfirm.email}</p>
                        <p><strong>Roll Number:</strong> {studentToConfirm.rollNumber}</p>
                        <p><strong>Department:</strong> {studentToConfirm.department}</p>
                        {studentToConfirm.course && <p><strong>Course:</strong> {studentToConfirm.course}</p>}
                        <div style={{ marginTop: '10px' }}>
                            <button type="submit" autoFocus disabled={saving}>✅ Confirm &amp; Save</button>
                            <button type="button" onClick={() => setStudentToConfirm(null)} style={{ marginLeft: '10px' }}>❌ Cancel</button>
                        </div>
                    </form>
                </div>
            )}

            {toastMessage && (
                <div className={`toast-message ${toastMessage.includes('❌') ? 'error' : 'success'}`}>
                    {toastMessage}
                </div>
            )}
        </div>
    );
};

export default StudentData;
