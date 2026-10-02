import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Pencil, Trash2 } from 'lucide-react';
import './TableWithPagination.css';

const TableWithPagination = ({ data, columns, onEdit, onDelete }) => {
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 5;
    const totalPages = Math.max(1, Math.ceil(data.length / itemsPerPage));
    const pageData = data.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    useEffect(() => {
        setCurrentPage((page) => Math.min(page, totalPages));
    }, [totalPages]);

    return (
        <div className="table-container">
            <table className="data-table">
                <thead>
                    <tr>
                        {columns.map(c => <th key={c.key} scope="col">{c.label}</th>)}
                        <th scope="col">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {pageData.length === 0 ? (
                        <tr>
                            <td className="table-empty" colSpan={columns.length + 1}>No records to display.</td>
                        </tr>
                    ) : pageData.map((row, i) => (
                        <tr key={row._id || row.serial || `${currentPage}-${i}`}>
                            {columns.map(col => (
                                <td key={col.key}>{Array.isArray(row[col.key]) ? row[col.key].join(', ') : row[col.key]}</td>
                            ))}
                            <td className="table-actions">
                                <button type="button" aria-label={`Edit ${row.name || row.email || "record"}`} title="Edit" onClick={() => onEdit(row)}><Pencil size={15} /></button>
                                <button type="button" aria-label={`Delete ${row.name || row.email || "record"}`} title="Delete" onClick={() => onDelete(row)}><Trash2 size={15} /></button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <div className="pagination">
                <span>{data.length ? `${(currentPage - 1) * itemsPerPage + 1}-${Math.min(currentPage * itemsPerPage, data.length)} of ${data.length}` : "0 records"}</span>
                <div className="pagination-controls">
                    <button type="button" aria-label="Previous page" onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1}><ChevronLeft size={17} /></button>
                    <span>Page {currentPage} of {totalPages}</span>
                    <button type="button" aria-label="Next page" onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages}><ChevronRight size={17} /></button>
                </div>
            </div>
        </div>
    );
};

export default TableWithPagination;
