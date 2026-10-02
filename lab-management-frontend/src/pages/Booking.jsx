import React, { useEffect, useState } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import format from 'date-fns/format';
import parse from 'date-fns/parse';
import startOfWeek from 'date-fns/startOfWeek';
import getDay from 'date-fns/getDay';
import addWeeks from 'date-fns/addWeeks';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { FiDownload, FiEdit2, FiTrash2, FiPlus } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import api from '../api';
import RequestState, { getRequestErrorMessage } from '../components/RequestState';
import './Booking.css';

const locales = { 'en-US': require('date-fns/locale/en-US') };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

const timeOptions = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00'];
const startTimeOptions = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00'];
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
    const value = new Date(date);
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

function parseInputDateOnly(value) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
}

function isOverlapping(startA, endA, startB, endB) {
    return startA < endB && startB < endA;
}

export default function Booking() {
    const [events, setEvents] = useState([]);
    const [labs, setLabs] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [courses, setCourses] = useState([]);
    const [filteredLab, setFilteredLab] = useState('All');
    const [filteredDepartment, setFilteredDepartment] = useState('All');
    const [filteredCourse, setFilteredCourse] = useState('All');
    const [selectedSlot, setSelectedSlot] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [calendarView, setCalendarView] = useState('week');
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(null);
    const [actionError, setActionError] = useState(null);
    const [saving, setSaving] = useState(false);
    const [reload, setReload] = useState(0);

    const [formData, setFormData] = useState({
        title: '',
        date: new Date(),
        start: parseTimeToDate('09:00'),
        duration: defaultDuration,
        end: new Date(parseTimeToDate('09:00').getTime() + defaultDuration * 60000),
        seats: 1,
        recurring: false
    });

    useEffect(() => {
        let isCurrent = true;
        setLoading(true);
        setLoadError(null);
        Promise.all([api.get('/bookings'), api.get('/labs'), api.get('/departments'), api.get('/courses')])
            .then(([bookingResponse, labResponse, departmentResponse, courseResponse]) => {
                if (!isCurrent) return;
                setEvents(bookingResponse.data.map(ev => ({
                    ...ev,
                    start: new Date(ev.start),
                    end: new Date(ev.end)
                })));
                setLabs(labResponse.data);
                setDepartments(departmentResponse.data);
                setCourses(courseResponse.data);
            })
            .catch(error => { if (isCurrent) setLoadError(error); })
            .finally(() => { if (isCurrent) setLoading(false); });
        return () => { isCurrent = false; };
    }, [reload]);

    const handleSelectSlot = (slotInfo = null) => {
        const start = slotInfo?.start ? new Date(slotInfo.start) : parseTimeToDate('09:00');
        const end = new Date(start.getTime() + defaultDuration * 60000);
        setFormData({ title: '', department: '', course: '', date: new Date(start), start, end, duration: defaultDuration, seats: 1, recurring: false });
        setSelectedSlot(true);
        setSelectedEvent(null);
    };

    const handleSelectEvent = (event) => {
        setFormData({
            title: event.title,
            department: event.department || '',
            course: event.course || '',
            date: new Date(event.start),
            start: event.start,
            end: event.end,
            duration: Math.round((event.end - event.start) / 60000),
            seats: event.seats || 1,
            recurring: false
        });
        setSelectedSlot(false);
        setSelectedEvent(event);
    };

    const handleClose = () => {
        setSelectedSlot(false);
        setSelectedEvent(null);
    };

    const getAvailableSeats = (lab, start, end, skipEvent = null) => {
        const labData = labs.find(item => item.name === lab);
        if (!labData) return 0;

        const capacity = Number(labData.equipmentCount) || 0;
        const occupiedSeats = labData.occupiedSeats == null && labData.status === 'Occupied'
            ? capacity
            : Number(labData.occupiedSeats) || 0;
        const reservedSeats = events.reduce((total, event) => {
            if (event.title !== lab || (skipEvent && event._id === skipEvent._id) || !isOverlapping(start, end, event.start, event.end)) {
                return total;
            }
            return total + (Number(event.seats) || 1);
        }, 0);

        return Math.max(0, capacity - occupiedSeats - reservedSeats);
    };

    const requestedSeats = Number(formData.seats) || 1;
    const labsWithSeats = labs
        .map(lab => ({ ...lab, seatsLeft: getAvailableSeats(lab.name, formData.start, formData.end, selectedEvent) }))
        .filter(lab => lab.seatsLeft > 0);
    const selectedLab = labs.find(lab => lab.name === filteredLab);
    const selectedLabEvents = selectedLab
        ? events.filter(event => event.title === selectedLab.name).sort((first, second) => first.start - second.start)
        : [];
    const selectedLabAvailability = selectedLab
        ? timeOptions.map(time => {
            const start = parseTimeToDate(time, currentDate);
            const end = new Date(start.getTime() + defaultDuration * 60000);
            return { time, seatsLeft: getAvailableSeats(selectedLab.name, start, end) };
        }).filter(slot => slot.seatsLeft > 0)
        : [];
    const startExceedsHours = (value, duration = Number(formData.duration)) => {
        const [hour, minute] = value.split(':').map(Number);
        return hour * 60 + minute + duration > 16 * 60;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const newEvents = [];
        const baseStart = new Date(formData.start);
        const baseEnd = new Date(formData.end);
        const title = formData.title;
        const seats = Number(formData.seats);

        if (baseStart.getHours() < 9 || baseEnd.getHours() > 16 || (baseEnd.getHours() === 16 && baseEnd.getMinutes() > 0)) {
            setActionError('Bookings must fit between 9:00 AM and 4:00 PM.');
            return;
        }

        setSaving(true);
        setActionError(null);
        try {
            if (!title.trim()) {
                setActionError('Choose a lab from the lab directory.');
                return;
            }
            if (!Number.isInteger(seats) || seats < 1) {
                setActionError('Enter a positive whole number of students.');
                return;
            }

            const occurrenceCount = formData.recurring ? 4 : 1;
            for (let i = 0; i < occurrenceCount; i++) {
                const start = addWeeks(baseStart, i);
                const end = addWeeks(baseEnd, i);
                if (getAvailableSeats(title, start, end, selectedEvent) < seats) {
                    setActionError(`Not enough seats remain in ${title} for ${start.toLocaleDateString()}. Choose another lab or time.`);
                    return;
                }
                newEvents.push({
                    title,
                    start,
                    end,
                    seats,
                    department: formData.department || '',
                    course: formData.course || '',
                });
            }

            if (!labs.some(lab => lab.name === title)) {
                setActionError('Choose a lab from the lab directory.');
                return;
            }

            if (selectedEvent) {
                await api.put(`/bookings/${selectedEvent._id}`, newEvents[0]);
            }
            for (const event of newEvents.slice(selectedEvent ? 1 : 0)) {
                await api.post('/bookings', event);
            }
            setReload(current => current + 1);
            handleClose();
        } catch (error) {
            setActionError(getRequestErrorMessage(error));
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (selectedEvent && selectedEvent._id) {
            setSaving(true);
            setActionError(null);
            try {
                await api.delete(`/bookings/${selectedEvent._id}`);
                setReload(current => current + 1);
                handleClose();
            } catch (error) {
                setActionError(getRequestErrorMessage(error));
            } finally {
                setSaving(false);
            }
        }
    };

    const removeBooking = async (event) => {
        if (!event?._id || !window.confirm(`Remove the ${event.title} booking on ${event.start.toLocaleString()}?`)) return;

        setSaving(true);
        setActionError(null);
        try {
            await api.delete(`/bookings/${event._id}`);
            setReload(current => current + 1);
            if (selectedEvent?._id === event._id) handleClose();
        } catch (error) {
            setActionError(getRequestErrorMessage(error));
        } finally {
            setSaving(false);
        }
    };

    const clearAllBookings = async () => {
        if (window.confirm('Clear all lab slots?')) {
            setSaving(true);
            setActionError(null);
            try {
                await Promise.all(events.map(ev => api.delete(`/bookings/${ev._id}`)));
                setEvents([]);
            } catch (error) {
                setActionError(getRequestErrorMessage(error));
            } finally {
                setSaving(false);
            }
        }
    };

    const exportToCSV = () => {
        const header = ['Lab', 'Department', 'Course', 'Start', 'End', 'Seats'];
        const rows = events.map(ev => [
            ev.title,
            ev.department || '',
            ev.course || '',
            new Date(ev.start).toLocaleString(),
            new Date(ev.end).toLocaleString(),
            ev.seats || 1,
        ]);
        const csv = [header, ...rows].map(r => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'lab-bookings.csv';
        link.click();
    };

    const filteredEvents = events.filter(event =>
        (filteredLab === 'All' || event.title === filteredLab) &&
        (filteredDepartment === 'All' || event.department === filteredDepartment) &&
        (filteredCourse === 'All' || event.course === filteredCourse)
    );
    const availableCourses = courses.filter(course =>
        filteredDepartment === 'All' || course.department === filteredDepartment
    );
    const bookingCourses = courses.filter(course =>
        !formData.department || course.department === formData.department
    );

    const eventStyleGetter = (event) => {
        return {
            style: {
                backgroundColor: 'var(--green)',
                color: 'white',
                borderRadius: '4px',
                boxShadow: 'inset 4px 0 0 var(--gold)',
                padding: '10px 8px 7px 12px',
                fontSize: '13px',
            },
        };
    };

    const minTime = parseTimeToDate('09:00');
    const maxTime = parseTimeToDate('16:00');

    return (
        <div className="booking-page">
            <div className="page-heading">
                <p className="page-kicker">SCHEDULING</p>
                <h1>Lab Time Table</h1>
                <p>Coordinate room bookings across the campus laboratory schedule.</p>
            </div>
            <RequestState loading={loading} error={loadError} onRetry={() => setReload(current => current + 1)} loadingMessage="Loading the timetable and lab availability..." />
            {actionError && <RequestState error={actionError} />}
            {saving && <RequestState loading loadingMessage="Updating bookings..." />}

            <div className="controls">
                <div className="desktopControls">
                    <select value={filteredLab} onChange={(e) => setFilteredLab(e.target.value)}>
                        <option value="All">All Labs</option>
                        {labs.map(lab => (
                            <option key={lab._id} value={lab.name}>{lab.name}</option>
                        ))}
                    </select>

                    <select aria-label="Filter by department" value={filteredDepartment} onChange={(e) => { setFilteredDepartment(e.target.value); setFilteredCourse('All'); }}>
                        <option value="All">All Departments</option>
                        {departments.map(department => <option key={department._id} value={department.name}>{department.name}</option>)}
                    </select>

                    <select aria-label="Filter by course" value={filteredCourse} onChange={(e) => setFilteredCourse(e.target.value)}>
                        <option value="All">All Courses</option>
                        {availableCourses.map(course => <option key={course._id} value={course.name}>{course.name}</option>)}
                    </select>

                    <button className="export-bookings-button" onClick={exportToCSV}>
                        <FiDownload style={{ marginRight: '6px' }} />
                        Export CSV
                    </button>

                    <button className="clear-bookings-button" onClick={clearAllBookings} disabled={!events.length || saving}>
                        <FiTrash2 style={{ marginRight: '6px' }} />
                        Clear All
                    </button>

                    <button className="add-booking-button" onClick={() => handleSelectSlot()} disabled={saving}>
                        <FiPlus style={{ marginRight: '6px' }} />
                        Add Booking
                    </button>
                </div>
            </div>

            {selectedLab && (
                <section className="selected-lab-panel" aria-labelledby="selected-lab-title">
                    <div className="selected-lab-heading">
                        <div>
                            <p className="page-kicker">LAB DETAILS</p>
                            <h2 id="selected-lab-title">{selectedLab.name}</h2>
                        </div>
                        <span className={`lab-status-pill ${selectedLab.status === 'Available' ? 'is-available' : 'is-occupied'}`}>
                            {selectedLab.status || 'Status not set'}
                        </span>
                    </div>

                    <dl className="lab-details-grid">
                        {Object.entries(selectedLab)
                            .filter(([key]) => key !== '_id' && key !== 'software' && key !== 'status')
                            .map(([key, value]) => (
                                <div key={key}>
                                    <dt>{key.replace(/([A-Z])/g, ' $1').replace(/^./, character => character.toUpperCase())}</dt>
                                    <dd>{Array.isArray(value) ? value.join(', ') : value == null ? 'Not set' : typeof value === 'object' ? JSON.stringify(value) : String(value)}</dd>
                                </div>
                            ))}
                    </dl>

                    {Array.isArray(selectedLab.software) && selectedLab.software.length > 0 && (
                        <div className="lab-software-details">
                            <h3>Installed software</h3>
                            <ul>
                                {selectedLab.software.map(software => <li key={software}>{software}</li>)}
                            </ul>
                        </div>
                    )}

                    <div className="lab-schedule-grid">
                        <div>
                            <div className="lab-section-heading">
                                <h3>Available times</h3>
                                <span>{currentDate.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
                            </div>
                            {selectedLabAvailability.length ? (
                                <ul className="lab-availability-list">
                                    {selectedLabAvailability.map(slot => (
                                        <li key={slot.time}>
                                            <span>{slot.time} - {formatTime(new Date(parseTimeToDate(slot.time, currentDate).getTime() + defaultDuration * 60000))}</span>
                                            <strong>{slot.seatsLeft} seat{slot.seatsLeft === 1 ? '' : 's'}</strong>
                                        </li>
                                    ))}
                                </ul>
                            ) : <p className="lab-panel-empty">No one-hour slots with seats are available on this date.</p>}
                        </div>

                        <div>
                            <div className="lab-section-heading">
                                <h3>Allotted bookings</h3>
                                <span>{selectedLabEvents.length}</span>
                            </div>
                            {selectedLabEvents.length ? (
                                <ul className="lab-booking-list">
                                    {selectedLabEvents.map(event => (
                                        <li key={event._id}>
                                            <div>
                                                <strong>{event.start.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</strong>
                                                <span>{formatTime(event.start)} - {formatTime(event.end)} · {Number(event.seats) || 1} seat{(Number(event.seats) || 1) === 1 ? '' : 's'}</span>
                                                {(event.department || event.course) && <span>{[event.department, event.course].filter(Boolean).join(' · ')}</span>}
                                            </div>
                                            <div className="booking-item-actions">
                                                <button type="button" className="edit-booking-button" title="Edit this booking" aria-label={`Edit booking on ${event.start.toLocaleDateString()}`} onClick={() => handleSelectEvent(event)} disabled={saving}>
                                                    <FiEdit2 aria-hidden="true" />
                                                </button>
                                                <button type="button" className="remove-booking-button" title="Remove this booking" aria-label={`Remove booking on ${event.start.toLocaleDateString()}`} onClick={() => removeBooking(event)} disabled={saving}>
                                                    <FiTrash2 aria-hidden="true" />
                                                </button>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            ) : <p className="lab-panel-empty">No bookings have been allotted to this lab.</p>}
                        </div>
                    </div>
                </section>
            )}

            <Calendar
                localizer={localizer}
                events={filteredEvents}
                defaultView="week"
                view={calendarView}
                onView={setCalendarView}
                date={currentDate}
                onNavigate={setCurrentDate}
                views={['week', 'day']}
                dayLayoutAlgorithm="no-overlap"
                step={60}
                timeslots={1}
                selectable
                style={{ height: '75vh' }}
                min={minTime}
                max={maxTime}
                onSelectEvent={handleSelectEvent}
                onSelectSlot={handleSelectSlot}
                tooltipAccessor={event => [event.title, event.department, event.course].filter(Boolean).join(' · ')}
                eventPropGetter={eventStyleGetter}
            />

            {(selectedSlot || selectedEvent) && (
                <div className="booking-modal" onMouseDown={(event) => event.target === event.currentTarget && handleClose()}>
                    <form className="modalContent" onSubmit={handleSubmit}>
                        <h3>{selectedEvent ? 'Edit Booking' : 'Add Booking'}</h3>

                        <label>Lab Name:</label>
                        <select
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            required
                        >
                            <option value="">Choose a lab</option>
                            {labs.map(lab => {
                                const seatsLeft = getAvailableSeats(lab.name, formData.start, formData.end, selectedEvent);
                                return <option key={lab._id} value={lab.name} disabled={seatsLeft < requestedSeats}>
                                    {lab.name} ({seatsLeft} seat{seatsLeft === 1 ? '' : 's'} left)
                                </option>;
                            })}
                        </select>

                        <label>Department (optional):</label>
                        <select
                            value={formData.department || ''}
                            onChange={(e) => {
                                const department = e.target.value;
                                const course = courses.find(item => item.name === formData.course);
                                setFormData({ ...formData, department, course: course?.department === department ? formData.course : '' });
                            }}
                        >
                            <option value="">No department association</option>
                            {departments.map(department => <option key={department._id} value={department.name}>{department.name}</option>)}
                        </select>

                        <label>Course (optional):</label>
                        <select
                            value={formData.course || ''}
                            onChange={(e) => setFormData({ ...formData, course: e.target.value })}
                            disabled={!formData.department}
                        >
                            <option value="">No course association</option>
                            {bookingCourses.map(course => <option key={course._id} value={course.name}>{course.name} ({course.code})</option>)}
                        </select>
                        {departments.length === 0 && <p className="booking-catalog-note">Add departments and courses in <Link to="/departments">Departments</Link> and <Link to="/courses">Courses</Link>.</p>}

                        <label>Students / seats:</label>
                        <input
                            type="number"
                            min="1"
                            step="1"
                            value={formData.seats}
                            onChange={(e) => setFormData({ ...formData, seats: e.target.value })}
                            required
                        />
                        <div className="available-labs" aria-live="polite">
                            <strong>Labs with seats for this time</strong>
                            {labsWithSeats.length ? (
                                <ul>
                                    {labsWithSeats.map(lab => <li key={lab._id}>{lab.name}: {lab.seatsLeft} seat{lab.seatsLeft === 1 ? '' : 's'} left</li>)}
                                </ul>
                            ) : <p>No labs have seats available for this period.</p>}
                        </div>

                        <label>Date:</label>
                        <input
                            type="date"
                            value={formatInputDateOnly(formData.date)}
                            onChange={(e) => {
                                const selectedDate = parseInputDateOnly(e.target.value);
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
                                const duration = startExceedsHours(e.target.value) ? defaultDuration : Number(formData.duration);
                                const newEnd = new Date(newStart.getTime() + duration * 60000);
                                setFormData({ ...formData, start: newStart, duration, end: newEnd });
                            }}
                        >
                            {startTimeOptions.map(t => (
                                <option key={t} value={t} disabled={startExceedsHours(t)}>{t}</option>
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
                            <option value={90} disabled={startExceedsHours(formatTime(formData.start), 90)}>1.5 hours</option>
                        </select>

                        <label>End Time:</label>
                        <input type="time" value={formatTime(formData.end)} readOnly aria-label="Calculated end time" />
                        <p className="booking-time-summary">{formatTime(formData.start)}–{formatTime(formData.end)} · {formatInputDateOnly(formData.date)}</p>

                        <label>
                            <input
                                type="checkbox"
                                checked={formData.recurring}
                                onChange={(e) => setFormData({ ...formData, recurring: e.target.checked })}
                            /> Repeat weekly for 4 weeks
                        </label>

                        <div className="actions">
                            <button type="submit" disabled={saving}>Save</button>
                            {selectedEvent && <button type="button" onClick={handleDelete} disabled={saving}>Delete</button>}
                            <button type="button" onClick={handleClose} disabled={saving}>Cancel</button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
