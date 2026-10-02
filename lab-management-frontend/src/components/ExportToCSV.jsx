import React from 'react';
import { Download } from 'lucide-react';

export const ExportToCSV = ({ data, filename }) => {
    const exportCSV = () => {
        if (!data || data.length === 0) return;

        const cleanedData = data.map((row, index) => {
            const { _id, ...rest } = row;
            return { ID: index + 1, ...rest };
        });

        const header = Object.keys(cleanedData[0]);
        const escapeValue = (value) => {
            const normalized = Array.isArray(value) ? value.join('; ') : String(value ?? '');
            return `"${normalized.replaceAll('"', '""')}"`;
        };
        const rows = cleanedData.map(row => header.map(key => escapeValue(row[key])));
        const csv = [header.map(escapeValue), ...rows].map(row => row.join(',')).join('\r\n');
        const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    };

    return (
        <button type="button" onClick={exportCSV} disabled={!data?.length}>
            <Download size={15} aria-hidden="true" /> Export CSV
        </button>
    );
};
