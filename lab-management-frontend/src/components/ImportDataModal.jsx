import React, { useState } from 'react';
import { FileUp, X } from 'lucide-react';
import api from '../api';
import './ImportDataModal.css';

const ImportDataModal = ({ resource, title, onClose, onImported }) => {
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [summary, setSummary] = useState(null);

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!file) {
            setError('Choose a CSV or Excel file first.');
            return;
        }

        const body = new FormData();
        body.append('file', file);
        setLoading(true);
        setError('');
        try {
            const response = await api.post(`/${resource}/import`, body);
            setSummary(response.data);
            onImported();
        } catch (requestError) {
            setError(requestError.response?.data?.message || 'The file could not be imported.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="import-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
            <section className="import-modal" role="dialog" aria-modal="true" aria-labelledby="import-title">
                <div className="import-modal-heading">
                    <div>
                        <p className="page-kicker">DATA IMPORT</p>
                        <h2 id="import-title">Import {title}</h2>
                    </div>
                    <button className="import-close" type="button" onClick={onClose} aria-label="Close import dialog"><X size={18} /></button>
                </div>

                {summary ? (
                    <div className="import-summary" role="status">
                        <p><strong>{summary.imported}</strong> of {summary.totalRows} rows imported; <strong>{summary.skipped}</strong> skipped.</p>
                        {summary.ignoredColumns.length > 0 && <p>Unmatched columns ignored: {summary.ignoredColumns.join(', ')}</p>}
                        {summary.errors.length > 0 && (
                            <ul>{summary.errors.slice(0, 8).map((item) => <li key={`${item.row}-${item.reason}`}>Row {item.row}: {item.reason}</li>)}</ul>
                        )}
                        {summary.errors.length > 8 && <p>And {summary.errors.length - 8} more skipped rows.</p>}
                        <button className="import-submit" type="button" onClick={onClose}>Done</button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit}>
                        <label className="import-file-picker">
                            <FileUp size={23} aria-hidden="true" />
                            <span>{file ? file.name : 'Choose a CSV or Excel file'}</span>
                            <small>.csv, .xls, .xlsx</small>
                            <input type="file" accept=".csv,.xls,.xlsx" onChange={(event) => { setFile(event.target.files?.[0] || null); setError(''); }} />
                        </label>
                        <p className="import-note">Relevant columns are detected from their headers. Other columns are ignored, and invalid or duplicate rows are reported.</p>
                        {error && <p className="import-error" role="alert">{error}</p>}
                        <div className="import-actions">
                            <button type="button" onClick={onClose} disabled={loading}>Cancel</button>
                            <button className="import-submit" type="submit" disabled={loading || !file}>
                                {loading ? 'Reading file...' : 'Import records'}
                            </button>
                        </div>
                    </form>
                )}
            </section>
        </div>
    );
};

export default ImportDataModal;