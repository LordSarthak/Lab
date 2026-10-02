import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Calendar from "react-calendar";
import { ArrowRight, BookOpen, Building2, CalendarDays, CircleCheck, FlaskConical, GraduationCap, Plus } from "lucide-react";
import api from "../api";
import RequestState from "../components/RequestState";
import "react-calendar/dist/Calendar.css";
import "./Dashboard.css";

const localDateKey = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const Dashboard = () => {
    const [labs, setLabs] = useState([]);
    const [students, setStudents] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [courses, setCourses] = useState([]);
    const [bookings, setBookings] = useState([]);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [reload, setReload] = useState(0);

    useEffect(() => {
        let isCurrent = true;

        const loadDashboard = async () => {
            setLoading(true);
            setError(null);
            try {
                const [labResponse, studentResponse, bookingResponse, departmentResponse, courseResponse] = await Promise.all([
                    api.get("/labs"),
                    api.get("/students"),
                    api.get("/bookings"),
                    api.get("/departments"),
                    api.get("/courses"),
                ]);
                if (!isCurrent) return;
                setLabs(labResponse.data);
                setStudents(studentResponse.data);
                setBookings(bookingResponse.data);
                setDepartments(departmentResponse.data);
                setCourses(courseResponse.data);
            } catch (requestError) {
                if (isCurrent) setError(requestError);
            } finally {
                if (isCurrent) setLoading(false);
            }
        };

        loadDashboard();
        return () => { isCurrent = false; };
    }, [reload]);

    const availableLabs = labs.filter((lab) => lab.status === "Available").length;
    const selectedDateBookings = bookings
        .filter((booking) => localDateKey(booking.start) === localDateKey(selectedDate))
        .sort((a, b) => new Date(a.start) - new Date(b.start));
    const todayCount = bookings.filter((booking) => localDateKey(booking.start) === localDateKey(new Date())).length;

    return (
        <div className="dashboard-page">
            <section className="dashboard-intro">
                <div>
                    <p className="dashboard-kicker">CAMPUS LABORATORIES</p>
                    <h1>Lab operations</h1>
                    <p className="dashboard-subtitle">A clear view of facilities, student records, and today's schedule.</p>
                </div>
                <Link className="dashboard-primary-action" to="/time-table">
                    <Plus size={17} aria-hidden="true" /> Book a lab slot
                </Link>
            </section>

            <RequestState
                loading={loading}
                error={error}
                onRetry={() => setReload((current) => current + 1)}
                loadingMessage="Loading campus records..."
            />

            {!loading && !error && (
                <>
                    <section className="dashboard-metrics" aria-label="Campus summary">
                        <Metric icon={<FlaskConical size={19} />} label="Registered labs" value={labs.length} accent="green" />
                        <Metric icon={<CircleCheck size={19} />} label="Available now" value={availableLabs} accent="gold" />
                        <Metric icon={<GraduationCap size={20} />} label="Student records" value={students.length} accent="blue" />
                        <Metric icon={<CalendarDays size={19} />} label="Bookings today" value={todayCount} accent="red" />
                        <Metric icon={<Building2 size={19} />} label="Departments" value={departments.length} accent="green" />
                        <Metric icon={<BookOpen size={19} />} label="Courses" value={courses.length} accent="gold" />
                    </section>

                    <section className="dashboard-workspace">
                        <div className="dashboard-panel schedule-panel">
                            <div className="dashboard-panel-heading">
                                <div>
                                    <p className="panel-kicker">TIMETABLE</p>
                                    <h2>Schedule by day</h2>
                                </div>
                                <Link className="text-link" to="/time-table">Open timetable <ArrowRight size={15} aria-hidden="true" /></Link>
                            </div>
                            <div className="schedule-layout">
                                <Calendar
                                    value={selectedDate}
                                    onChange={setSelectedDate}
                                    className="dashboard-calendar"
                                    aria-label="Choose a date to view lab bookings"
                                />
                                <div className="schedule-list">
                                    <div className="schedule-date-label">
                                        {selectedDate.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
                                    </div>
                                    {selectedDateBookings.length ? selectedDateBookings.map((booking) => (
                                        <div className="schedule-item" key={booking._id}>
                                            <time>{new Date(booking.start).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</time>
                                            <span className="schedule-rule" />
                                            <div className="schedule-booking-copy">
                                                <strong>{booking.title}</strong>
                                                {(booking.department || booking.course) && <small>{[booking.department, booking.course].filter(Boolean).join(" · ")}</small>}
                                            </div>
                                        </div>
                                    )) : (
                                        <p className="schedule-empty">No lab bookings for this date.</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="dashboard-panel shortcut-panel">
                            <div className="dashboard-panel-heading">
                                <div>
                                    <p className="panel-kicker">WORKSPACE</p>
                                    <h2>Manage records</h2>
                                </div>
                            </div>
                            <div className="shortcut-list">
                                <Link to="/labs-data"><span><FlaskConical size={17} aria-hidden="true" /> Laboratories</span><ArrowRight size={16} aria-hidden="true" /></Link>
                                <Link to="/students-data"><span><GraduationCap size={18} aria-hidden="true" /> Students</span><ArrowRight size={16} aria-hidden="true" /></Link>
                                <Link to="/departments"><span><Building2 size={17} aria-hidden="true" /> Departments</span><ArrowRight size={16} aria-hidden="true" /></Link>
                                <Link to="/courses"><span><BookOpen size={17} aria-hidden="true" /> Courses</span><ArrowRight size={16} aria-hidden="true" /></Link>
                                <Link to="/vacant-labs"><span><CircleCheck size={17} aria-hidden="true" /> Room availability</span><ArrowRight size={16} aria-hidden="true" /></Link>
                            </div>
                        </div>
                    </section>
                </>
            )}
        </div>
    );
};

const Metric = ({ icon, label, value, accent }) => (
    <div className={`metric-card metric-${accent}`}>
        <span className="metric-icon" aria-hidden="true">{icon}</span>
        <div>
            <p>{label}</p>
            <strong>{value}</strong>
        </div>
    </div>
);

export default Dashboard;
