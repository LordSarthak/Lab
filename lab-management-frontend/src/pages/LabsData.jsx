import React, { useEffect, useState } from 'react';
import api from '../api';
import TableWithPagination from '../components/TableWithPagination';
import ModalForm from '../components/ModalForm';
import { ExportToCSV } from '../components/ExportToCSV';
import RequestState, { getRequestErrorMessage } from '../components/RequestState';
import ImportDataModal from '../components/ImportDataModal';
import { Upload } from 'lucide-react';
import './RecordPages.css';

const LabsData = () => {
    const [labs, setLabs] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [editingLab, setEditingLab] = useState(null);
    const [labToConfirm, setLabToConfirm] = useState(null);
    const [toastMessage, setToastMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(null);
    const [actionError, setActionError] = useState(null);
    const [saving, setSaving] = useState(false);
    const [showImport, setShowImport] = useState(false);

    useEffect(() => {
        fetchLabs();
    }, []);

    const fetchLabs = () => {
        setLoading(true);
        setLoadError(null);
        api.get('/labs')
            .then(res => setLabs(res.data))
            .catch(setLoadError)
            .finally(() => setLoading(false));
    };

    const handleFormSubmit = (lab) => {
        const name = lab.name?.trim();
        const equipmentCount = Number(lab.equipmentCount);
        const occupiedSeats = lab.occupiedSeats === '' || lab.occupiedSeats == null ? 0 : Number(lab.occupiedSeats);

        if (!name) {
            alert('Enter a lab name.');
            return;
        }
        if (!['Available', 'Occupied'].includes(lab.status)) {
            alert('Choose a valid lab status.');
            return;
        }
        if (!Number.isInteger(equipmentCount) || equipmentCount < 0) {
            alert('Number of computers must be a whole number of zero or more.');
            return;
        }
        if (!Number.isInteger(occupiedSeats) || occupiedSeats < 0) {
            alert('Currently occupied seats must be a whole number of zero or more.');
            return;
        }
        if (occupiedSeats > equipmentCount) {
            alert('Occupied seats cannot be greater than the number of computers.');
            return;
        }

        const duplicate = labs.find(l => l.name.trim().toLowerCase() === name.toLowerCase() && (!editingLab || l._id !== editingLab._id));
        if (duplicate) {
            alert("A lab with this name already exists.");
            return;
        }

        setLabToConfirm({ ...lab, name, equipmentCount, occupiedSeats });
    };


    const handleConfirmSave = async () => {
        if (saving) return;
        setSaving(true);
        setActionError(null);
        try {
            if (editingLab) {
                await api.put(`/labs/${editingLab._id}`, labToConfirm);
            } else {
                await api.post('/labs', labToConfirm);
            }
            setShowModal(false);
            setEditingLab(null);
            setLabToConfirm(null);
            setToastMessage("✅ Lab saved successfully!");
            fetchLabs();
            setTimeout(() => setToastMessage(''), 3000);
        } catch (error) {
            setActionError(getRequestErrorMessage(error));
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (lab) => {
        if (window.confirm(`Delete "${lab.name}"?`)) {
            setActionError(null);
            try {
                await api.delete(`/labs/${lab._id}`);
                fetchLabs();
            } catch (error) {
                setActionError(getRequestErrorMessage(error));
            }
        }
    };

    const columns = [
        { key: 'serial', label: 'ID' },
        { key: 'name', label: 'Lab Name' },
        { key: 'equipmentCount', label: 'Computers' },
        { key: 'occupiedSeats', label: 'Occupied Seats' },
        { key: 'status', label: 'Status' },
        { key: 'software', label: 'Software' }
    ];

    return (
        <div className="labs-data-page">
            <div className="page-header">
                <div className="page-heading">
                    <p className="page-kicker">LAB DIRECTORY</p>
                    <h1>Labs</h1>
                    <p>Manage laboratory rooms, capacity, availability, and installed software.</p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={() => { setEditingLab(null); setShowModal(true); }}>➕ Add Lab</button>
                    <button onClick={() => setShowImport(true)}><Upload size={15} aria-hidden="true" /> Import</button>
                    <ExportToCSV data={labs} filename="labs.csv" />
                </div>
            </div>

            {showImport && <ImportDataModal resource="labs" title="labs" onClose={() => setShowImport(false)} onImported={fetchLabs} />}

            <RequestState loading={loading} error={loadError} onRetry={fetchLabs} loadingMessage="Loading lab inventory..." />
            {actionError && <RequestState error={actionError} />}
            {saving && <RequestState loading loadingMessage="Saving lab record..." />}

            <TableWithPagination
                data={labs.map((lab, index) => ({ ...lab, serial: index + 1 }))}
                columns={columns}
                onEdit={(lab) => { setEditingLab(lab); setShowModal(true); }}
                onDelete={handleDelete}
            />

            <ModalForm
                title={editingLab ? 'Edit Lab' : 'Add Lab'}
                fields={[
                    { name: 'name', label: 'Lab Name', type: 'text' },
                    { name: 'equipmentCount', label: 'Number of Computers', type: 'number', min: 0, step: 1 },
                    { name: 'occupiedSeats', label: 'Currently Occupied Seats', type: 'number', min: 0, step: 1, required: false },
                    { name: 'status', label: 'Status', type: 'select', options: ['Available', 'Occupied'] },
                    {name: 'software', label: 'Installed Software', type: 'checkboxes', options: ["ANACONDA3", "DEV C++", "TURBO C++", 
                            "PYTHON", "VS CODE", "JAVA", "JDK", "TALLY PRIME", "GOOGLE CHROME", "R STUDIO", "MYSQL SERVER AND WORKBENCH",
                            "ORACLE VM VIRTUAL BOX", "CISCO PACKET TRACER", "XCODE", "ADOBE READER XI","AUTOCAD 2024", 
                            "LINUX (UBUNTU - CMD BASED)", "WINRAR", "NODEJS", "ECLIPCE IDE","LINUX - UBUNTU", "TABLEAU", "MATLAB R2024b"]}
                ]}
                initialData={editingLab ? { ...editingLab, occupiedSeats: editingLab.occupiedSeats ?? (editingLab.status === 'Occupied' ? editingLab.equipmentCount : 0), _id: undefined } : { software: [], occupiedSeats: 0, status: '' }}
                onSubmit={handleFormSubmit}
                onClose={() => setShowModal(false)}
                show={showModal}
            />

            {labToConfirm && (
                <div className="confirmation-modal">
                    <form
                        className="modal-content"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="lab-confirm-title"
                        onSubmit={(event) => { event.preventDefault(); handleConfirmSave(); }}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter' && event.target.type !== 'button') {
                                event.preventDefault();
                                event.currentTarget.requestSubmit();
                            }
                        }}
                    >
                        <h3 id="lab-confirm-title">Confirm Lab Details</h3>
                        <p><strong>Name:</strong> {labToConfirm.name}</p>
                        <p><strong>Computers:</strong> {labToConfirm.equipmentCount}</p>
                        <p><strong>Occupied seats:</strong> {labToConfirm.occupiedSeats}</p>
                        <p><strong>Status:</strong> {labToConfirm.status}</p>
                        <p><strong>Software:</strong> {Array.isArray(labToConfirm.software) ? labToConfirm.software.join(', ') : ''}</p>
                        <div className="confirmation-actions">
                            <button type="submit" autoFocus disabled={saving}>✅ Confirm &amp; Save</button>
                            <button type="button" onClick={() => setLabToConfirm(null)} disabled={saving}>❌ Cancel</button>
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

export default LabsData;
