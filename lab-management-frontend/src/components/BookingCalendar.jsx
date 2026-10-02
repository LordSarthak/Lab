import React from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import format from 'date-fns/format';
import parse from 'date-fns/parse';
import startOfWeek from 'date-fns/startOfWeek';
import getDay from 'date-fns/getDay';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import './BookingCalendar.css';

const locales = {
    'en-IN': require('date-fns/locale/en-IN'),
};

const localizer = dateFnsLocalizer({
    format,
    parse,
    startOfWeek,
    getDay,
    locales,
});

const BookingCalendar = ({ bookings }) => {
    const events = bookings.map((booking) => ({
        title: booking.title,
        start: new Date(booking.start),
        end: new Date(booking.end),
    }));

    return (
        <div className="calendar-container">
            <h2>📅 Lab Booking Calendar</h2>
            <Calendar
                localizer={localizer}
                events={events}
                startAccessor="start"
                endAccessor="end"
                style={{ height: 500 }}
                popup
            />
        </div>
    );
};

export default BookingCalendar;