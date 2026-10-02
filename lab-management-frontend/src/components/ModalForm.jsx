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

    const handleSubmit = (event) => {
        event.preventDefault();
        onSubmit(formData);
    };

    return (
        <div className="form-modal" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
            <form className="modal-box" onSubmit={handleSubmit} role="dialog" aria-modal="true" aria-labelledby="form-modal-title">
                <h2 id="form-modal-title">{title}</h2>
                {fields.map(field => (
                    <div className="modal-field" key={field.name}>
                        {field.type === 'checkboxes' ? (
                            <fieldset className="checkbox-fieldset">
                                <legend>{field.label}</legend>
                                <div className="checkbox-options">
                                    {field.options.map(opt => (
                                        <label className="checkbox-option" key={opt}>
                                            <input
                                                type="checkbox"
                                                name={field.name}
                                                value={opt}
                                                checked={formData[field.name]?.includes(opt) || false}
                                                onChange={handleChange}
                                            />
                                            {opt}
                                        </label>
                                    ))}
                                </div>
                            </fieldset>
                        ) : (
                            <>
                                <label htmlFor={`modal-${field.name}`}>{field.label}</label>
                                {field.type === 'select' ? (
                                    <select
                                        id={`modal-${field.name}`}
                                        name={field.name}
                                        value={formData[field.name] ?? ''}
                                        onChange={handleChange}
                                        required={field.required !== false}
                                    >
                                        {field.options.map(option => {
                                            const value = typeof option === 'string' ? option : option.value;
                                            const label = typeof option === 'string' ? option : option.label;
                                            return <option key={value} value={value}>{label}</option>;
                                        })}
                                    </select>
                                ) : (
                                    <input
                                        id={`modal-${field.name}`}
                                        name={field.name}
                                        type={field.type}
                                        min={field.min}
                                        step={field.step}
                                        value={formData[field.name] ?? ''}
                                        onChange={handleChange}
                                        required={field.required !== false}
                                    />
                                )}
                            </>
                        )}
                    </div>
                ))}
                <div className="modal-actions">
                    <button type="submit">Save</button>
                    <button type="button" onClick={onClose}>Cancel</button>
                </div>
            </form>
        </div>
    );
};

export default ModalForm;
