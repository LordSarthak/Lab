import React, { useEffect, useState } from 'react';
import api from '../api';
import './LabStatus.css';

const AllottedLabs = () => {
    const [bookings, setBookings] = useState([]);
    const [darkMode, setDarkMode] = useState(false);

    useEffect(() => {
        api.get('/bookings').then(res => setBookings(res.data));
    }, []);

    // const toggleDark = () => {
    //     setDarkMode(prev => !prev);
    //     document.body.classList.toggle('dark-mode');
    // };

    const today = new Date().toDateString();
    const todaysLabs = [...new Set(
        bookings.filter(b => new Date(b.start).toDateString() === today).map(b => b.title)
    )];

    return (
        <div className="lab-status-container">
            {/* <button className="toggle-btn" onClick={toggleDark}>
                {darkMode ? '☀️ Light Mode' : '🌙 Dark Mode'}
            </button> */}
            <h2 className="lab-status-title">Labs Allotted Today</h2>
            {todaysLabs.length > 0 ? (
                <ul className="lab-list">
                    {todaysLabs.map((lab, index) => (
                        <li key={index}>
                            {lab}
                            <span className="lab-badge badge-red">Allotted</span>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="empty-message">No labs allotted today.</p>
            )}
        </div>
    );
};

export default AllottedLabs;
