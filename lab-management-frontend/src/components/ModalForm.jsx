import React, { useState, useEffect } from 'react';
import './ModalForm.css';

const ModalForm = ({ title, fields, initialData, onSubmit, onClose, show }) => {
    const [formData, setFormData] = useState(initialData || {});

    useEffect(() => {
        setFormData(initialData || {});
    }, [initialData]);

    if (!show) return null;

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        if (type === 'checkbox' && Array.isArray(formData[name])) {
            setFormData({
                ...formData,
                [name]: checked
                    ? [...formData[name], value]
                    : formData[name].filter(v => v !== value)
            });
        } else {
            setFormData({ ...formData, [name]: value });
        }
    };

    const handleSubmit = () => {
        onSubmit(formData);
    };

    return (
        <div className="modal">
            <div className="modal-box">
                <h2>{title}</h2>
                {fields.map(field => (
                    <div key={field.name}>
                        <label>{field.label}</label><br />
                        {field.type === 'select' ? (
                            <select name={field.name} value={formData[field.name] || ''} onChange={handleChange}>
                                {field.options.map(opt => (
                                    <option key={opt} value={opt}>{opt}</option>
                                ))}
                            </select>
                        ) : field.type === 'checkboxes' ? (
                            field.options.map(opt => (
                                <div key={opt}>
                                    <label>
                                        <input
                                            type="checkbox"
                                            name={field.name}
                                            value={opt}
                                            checked={formData[field.name]?.includes(opt)}
                                            onChange={handleChange}
                                        />
                                        {opt}
                                    </label>
                                </div>
                            ))
                        ) : (
                            <input
                                name={field.name}
                                type={field.type}
                                value={formData[field.name] || ''}
                                onChange={handleChange}
                            />
                        )}
                    </div>
                ))}
                <div style={{ marginTop: "10px" }}>
                    <button onClick={handleSubmit}>✅ Save</button>
                    <button onClick={onClose} style={{ marginLeft: "10px" }}>❌ Cancel</button>
                </div>
            </div>
        </div>
    );
};

export default ModalForm;
