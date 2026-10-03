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

function CalendarBookingEvent({ event }) {
    const details = [
        event.course || event.department,
        `${Number(event.seats) || 1} seat${(Number(event.seats) || 1) === 1 ? '' : 's'}`,
    ].filter(Boolean);

    return (
        <div className="booking-event-copy">
            <strong title={event.title}>{event.title}</strong>
            <span>{details.join(' · ')}</span>
        </div>
    );
}

const defaultTimetableSettings = {
    startTime: '09:00',
    endTime: '16:00',
    slotInterval: 60,
    bookingDurationMinutes: 60,
    slots: Array.from({ length: 7 }, (_, index) => ({
        startTime: `${String(9 + index).padStart(2, '0')}:00`,
        endTime: `${String(10 + index).padStart(2, '0')}:00`,
        enabled: true,
    })),
};

function parseTimeToDate(timeStr, date = new Date()) {
    const [hour, minute] = timeStr.split(':').map(Number);
    const result = new Date(date);
    result.setHours(hour, minute, 0, 0);
    return result;
}

function formatTime(date) {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function timeToMinutes(value) {
    const [hour, minute] = value.split(':').map(Number);
    return hour * 60 + minute;
}

function generateTimetableSlots(settings) {
    const slots = [];
    const openingMinutes = timeToMinutes(settings.startTime);
    const closingMinutes = timeToMinutes(settings.endTime);
    const interval = Number(settings.slotInterval);
    const duration = Number(settings.bookingDurationMinutes);
    if (!Number.isInteger(interval) || interval <= 0 || !Number.isInteger(duration) || duration <= 0) return slots;

    for (let minute = openingMinutes; minute + duration <= closingMinutes; minute += interval) {
        const endMinute = minute + duration;
        slots.push({
            startTime: `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`,
            endTime: `${String(Math.floor(endMinute / 60)).padStart(2, '0')}:${String(endMinute % 60).padStart(2, '0')}`,
            enabled: true,
        });
    }
    return slots;
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
    const [timetableSettings, setTimetableSettings] = useState(defaultTimetableSettings);
    const [settingsDraft, setSettingsDraft] = useState(defaultTimetableSettings);
    const [editingTimetableSettings, setEditingTimetableSettings] = useState(false);

    const [formData, setFormData] = useState({
        title: '',
        date: new Date(),
        start: parseTimeToDate(defaultTimetableSettings.startTime),
        duration: defaultTimetableSettings.bookingDurationMinutes,
        end: new Date(parseTimeToDate(defaultTimetableSettings.startTime).getTime() + defaultTimetableSettings.bookingDurationMinutes * 60000),
        seats: 1,
        recurring: false
    });

    useEffect(() => {
        let isCurrent = true;
        setLoading(true);
        setLoadError(null);
        Promise.all([api.get('/bookings'), api.get('/labs'), api.get('/departments'), api.get('/courses'), api.get('/timetable')])
            .then(([bookingResponse, labResponse, departmentResponse, courseResponse, timetableResponse]) => {
                if (!isCurrent) return;
                setEvents(bookingResponse.data.map(ev => ({
                    ...ev,
                    start: new Date(ev.start),
                    end: new Date(ev.end)
                })));
                setLabs(labResponse.data);
                setDepartments(departmentResponse.data);
                setCourses(courseResponse.data);
                setTimetableSettings(timetableResponse.data);
                setSettingsDraft(timetableResponse.data);
            })
            .catch(error => { if (isCurrent) setLoadError(error); })
            .finally(() => { if (isCurrent) setLoading(false); });
        return () => { isCurrent = false; };
    }, [reload]);

    const activeTimetableSlots = timetableSettings.slots.filter(slot => slot.enabled);

    const handleSelectSlot = (slotInfo = null) => {
        const requestedStart = slotInfo?.start ? formatTime(new Date(slotInfo.start)) : activeTimetableSlots[0]?.startTime;
        const slot = activeTimetableSlots.find(item => item.startTime === requestedStart);
        if (!slot) {
            setActionError('Select an enabled timetable interval to create a booking.');
            return;
        }
        const start = parseTimeToDate(slot.startTime, slotInfo?.start ? new Date(slotInfo.start) : new Date());
        const end = parseTimeToDate(slot.endTime, start);
        const duration = timeToMinutes(slot.endTime) - timeToMinutes(slot.startTime);
        setFormData({ title: '', department: '', course: '', date: new Date(start), start, end, duration, seats: 1, recurring: false });
        setSelectedSlot(true);
        setSelectedEvent(null);
        setActionError(null);
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
    const filteredEvents = events.filter(event =>
        (filteredLab === 'All' || event.title === filteredLab) &&
        (filteredDepartment === 'All' || event.department?.trim().toLowerCase() === filteredDepartment.trim().toLowerCase()) &&
        (filteredCourse === 'All' || event.course?.trim().toLowerCase() === filteredCourse.trim().toLowerCase())
    );
    const selectedLab = labs.find(lab => lab.name === filteredLab);
    const selectedLabEvents = selectedLab
        ? filteredEvents.filter(event => event.title === selectedLab.name).sort((first, second) => first.start - second.start)
        : [];
    const selectedLabAvailability = selectedLab
        ? timetableSettings.slots.filter(slot => slot.enabled).map(slot => {
            const start = parseTimeToDate(slot.startTime, currentDate);
            const end = parseTimeToDate(slot.endTime, currentDate);
            return { ...slot, seatsLeft: getAvailableSeats(selectedLab.name, start, end) };
        }).filter(slot => slot.seatsLeft > 0)
        : [];
    const selectedEventSlot = selectedEvent &&
        formatInputDateOnly(selectedEvent.start) === formatInputDateOnly(formData.date) &&
        !activeTimetableSlots.some(slot =>
        slot.startTime === formatTime(selectedEvent.start) && slot.endTime === formatTime(selectedEvent.end)
    ) ? {
        startTime: formatTime(selectedEvent.start),
        endTime: formatTime(selectedEvent.end),
        enabled: false,
    } : null;
    const bookingSlotOptions = selectedEventSlot
        ? [...activeTimetableSlots, selectedEventSlot].sort((first, second) => first.startTime.localeCompare(second.startTime))
        : activeTimetableSlots;

    const handleSaveTimetableSettings = async (event) => {
        event.preventDefault();
        setSaving(true);
        setActionError(null);
        try {
            const response = await api.put('/timetable', settingsDraft);
            setTimetableSettings(response.data);
            setSettingsDraft(response.data);
            setEditingTimetableSettings(false);
        } catch (error) {
            setActionError(getRequestErrorMessage(error));
        } finally {
            setSaving(false);
        }
    };

    const handleGenerateIntervals = () => {
        setSettingsDraft(current => ({ ...current, slots: generateTimetableSlots(current) }));
    };

    const handleAddInterval = () => {
        const existingStarts = new Set(settingsDraft.slots.map(slot => slot.startTime));
        const opening = timeToMinutes(settingsDraft.startTime);
        const closing = timeToMinutes(settingsDraft.endTime);
        const duration = Number(settingsDraft.bookingDurationMinutes);
        let candidate = null;
        for (let start = opening; start + duration <= closing; start += 5) {
            const end = start + duration;
            if (!existingStarts.has(`${String(Math.floor(start / 60)).padStart(2, '0')}:${String(start % 60).padStart(2, '0')}`)) {
                candidate = { start, end };
                break;
            }
        }
        if (!candidate) {
            setActionError('There is no free space for another interval. Adjust or remove an existing interval first.');
            return;
        }
        const toTime = minute => `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
        setSettingsDraft(current => ({
            ...current,
            slots: [...current.slots, {
                startTime: toTime(candidate.start),
                endTime: toTime(candidate.end),
                enabled: true,
            }].sort((first, second) => first.startTime.localeCompare(second.startTime)),
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const newEvents = [];
        const baseStart = new Date(formData.start);
        const baseEnd = new Date(formData.end);
        const title = formData.title;
        const seats = Number(formData.seats);

        const openingMinutes = timeToMinutes(timetableSettings.startTime);
        const closingMinutes = timeToMinutes(timetableSettings.endTime);
        const bookingStartMinutes = baseStart.getHours() * 60 + baseStart.getMinutes();
        const bookingEndMinutes = baseEnd.getHours() * 60 + baseEnd.getMinutes();
        const bookingStartTime = formatTime(baseStart);
        const bookingEndTime = formatTime(baseEnd);
        const isEnabledInterval = activeTimetableSlots.some(slot =>
            slot.startTime === bookingStartTime && slot.endTime === bookingEndTime
        );
        const isUnchangedExistingInterval = selectedEvent &&
            formatInputDateOnly(selectedEvent.start) === formatInputDateOnly(baseStart) &&
            formatTime(selectedEvent.start) === bookingStartTime &&
            formatTime(selectedEvent.end) === bookingEndTime;
        if (
            (!isUnchangedExistingInterval && (bookingStartMinutes < openingMinutes || bookingEndMinutes > closingMinutes)) ||
            !(isEnabledInterval || isUnchangedExistingInterval)
        ) {
            setActionError('Choose one of the enabled timetable intervals.');
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
            if (!Number.isInteger(Number(formData.duration)) || Number(formData.duration) < 1 || Number(formData.duration) > 480) {
                setActionError('Booking duration must be a whole number from 1 to 480 minutes.');
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
            } else {
                await api.post('/bookings/batch', { bookings: newEvents });
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
        const escapeCell = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
        const csv = [header, ...rows].map(row => row.map(escapeCell).join(',')).join('\r\n');
        const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const downloadUrl = URL.createObjectURL(blob);
        link.href = downloadUrl;
        link.download = 'lab-bookings.csv';
        link.click();
        setTimeout(() => URL.revokeObjectURL(downloadUrl), 0);
    };

    const availableCourses = courses.filter(course =>
        filteredDepartment === 'All' || course.department?.trim().toLowerCase() === filteredDepartment.trim().toLowerCase()
    );
    const bookingCourses = courses.filter(course =>
        !formData.department || course.department === formData.department
    );

    const eventStyleGetter = (event) => {
        return {
            style: {
                backgroundColor: 'var(--green)',
                color: 'white',
                border: '1px solid var(--green-deep)',
                borderLeft: '4px solid var(--gold)',
                borderRadius: '6px',
                boxShadow: '0 2px 5px rgba(24, 55, 40, 0.14)',
                padding: '7px 8px',
                fontSize: '12px',
                zIndex: 2,
            },
        };
    };

    const minTime = parseTimeToDate(timetableSettings.startTime);
    const maxTime = parseTimeToDate(timetableSettings.endTime);

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
                    {(filteredLab !== 'All' || filteredDepartment !== 'All' || filteredCourse !== 'All') && (
                        <button
                            type="button"
                            className="reset-booking-filters"
                            onClick={() => {
                                setFilteredLab('All');
                                setFilteredDepartment('All');
                                setFilteredCourse('All');
                            }}
                        >
                            Clear filters
                        </button>
                    )}

                    <button className="export-bookings-button" onClick={exportToCSV}>
                        <FiDownload style={{ marginRight: '6px' }} />
                        Export CSV
                    </button>

                    <button type="button" className="edit-timetable-button" onClick={() => { setSettingsDraft(timetableSettings); setEditingTimetableSettings(current => !current); }} disabled={saving}>
                        Edit timings
                    </button>

                    <button className="clear-bookings-button" onClick={clearAllBookings} disabled={!events.length || saving}>
                        <FiTrash2 style={{ marginRight: '6px' }} />
                        Clear All
                    </button>

                    <button className="add-booking-button" onClick={() => handleSelectSlot()} disabled={saving || !activeTimetableSlots.length}>
                        <FiPlus style={{ marginRight: '6px' }} />
                        Add Booking
                    </button>
                </div>
            </div>

            <section className="timetable-overview" aria-label="Timetable overview">
                <div>
                    <strong>{filteredEvents.length}</strong>
                    <span>{filteredEvents.length === 1 ? 'booking shown' : 'bookings shown'}</span>
                </div>
                <div>
                    <strong>{labs.length}</strong>
                    <span>{labs.length === 1 ? 'lab' : 'labs'}</span>
                </div>
                <div>
                    <strong>{activeTimetableSlots.length}</strong>
                    <span>{activeTimetableSlots.length === 1 ? 'active interval' : 'active intervals'}</span>
                </div>
            </section>

            {(filteredDepartment !== 'All' || filteredCourse !== 'All' || filteredLab !== 'All') && (
                <p className="booking-filter-summary" role="status">
                    Showing {filteredEvents.length} of {events.length} bookings
                    {filteredDepartment !== 'All' && ` · Department: ${filteredDepartment}`}
                    {filteredCourse !== 'All' && ` · Course: ${filteredCourse}`}
                    {filteredLab !== 'All' && ` · Lab: ${filteredLab}`}
                    {filteredEvents.length === 0 && '. No bookings match these filters.'}
                </p>
            )}

            {editingTimetableSettings && (
                <form className="timetable-settings" onSubmit={handleSaveTimetableSettings}>
                    <div>
                        <h2>Timetable hours and slots</h2>
                        <p>Generate a schedule, then fine-tune each interval. Changes apply to booking choices and availability after saving.</p>
                    </div>
                    <label>
                        Opens
                        <input
                            type="time"
                            value={settingsDraft.startTime}
                            onChange={event => setSettingsDraft({ ...settingsDraft, startTime: event.target.value })}
                            required
                        />
                    </label>
                    <label>
                        Closes
                        <input
                            type="time"
                            value={settingsDraft.endTime}
                            onChange={event => setSettingsDraft({ ...settingsDraft, endTime: event.target.value })}
                            required
                        />
                    </label>
                    <label>
                        Generated start spacing (minutes)
                        <input
                            type="number"
                            min="5"
                            max="180"
                            step="1"
                            value={settingsDraft.slotInterval}
                            onChange={event => setSettingsDraft({ ...settingsDraft, slotInterval: Number(event.target.value) })}
                            required
                        />
                    </label>
                    <label>
                        Generated slot duration (minutes)
                        <input
                            type="number"
                            min="1"
                            max="480"
                            step="1"
                            value={settingsDraft.bookingDurationMinutes}
                            onChange={event => setSettingsDraft({ ...settingsDraft, bookingDurationMinutes: Number(event.target.value) })}
                            required
                        />
                    </label>
                    <div className="timetable-slot-actions">
                        <button type="button" onClick={handleGenerateIntervals}>Regenerate intervals</button>
                        <button type="button" onClick={handleAddInterval}>+ Add interval</button>
                    </div>
                    <div className="timetable-intervals">
                        <div className="timetable-intervals-heading">
                            <strong>Individual intervals</strong>
                            <span>Change each start/end time or disable intervals without deleting them.</span>
                        </div>
                        {settingsDraft.slots.map((slot, index) => (
                            <div className="timetable-interval-row" key={`${index}-${slot.startTime}`}>
                                <span className="timetable-interval-number">Slot {index + 1}</span>
                                <label>
                                    Start
                                    <input
                                        type="time"
                                        value={slot.startTime}
                                        onChange={event => setSettingsDraft(current => ({
                                            ...current,
                                            slots: current.slots.map((item, itemIndex) => itemIndex === index ? { ...item, startTime: event.target.value } : item),
                                        }))}
                                        required
                                    />
                                </label>
                                <label>
                                    End
                                    <input
                                        type="time"
                                        value={slot.endTime}
                                        onChange={event => setSettingsDraft(current => ({
                                            ...current,
                                            slots: current.slots.map((item, itemIndex) => itemIndex === index ? { ...item, endTime: event.target.value } : item),
                                        }))}
                                        required
                                    />
                                </label>
                                <label className="timetable-interval-enabled">
                                    <input
                                        type="checkbox"
                                        checked={slot.enabled}
                                        onChange={event => setSettingsDraft(current => ({
                                            ...current,
                                            slots: current.slots.map((item, itemIndex) => itemIndex === index ? { ...item, enabled: event.target.checked } : item),
                                        }))}
                                    />
                                    Available for bookings
                                </label>
                                <button
                                    type="button"
                                    className="timetable-interval-remove"
                                    aria-label={`Remove interval ${index + 1}`}
                                    onClick={() => setSettingsDraft(current => ({
                                        ...current,
                                        slots: current.slots.filter((_, itemIndex) => itemIndex !== index),
                                    }))}
                                >
                                    <FiTrash2 aria-hidden="true" />
                                </button>
                            </div>
                        ))}
                        {!settingsDraft.slots.length && <p className="timetable-settings-note">No intervals yet. Add one or regenerate from the settings above.</p>}
                    </div>
                    <p className="timetable-settings-note">
                        Enabled intervals appear in booking choices and availability. Existing bookings keep their times if their interval is later disabled.
                    </p>
                    <div className="timetable-settings-actions">
                        <button type="submit" disabled={saving}>Save timings</button>
                        <button type="button" onClick={() => { setSettingsDraft(timetableSettings); setEditingTimetableSettings(false); }}>Cancel</button>
                    </div>
                </form>
            )}

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
                                        <li key={`${slot.startTime}-${slot.endTime}`}>
                                            <span>{slot.startTime} - {slot.endTime}</span>
                                            <strong>{slot.seatsLeft} seat{slot.seatsLeft === 1 ? '' : 's'}</strong>
                                        </li>
                                    ))}
                                </ul>
                            ) : <p className="lab-panel-empty">No enabled intervals with seats are available on this date.</p>}
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

            <section className="timetable-calendar-panel" aria-label="Booking calendar">
                <header className="timetable-calendar-heading">
                    <div>
                        <h2>Booking calendar</h2>
                        <p>Select a booking to edit it, or choose an available interval to add one.</p>
                    </div>
                </header>
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
                    step={5}
                    timeslots={3}
                    selectable
                    style={{ height: 'clamp(360px, 75vh, 780px)' }}
                    min={minTime}
                    max={maxTime}
                    onSelectEvent={handleSelectEvent}
                    onSelectSlot={handleSelectSlot}
                    tooltipAccessor={event => [event.title, event.department, event.course].filter(Boolean).join(' · ')}
                    eventPropGetter={eventStyleGetter}
                    components={{ event: CalendarBookingEvent }}
                />
            </section>

            {(selectedSlot || selectedEvent) && (
                <div className="booking-modal" onMouseDown={(event) => event.target === event.currentTarget && handleClose()}>
                    <form className="modalContent" onSubmit={handleSubmit}>
                        <h3>{selectedEvent ? 'Edit Booking' : 'Add Booking'}</h3>

                        <label htmlFor="booking-lab">Lab Name:</label>
                        <select
                            id="booking-lab"
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

                        <label>Department:</label>
                        <select
                            aria-label="Select a department"
                            value={formData.department || ''}
                            required
                            onChange={(e) => {
                                const department = e.target.value;
                                const course = courses.find(item => item.name === formData.course);
                                setFormData({ ...formData, department, course: course?.department === department ? formData.course : '' });
                            }}
                        >
                            <option value="">Select a department</option>
                            {departments.map(department => <option key={department._id} value={department.name}>{department.name}</option>)}
                        </select>

                        <label>Course:</label>
                        <select
                            aria-label="Select a course"
                            value={formData.course || ''}
                            onChange={(e) => setFormData({ ...formData, course: e.target.value })}
                            disabled={!formData.department}
                            required
                        >
                            <option value="">Select a course</option>
                            {bookingCourses.map(course => <option key={course._id} value={course.name}>{course.name} ({course.code})</option>)}
                        </select>
                        {departments.length === 0 && <p className="booking-catalog-note">Add departments and courses in <Link to="/departments">Departments</Link> and <Link to="/courses">Courses</Link>.</p>}

                        <label htmlFor="booking-seats">Students / seats:</label>
                        <input
                            id="booking-seats"
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

                        <label htmlFor="booking-date">Date:</label>
                        <input
                            id="booking-date"
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

                        <label htmlFor="booking-interval">Timetable interval:</label>
                        <select
                            id="booking-interval"
                            aria-label="Select a timetable interval"
                            value={`${formatTime(formData.start)}-${formatTime(formData.end)}`}
                            onChange={(e) => {
                                const slot = bookingSlotOptions.find(item => `${item.startTime}-${item.endTime}` === e.target.value);
                                if (!slot) return;
                                const newStart = parseTimeToDate(slot.startTime, formData.date);
                                const newEnd = parseTimeToDate(slot.endTime, formData.date);
                                const duration = timeToMinutes(slot.endTime) - timeToMinutes(slot.startTime);
                                setFormData({ ...formData, start: newStart, duration, end: newEnd });
                            }}
                            required
                        >
                            <option value="" disabled>Select a timetable interval</option>
                            {bookingSlotOptions.map((slot, index) => (
                                <option key={`${index}-${slot.startTime}-${slot.endTime}`} value={`${slot.startTime}-${slot.endTime}`}>
                                    {slot.startTime}–{slot.endTime}{slot.enabled ? '' : ' · Existing booking'}
                                </option>
                            ))}
                        </select>

                        <label>Interval duration:</label>
                        <p className="booking-time-summary">{formData.duration} minutes, set by this timetable interval</p>

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
