import React, { useEffect, useState } from 'react';
import api from '../api';
import './LabStatus.css';

const VacantLabs = () => {
    const [labs, setLabs] = useState([]);
    const [bookings, setBookings] = useState([]);
    const [darkMode, setDarkMode] = useState(false);

    useEffect(() => {
        api.get('/labs').then(res => setLabs(res.data));
        api.get('/bookings').then(res => setBookings(res.data));
    }, []);

    // const toggleDark = () => {
    //     setDarkMode(prev => !prev);
    //     document.body.classList.toggle('dark-mode');
    // };

    const today = new Date().toDateString();
    const bookedLabs = bookings
        .filter(b => new Date(b.start).toDateString() === today)
        .map(b => b.title);

    const vacantLabs = labs.filter(lab => !bookedLabs.includes(lab.name));

    return (
        <div className="lab-status-container">
            {/* <button className="toggle-btn" onClick={toggleDark}>
                {darkMode ? '☀️ Light Mode' : '🌙 Dark Mode'}
            </button> */}
            <h2 className="lab-status-title">Vacant Labs Today</h2>
            {vacantLabs.length > 0 ? (
                <ul className="lab-list">
                    {vacantLabs.map((lab) => (
                        <li key={lab._id}>
                            {lab.name}
                            <span className="lab-badge badge-green">Available</span>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="empty-message">All labs are booked today.</p>
            )}
        </div>
    );
};

export default VacantLabs;
