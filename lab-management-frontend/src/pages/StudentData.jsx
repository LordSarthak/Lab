import React, { useEffect, useState } from 'react';
import api from '../api';
import TableWithPagination from '../components/TableWithPagination';
import ModalForm from '../components/ModalForm';
import { ExportToCSV } from '../components/ExportToCSV';
import './StudentData.css';

const StudentData = () => {
    const [students, setStudents] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [editingStudent, setEditingStudent] = useState(null);
    const [studentToConfirm, setStudentToConfirm] = useState(null);
    const [toastMessage, setToastMessage] = useState('');

    useEffect(() => {
        fetchStudents();
    }, []);

    const fetchStudents = () => {
        api.get('/students')
            .then(res => setStudents(res.data))
            .catch(err => console.error("Failed to fetch students", err));
    };

    const handleFormSubmit = (student) => {
        if (!student.name || !student.email || !student.rollNumber || !student.department) {
            alert("Please fill in all required fields.");
            return;
        }

        // ✅ Check email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(student.email)) {
            alert("Please enter a valid email address.");
            return;
        }

        // 🔒 Check if roll number already exists
        const duplicate = students.find(s => s.rollNumber === student.rollNumber && (!editingStudent || s._id !== editingStudent._id));
        if (duplicate) {
            alert("A student with this roll number already exists.");
            return;
        }

        setStudentToConfirm(student);
    };



    const handleConfirmSave = () => {
        const request = editingStudent
            ? api.put(`/students/${editingStudent._id}`, studentToConfirm)
            : api.post('/students', studentToConfirm);

        request.then(() => {
            setShowModal(false);
            setEditingStudent(null);
            setStudentToConfirm(null);
            setToastMessage("✅ Student saved successfully!");
            fetchStudents();
            setTimeout(() => setToastMessage(''), 3000);
        });
    };

    const handleDelete = (student) => {
        if (window.confirm(`Delete "${student.name}"?`)) {
            api.delete(`/students/${student._id}`).then(fetchStudents);
        }
    };

    const columns = [
        { key: 'serial', label: 'ID' },  // 👈 Show serial number
        { key: 'name', label: 'Name' },
        { key: 'email', label: 'Email' },
        { key: 'rollNumber', label: 'Roll Number' },
        { key: 'department', label: 'Department' }
    ];

    return (
        <div className="students-data-page">
            <div className="page-header">
                <h2>Students Data</h2>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={() => { setEditingStudent(null); setShowModal(true); }}>➕ Add Student</button>
                    <ExportToCSV data={students} filename="students.csv" />
                </div>
            </div>

            <TableWithPagination
                data={students.map((student, index) => ({ ...student, serial: index + 1 }))} // 👈 Add serial
                columns={columns}
                onEdit={(student) => { setEditingStudent(student); setShowModal(true); }}
                onDelete={handleDelete}
            />

            <ModalForm
                title={editingStudent ? 'Edit Student' : 'Add Student'}
                fields={[
                    { name: 'name', label: 'Name', type: 'text' },           // ✅ text
                    { name: 'email', label: 'Email', type: 'email' },         // ✅ email
                    { name: 'rollNumber', label: 'Roll Number', type: 'number' }, // ✅ number
                    { name: 'department', label: 'Department', type: 'text' } // ✅ text
                ]}
                initialData={editingStudent ? { ...editingStudent, _id: undefined } : {}}
                onSubmit={handleFormSubmit}
                onClose={() => setShowModal(false)}
                show={showModal}
            />


            {studentToConfirm && (
                <div className="confirmation-modal">
                    <div className="modal-content">
                        <h3>Confirm Student Details</h3>
                        <p><strong>Name:</strong> {studentToConfirm.name}</p>
                        <p><strong>Email:</strong> {studentToConfirm.email}</p>
                        <p><strong>Roll Number:</strong> {studentToConfirm.rollNumber}</p>
                        <p><strong>Department:</strong> {studentToConfirm.department}</p>
                        <div style={{ marginTop: '10px' }}>
                            <button onClick={handleConfirmSave}>✅ Confirm & Save</button>
                            <button onClick={() => setStudentToConfirm(null)} style={{ marginLeft: '10px' }}>❌ Cancel</button>
                        </div>
                    </div>
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
