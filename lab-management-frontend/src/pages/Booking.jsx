import React, { useEffect, useRef, useState } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import format from 'date-fns/format';
import parse from 'date-fns/parse';
import startOfWeek from 'date-fns/startOfWeek';
import getDay from 'date-fns/getDay';
import addWeeks from 'date-fns/addWeeks';
import isEqual from 'date-fns/isEqual';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { FiDownload, FiTrash2, FiPlus } from 'react-icons/fi';
import api from '../api';
import './Booking.css';

const locales = { 'en-US': require('date-fns/locale/en-US') };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

const LAB_COLORS = {
    'Lab A': '#4caf50',
    'Lab B': '#2196f3',
    'Lab C': '#f59e0b',
    'Lab D': '#a855f7',
    'Lab E': '#ef4444',
};

const timeOptions = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00'];
const defaultDuration = 60;

function parseTimeToDate(timeStr, date = new Date()) {
    const [hour, minute] = timeStr.split(':').map(Number);
    const result = new Date(date);
    result.setHours(hour, minute, 0, 0);
    return result;
}

function formatTime(date) {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function formatInputDateOnly(date) {
    return new Date(date).toISOString().split('T')[0];
}

function isOverlapping(startA, endA, startB, endB) {
    return startA < endB && startB < endA;
}

export default function Booking() {
    const [events, setEvents] = useState([]);
    const [filteredLab, setFilteredLab] = useState('All');
    const [selectedSlot, setSelectedSlot] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [currentDate, setCurrentDate] = useState(new Date());
    const dropdownRef = useRef(null);

    const [formData, setFormData] = useState({
        title: '',
        date: new Date(),
        start: parseTimeToDate('09:00'),
        duration: defaultDuration,
        end: new Date(parseTimeToDate('09:00').getTime() + defaultDuration * 60000),
        recurring: false
    });

    useEffect(() => {
        fetchBookings();
    }, []);

    const fetchBookings = () => {
        api.get('/bookings').then(res => {
            const bookings = res.data.map(ev => ({
                ...ev,
                start: new Date(ev.start),
                end: new Date(ev.end)
            }));
            setEvents(bookings);
        });
    };

    const handleSelectSlot = () => {
        const start = parseTimeToDate('09:00');
        const end = new Date(start.getTime() + defaultDuration * 60000);
        setFormData({ title: '', date: new Date(), start, end, duration: defaultDuration, recurring: false });
        setSelectedSlot(true);
        setSelectedEvent(null);
    };

    const handleSelectEvent = (event) => {
        setFormData({
            title: event.title,
            date: new Date(event.start),
            start: event.start,
            end: event.end,
            duration: Math.round((event.end - event.start) / 60000),
            recurring: false
        });
        setSelectedSlot(false);
        setSelectedEvent(event);
    };

    const handleClose = () => {
        setSelectedSlot(false);
        setSelectedEvent(null);
    };

    const isConflict = (newStart, newEnd, lab, skipEvent = null) => {
        return events.some(ev =>
            ev.title === lab &&
            (!skipEvent || !isEqual(ev.start, skipEvent.start)) &&
            isOverlapping(newStart, newEnd, ev.start, ev.end)
        );
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const newEvents = [];
        const baseStart = new Date(formData.start);
        const baseEnd = new Date(formData.end);
        const title = formData.title;

        if (isConflict(baseStart, baseEnd, title, selectedEvent)) {
            alert('Conflict: This lab is already booked during that time.');
            return;
        }

        if (formData.recurring) {
            for (let i = 0; i < 4; i++) {
                const recurStart = addWeeks(baseStart, i);
                const recurEnd = addWeeks(baseEnd, i);
                if (!isConflict(recurStart, recurEnd, title, selectedEvent)) {
                    newEvents.push({ title, start: recurStart, end: recurEnd });
                }
            }
        } else {
            newEvents.push({ title, start: baseStart, end: baseEnd });
        }

        // Handle update
        if (selectedEvent) {
            await api.delete(`/bookings/${selectedEvent._id}`);
        }

        for (const event of newEvents) {
            await api.post('/bookings', event);
        }

        fetchBookings();
        handleClose();
    };

    const handleDelete = async () => {
        if (selectedEvent && selectedEvent._id) {
            await api.delete(`/bookings/${selectedEvent._id}`);
            fetchBookings();
        }
        handleClose();
    };

    const clearAllBookings = () => {
        if (window.confirm('Clear all lab slots?')) {
            Promise.all(events.map(ev => api.delete(`/bookings/${ev._id}`))).then(() => {
                setEvents([]);
            });
        }
    };

    const exportToCSV = () => {
        const header = ['Lab', 'Start', 'End'];
        const rows = events.map(ev => [
            ev.title,
            new Date(ev.start).toLocaleString(),
            new Date(ev.end).toLocaleString(),
        ]);
        const csv = [header, ...rows].map(r => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'lab-bookings.csv';
        link.click();
    };

    const filteredEvents = filteredLab === 'All'
        ? events
        : events.filter(e => e.title === filteredLab);

    const eventStyleGetter = (event) => {
        const bgColor = LAB_COLORS[event.title] || '#6366f1';
        return {
            style: {
                backgroundColor: bgColor,
                color: 'white',
                borderRadius: '4px',
                padding: '2px 4px',
                fontSize: '13px',
            },
        };
    };

    const labs = Array.from(new Set(events.map(e => e.title)));
    const minTime = parseTimeToDate('09:00');
    const maxTime = parseTimeToDate('16:00');

    return (
        <div className="container">
            <h2 className="title">Lab Time Table</h2>

            <div className="controls">
                <div className="desktopControls">
                    <select value={filteredLab} onChange={(e) => setFilteredLab(e.target.value)}>
                        <option value="All">All Labs</option>
                        {labs.map(lab => (
                            <option key={lab} value={lab}>{lab}</option>
                        ))}
                    </select>

                    <button onClick={exportToCSV}>
                        <FiDownload style={{ marginRight: '6px' }} />
                        Export CSV
                    </button>

                    <button onClick={clearAllBookings}>
                        <FiTrash2 style={{ marginRight: '6px' }} />
                        Clear All
                    </button>

                    <button onClick={handleSelectSlot}>
                        <FiPlus style={{ marginRight: '6px' }} />
                        Add Booking
                    </button>
                </div>
            </div>

            <Calendar
                localizer={localizer}
                events={filteredEvents}
                defaultView="week"
                date={currentDate}
                onNavigate={setCurrentDate}
                views={['week', 'day']}
                step={60}
                timeslots={1}
                selectable
                style={{ height: '75vh' }}
                min={minTime}
                max={maxTime}
                onSelectEvent={handleSelectEvent}
                eventPropGetter={eventStyleGetter}
            />

            {(selectedSlot || selectedEvent) && (
                <div className="modal">
                    <form className="modalContent" onSubmit={handleSubmit}>
                        <h3>{selectedEvent ? 'Edit Booking' : 'Add Booking'}</h3>

                        <label>Lab Name:</label>
                        <input
                            type="text"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            required
                        />

                        <label>Date:</label>
                        <input
                            type="date"
                            value={formatInputDateOnly(formData.date)}
                            onChange={(e) => {
                                const selectedDate = new Date(e.target.value);
                                const newStart = parseTimeToDate(formatTime(formData.start), selectedDate);
                                const newEnd = new Date(newStart.getTime() + formData.duration * 60000);
                                setFormData({ ...formData, date: selectedDate, start: newStart, end: newEnd });
                            }}
                            required
                        />

                        <label>Start Time:</label>
                        <select
                            value={formatTime(formData.start)}
                            onChange={(e) => {
                                const newStart = parseTimeToDate(e.target.value, formData.date);
                                const newEnd = new Date(newStart.getTime() + formData.duration * 60000);
                                setFormData({ ...formData, start: newStart, end: newEnd });
                            }}
                        >
                            {timeOptions.map(t => (
                                <option key={t} value={t}>{t}</option>
                            ))}
                        </select>

                        <label>Duration:</label>
                        <select
                            value={formData.duration}
                            onChange={(e) => {
                                const duration = parseInt(e.target.value);
                                const newEnd = new Date(formData.start.getTime() + duration * 60000);
                                setFormData({ ...formData, duration, end: newEnd });
                            }}
                        >
                            <option value={60}>1 hour</option>
                            <option value={90}>1.5 hours</option>
                        </select>

                        <label>
                            <input
                                type="checkbox"
                                checked={formData.recurring}
                                onChange={(e) => setFormData({ ...formData, recurring: e.target.checked })}
                            /> Repeat weekly for 4 weeks
                        </label>

                        <div className="actions">
                            <button type="submit">Save</button>
                            {selectedEvent && <button type="button" onClick={handleDelete}>Delete</button>}
                            <button type="button" onClick={handleClose}>Cancel</button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
