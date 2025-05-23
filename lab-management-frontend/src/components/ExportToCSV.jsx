import React from 'react';

export const ExportToCSV = ({ data, filename }) => {
    const exportCSV = () => {
        if (!data || data.length === 0) return;

        // Remove _id and add serial ID
        const cleanedData = data.map((row, index) => {
            const { _id, ...rest } = row;
            return { ID: index + 1, ...rest };  // Serial ID starts from 1
        });

        const header = Object.keys(cleanedData[0]);
        const rows = cleanedData.map(row => header.map(key => row[key]));

        const csv = [header, ...rows].map(r => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
    };

    return (
        <button onClick={exportCSV}>📁 Export CSV</button>
    );
};
