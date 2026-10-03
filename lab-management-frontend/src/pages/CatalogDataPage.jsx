import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { ExportToCSV } from '../components/ExportToCSV';
import ImportDataModal from '../components/ImportDataModal';
import ModalForm from '../components/ModalForm';
import RequestState, { getRequestErrorMessage } from '../components/RequestState';
import TableWithPagination from '../components/TableWithPagination';
import { Upload } from 'lucide-react';
import './RecordPages.css';

const DEPARTMENT_FIELDS = [
    { name: 'name', label: 'Department Name', type: 'text' },
    { name: 'code', label: 'Department Code', type: 'text' },
    { name: 'description', label: 'Description', type: 'text', required: false },
];

const CATALOG_CONFIG = {
    departments: {
        title: 'Departments',
        itemName: 'department',
        kicker: 'ACADEMIC STRUCTURE',
        description: 'Manage academic departments, codes, and descriptions.',
        filename: 'departments.csv',
        loadingMessage: 'Loading departments...',
        columns: [
            { key: 'serial', label: 'ID' },
            { key: 'name', label: 'Department' },
            { key: 'code', label: 'Code' },
            { key: 'description', label: 'Description' },
        ],
        fields: DEPARTMENT_FIELDS,
        defaults: {},
        confirmationFields: [
            ['name', 'Department'],
            ['code', 'Code'],
            ['description', 'Description'],
        ],
    },
    courses: {
        title: 'Courses',
        itemName: 'course',
        kicker: 'ACADEMIC CATALOG',
        description: 'Manage courses, department assignments, and credit values.',
        filename: 'courses.csv',
        loadingMessage: 'Loading courses...',
        columns: [
            { key: 'serial', label: 'ID' },
            { key: 'name', label: 'Course' },
            { key: 'code', label: 'Code' },
            { key: 'department', label: 'Department' },
            { key: 'credits', label: 'Credits' },
        ],
        defaults: { credits: 3 },
        confirmationFields: [
            ['name', 'Course'],
            ['code', 'Code'],
            ['department', 'Department'],
            ['credits', 'Credits'],
        ],
    },
};

