import React from 'react';
import { CalendarDays, FlaskConical } from 'lucide-react';
import RequestState from '../components/RequestState';
import useLabSchedule from '../hooks/useLabSchedule';
import './LabStatus.css';

const VacantLabs = () => {
    const { labs, bookings, loading, error, retry } = useLabSchedule();

    const today = new Date().toDateString();
    const bookedLabs = bookings
        .filter(b => new Date(b.start).toDateString() === today)
        .map(b => b.title);

    const vacantLabs = labs.filter(
        lab =>
            lab.status === "Available" &&
            !bookedLabs.includes(lab.name)
    );

    return (
        <div className="lab-status-page">
            <div className="page-heading">
                <p className="page-kicker">FACILITY STATUS</p>
                <h1>Vacant labs</h1>
                <p>Rooms marked available that have no booking scheduled for today.</p>
            </div>
            <RequestState
                loading={loading}
                error={error}
                onRetry={retry}
                loadingMessage="Checking today's availability..."
            />
            {!loading && !error && (
                <>
                    <div className="lab-status-summary">
                        <CalendarDays size={18} aria-hidden="true" />
                        <strong>{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</strong>
                        <span>{vacantLabs.length} {vacantLabs.length === 1 ? 'lab' : 'labs'} vacant</span>
                    </div>
                    {vacantLabs.length ? (
                        <ul className="lab-list">
                            {vacantLabs.map((lab) => (
                                <li key={lab._id}>
                                    <span className="lab-name"><FlaskConical size={17} aria-hidden="true" />{lab.name}</span>
                                    <span className="lab-badge badge-available">Available</span>
                                </li>
                            ))}
                        </ul>
                    ) : <p className="empty-message">No labs are available for new bookings today.</p>}
                </>
            )}
        </div>
    );
};

export default VacantLabs;
