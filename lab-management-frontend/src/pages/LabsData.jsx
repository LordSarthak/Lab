import React, { useEffect, useState } from 'react';
import api from '../api';
import TableWithPagination from '../components/TableWithPagination';
import ModalForm from '../components/ModalForm';
import { ExportToCSV } from '../components/ExportToCSV';
import './LabsData.css';

const LabsData = () => {
    const [labs, setLabs] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [editingLab, setEditingLab] = useState(null);
    const [labToConfirm, setLabToConfirm] = useState(null);
    const [toastMessage, setToastMessage] = useState('');

    useEffect(() => {
        fetchLabs();
    }, []);

    const fetchLabs = () => {
        api.get('/labs')
            .then(res => setLabs(res.data))
            .catch(err => console.error("Failed to fetch labs", err));
    };

    const handleFormSubmit = (lab) => {
        if (!lab.name || !lab.status || lab.equipmentCount == null) {
            alert("Please fill in all fields.");
            return;
        }

        // 🔒 Check if name already exists
        const duplicate = labs.find(l => l.name.toLowerCase() === lab.name.toLowerCase() && (!editingLab || l._id !== editingLab._id));
        if (duplicate) {
            alert("A lab with this name already exists.");
            return;
        }

        setLabToConfirm(lab);
    };


    const handleConfirmSave = () => {
        const request = editingLab
            ? api.put(`/labs/${editingLab._id}`, labToConfirm)
            : api.post('/labs', labToConfirm);

        request.then(() => {
            setShowModal(false);
            setEditingLab(null);
            setLabToConfirm(null);
            setToastMessage("✅ Lab saved successfully!");
            fetchLabs();
            setTimeout(() => setToastMessage(''), 3000);
        });
    };

    const handleDelete = (lab) => {
        if (window.confirm(`Delete "${lab.name}"?`)) {
            api.delete(`/labs/${lab._id}`).then(fetchLabs);
        }
    };

    const columns = [
        { key: 'serial', label: 'ID' },  // 👈 Show serial number
        { key: 'name', label: 'Lab Name' },
        { key: 'equipmentCount', label: 'Computers' },
        { key: 'status', label: 'Status' },
        { key: 'software', label: 'Software' }
    ];

    return (
        <div className="labs-data-page">
            <div className="page-header">
                <h2>Labs Data</h2>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={() => { setEditingLab(null); setShowModal(true); }}>➕ Add Lab</button>
                    <ExportToCSV data={labs} filename="labs.csv" />
                </div>
            </div>

            <TableWithPagination
                data={labs.map((lab, index) => ({ ...lab, serial: index + 1 }))} // 👈 Add serial
                columns={columns}
                onEdit={(lab) => { setEditingLab(lab); setShowModal(true); }}
                onDelete={handleDelete}
            />

            <ModalForm
                title={editingLab ? 'Edit Lab' : 'Add Lab'}
                fields={[
                    { name: 'name', label: 'Lab Name', type: 'text' },
                    { name: 'equipmentCount', label: 'Number of Computers', type: 'number' },
                    { name: 'status', label: 'Status', type: 'select', options: ['Select Status', 'Available', 'Occupied'] },
                    {name: 'software', label: 'Installed Software', type: 'checkboxes', options: ["ANACONDA3", "DEV C++", "TURBO C++", 
                            "PYTHON", "VS CODE", "JAVA", "JDK", "TALLY PRIME", "GOOGLE CHROME", "R STUDIO", "MYSQL SERVER AND WORKBENCH",
                            "ORACLE VM VIRTUAL BOX", "CISCO PACKET TRACER", "XCODE", "ADOBE READER XI","AUTOCAD 2024", 
                            "LINUX (UBUNTU - CMD BASED)", "WINRAR", "NODEJS", "ECLIPCE IDE","LINUX - UBUNTU", "TABLEAU", "MATLAB R2024b"]}
                ]}
                initialData={editingLab ? { ...editingLab, _id: undefined } : { software: [] }}
                onSubmit={handleFormSubmit}
                onClose={() => setShowModal(false)}
                show={showModal}
            />

            {labToConfirm && (
                <div className="confirmation-modal">
                    <div className="modal-content">
                        <h3>Confirm Lab Details</h3>
                        <p><strong>Name:</strong> {labToConfirm.name}</p>
                        <p><strong>Computers:</strong> {labToConfirm.equipmentCount}</p>
                        <p><strong>Status:</strong> {labToConfirm.status}</p>
                        <p><strong>Software:</strong> {Array.isArray(labToConfirm.software) ? labToConfirm.software.join(', ') : ''}</p>
                        <div style={{ marginTop: '10px' }}>
                            <button onClick={handleConfirmSave}>✅ Confirm & Save</button>
                            <button onClick={() => setLabToConfirm(null)} style={{ marginLeft: '10px' }}>❌ Cancel</button>
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

export default LabsData;