const CatalogDataPage = ({ kind }) => {
    const config = CATALOG_CONFIG[kind];
    const isCourse = kind === 'courses';
    const [records, setRecords] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [reload, setReload] = useState(0);
    const [showModal, setShowModal] = useState(false);
    const [showImport, setShowImport] = useState(false);
    const [editingRecord, setEditingRecord] = useState(null);
    const [recordToConfirm, setRecordToConfirm] = useState(null);
    const [toastMessage, setToastMessage] = useState('');
    const [showDepartmentPrerequisite, setShowDepartmentPrerequisite] = useState(false);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(null);
    const [actionError, setActionError] = useState(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        let isCurrent = true;
        setLoading(true);
        setLoadError(null);
        const requests = isCourse
            ? [api.get('/courses'), api.get('/departments')]
            : [api.get('/departments')];

        Promise.all(requests)
            .then(([recordsResponse, departmentsResponse]) => {
                if (!isCurrent) return;
                setRecords(recordsResponse.data);
                if (isCourse) {
                    setDepartments(departmentsResponse.data);
                    if (departmentsResponse.data.length > 0) setShowDepartmentPrerequisite(false);
                }
            })
            .catch(error => { if (isCurrent) setLoadError(error); })
            .finally(() => { if (isCurrent) setLoading(false); });

        return () => { isCurrent = false; };
    }, [isCourse, reload]);

    const refresh = () => setReload(current => current + 1);
    const handleAddRecord = () => {
        if (isCourse && departments.length === 0) {
            setShowDepartmentPrerequisite(true);
            return;
        }
        setShowDepartmentPrerequisite(false);
        setEditingRecord(null);
        setShowModal(true);
    };

    const fields = isCourse
        ? [
            { name: 'name', label: 'Course Name', type: 'text' },
            { name: 'code', label: 'Course Code', type: 'text' },
            {
                name: 'department',
                label: 'Department',
                type: 'select',
                options: departments.map(department => ({
                    value: department._id,
                    label: `${department.name}${department.code ? ` (${department.code})` : ''}`,
                })),
            },
            { name: 'credits', label: 'Credits', type: 'number', min: 0.5, step: 0.5 },
        ]
        : config.fields;

    const handleFormSubmit = (formData) => {
        const name = formData.name?.trim();
        const code = formData.code?.trim().toUpperCase();
        if (!name || !code) {
            alert(`${config.title.slice(0, -1)} name and code are required.`);
            return;
        }

        let record = { name, code };
        if (isCourse) {
            const selectedDepartment = String(formData.department ?? '').trim();
            const department = departments.find(item =>
                String(item._id) === selectedDepartment ||
                (typeof item.name === 'string' && item.name.toLowerCase() === selectedDepartment.toLowerCase())
            );
            const credits = Number(formData.credits);
            if (!department) {
                alert('Choose a department from the department list.');
                return;
            }
            if (!Number.isFinite(credits) || credits <= 0) {
                alert('Credits must be a positive number.');
                return;
            }
            record = { ...record, department: department.name, credits };
        } else {
            record.description = formData.description?.trim() || '';
        }

        const duplicateName = records.find(item =>
            item._id !== editingRecord?._id && item.name?.trim().toLowerCase() === name.toLowerCase()
        );
        if (duplicateName) {
            alert(`${config.itemName[0].toUpperCase() + config.itemName.slice(1)} name "${name}" already exists. Enter a different name.`);
            return;
        }

        const duplicateCode = records.find(item =>
            item._id !== editingRecord?._id && item.code?.trim().toLowerCase() === code.toLowerCase()
        );
        if (duplicateCode) {
            alert(`${config.itemName[0].toUpperCase() + config.itemName.slice(1)} code "${code}" is already in use. Enter a different code.`);
            return;
        }

        setRecordToConfirm(record);
    };

    const initialData = useMemo(() => {
        if (!editingRecord) return config.defaults;
        if (!isCourse) return { ...editingRecord, _id: undefined };
        const department = departments.find(item =>
            typeof item.name === 'string' &&
            item.name.toLowerCase() === String(editingRecord.department || '').toLowerCase()
        );
        return {
            ...editingRecord,
            department: department?._id || '',
            _id: undefined,
        };
    }, [config.defaults, departments, editingRecord, isCourse]);

    const handleConfirmSave = async () => {
        if (saving) return;
        setSaving(true);
        setActionError(null);
        try {
            if (editingRecord) {
                await api.put(`/${kind}/${editingRecord._id}`, recordToConfirm);
            } else {
                await api.post(`/${kind}`, recordToConfirm);
            }
            setShowModal(false);
            setEditingRecord(null);
            setRecordToConfirm(null);
            setToastMessage(`${config.title.slice(0, -1)} saved successfully.`);
            refresh();
            setTimeout(() => setToastMessage(''), 3000);
        } catch (error) {
            setActionError(getRequestErrorMessage(error));
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (record) => {
        if (!window.confirm(`Delete "${record.name}"?`)) return;
        setActionError(null);
        try {
            await api.delete(`/${kind}/${record._id}`);
            refresh();
        } catch (error) {
            setActionError(getRequestErrorMessage(error));
        }
    };

    return (
        <div className="catalog-data-page">
            <div className="page-header">
                <div className="page-heading">
                    <p className="page-kicker">{config.kicker}</p>
                    <h1>{config.title}</h1>
                    <p>{config.description}</p>
                </div>
                <div>
                    <button
                        type="button"
                        onClick={handleAddRecord}
                        disabled={isCourse && (loading || Boolean(loadError))}
                    >
                        + Add {config.itemName[0].toUpperCase() + config.itemName.slice(1)}
                    </button>
                    <button type="button" onClick={() => setShowImport(true)}><Upload size={15} aria-hidden="true" /> Import</button>
                    <ExportToCSV data={records} filename={config.filename} />
                </div>
            </div>

            {isCourse && departments.length === 0 && showDepartmentPrerequisite && (
                <p className="catalog-prerequisite" role="alert">
                    Add a department before creating courses. <Link to="/departments">Manage departments</Link>
                </p>
            )}
            {showImport && <ImportDataModal resource={kind} title={config.title.toLowerCase()} onClose={() => setShowImport(false)} onImported={refresh} />}

            <RequestState loading={loading} error={loadError} onRetry={refresh} loadingMessage={config.loadingMessage} />
            {actionError && <RequestState error={actionError} />}
            {saving && <RequestState loading loadingMessage={`Saving ${config.itemName}...`} />}

            <TableWithPagination
                data={records.map((record, index) => ({ ...record, serial: index + 1 }))}
                columns={config.columns}
                onEdit={(record) => { setEditingRecord(record); setShowModal(true); }}
                onDelete={handleDelete}
            />

            <ModalForm
                title={`${editingRecord ? 'Edit' : 'Add'} ${config.itemName[0].toUpperCase() + config.itemName.slice(1)}`}
                fields={fields}
                initialData={initialData}
                onSubmit={handleFormSubmit}
                onClose={() => setShowModal(false)}
                show={showModal}
            />

            {recordToConfirm && (
                <div className="confirmation-modal">
                    <form
                        className="modal-content"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="catalog-confirm-title"
                        onSubmit={(event) => { event.preventDefault(); handleConfirmSave(); }}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter' && event.target.type !== 'button') {
                                event.preventDefault();
                                event.currentTarget.requestSubmit();
                            }
                        }}
                    >
                        <h3 id="catalog-confirm-title">Confirm {config.itemName} details</h3>
                        {config.confirmationFields.map(([key, label]) => (
                            <p key={key}><strong>{label}:</strong> {recordToConfirm[key] || 'Not provided'}</p>
                        ))}
                        <div className="confirmation-actions">
                            <button type="submit" autoFocus disabled={saving}>Confirm &amp; Save</button>
                            <button type="button" onClick={() => setRecordToConfirm(null)} disabled={saving}>Cancel</button>
                        </div>
                    </form>
                </div>
            )}

            {toastMessage && <div className="toast-message success" role="status">{toastMessage}</div>}
        </div>
    );
};

export default CatalogDataPage;