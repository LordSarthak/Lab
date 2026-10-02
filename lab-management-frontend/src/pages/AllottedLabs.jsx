import React from 'react';
import { CalendarDays, FlaskConical } from 'lucide-react';
import RequestState from '../components/RequestState';
import useLabSchedule from '../hooks/useLabSchedule';
import './LabStatus.css';

const AllottedLabs = () => {
    const { bookings, labs, loading, error, retry } = useLabSchedule();

    const today = new Date().toDateString();
    const bookedLabs = bookings
        .filter(b => new Date(b.start).toDateString() === today)
        .map(b => b.title);
    const occupiedLabs = labs
        .filter(lab => lab.status === "Occupied")
        .map(lab => lab.name);
    const todaysLabs = [...new Set([...bookedLabs, ...occupiedLabs])];

    return (
        <div className="lab-status-page">
            <div className="page-heading">
                <p className="page-kicker">FACILITY STATUS</p>
                <h1>Allotted labs</h1>
                <p>Today’s scheduled bookings and rooms marked occupied in the lab directory.</p>
            </div>
            <RequestState
                loading={loading}
                error={error}
                onRetry={retry}
                loadingMessage="Checking today's lab status..."
            />
            {!loading && !error && (
                <>
                    <div className="lab-status-summary">
                        <CalendarDays size={18} aria-hidden="true" />
                        <strong>{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</strong>
                        <span>{todaysLabs.length} {todaysLabs.length === 1 ? 'lab' : 'labs'} allotted</span>
                    </div>
                    {todaysLabs.length ? (
                        <ul className="lab-list">
                            {todaysLabs.map((lab) => {
                                const scheduled = bookedLabs.includes(lab);
                                const manuallyOccupied = occupiedLabs.includes(lab);
                                return (
                                    <li key={lab}>
                                        <span className="lab-name"><FlaskConical size={17} aria-hidden="true" />{lab}</span>
                                        <span className={`lab-badge ${scheduled ? 'badge-booked' : 'badge-occupied'}`}>
                                            {scheduled && manuallyOccupied ? 'Booked · Occupied' : scheduled ? 'Booked today' : 'Marked occupied'}
                                        </span>
                                    </li>
                                );
                            })}
                        </ul>
                    ) : <p className="empty-message">No labs are allotted today.</p>}
                </>
            )}
        </div>
    );
};

export default AllottedLabs;
