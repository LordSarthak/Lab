import React, { useState } from 'react';

const TableWithPagination = ({ data, columns, onEdit, onDelete }) => {
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 5;
    const totalPages = Math.ceil(data.length / itemsPerPage);
    const pageData = data.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    return (
        <div className="table-container">
            <table className="data-table">
                <thead>
                    <tr>
                        {columns.map(c => <th key={c.key}>{c.label}</th>)}
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {pageData.map((row, i) => (
                        <tr key={i}>
                            {columns.map(col => (
                                <td key={col.key}>{Array.isArray(row[col.key]) ? row[col.key].join(', ') : row[col.key]}</td>
                            ))}
                            <td>
                                <button onClick={() => onEdit(row)}>✏️</button>
                                <button onClick={() => onDelete(row)} style={{ marginLeft: "5px" }}>🗑️</button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <div className="pagination">
                <button onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1}>Prev</button>
                <span>Page {currentPage} of {totalPages}</span>
                <button onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages}>Next</button>
            </div>
        </div>
    );
};

export default TableWithPagination;
