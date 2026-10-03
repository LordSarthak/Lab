import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { CalendarDays } from "lucide-react";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import LabsData from "./pages/LabsData";
import StudentData from "./pages/StudentData";
import Departments from "./pages/Departments";
import Courses from "./pages/Courses";
import VacantLabs from "./pages/VacantLabs";
import AllottedLabs from "./pages/AllottedLabs";
import Booking from "./pages/Booking";
import "./App.css";

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
});

const App = () => {
    const today = new Date();

    return (
        <Router>
            <div className="app-shell">
                <Sidebar />
                <div className="app-main">
                    <header className="app-topbar">
                        <div className="app-context">
                            <span className="app-context-mark" />
                            <span>ACADEMIC</span>
                            <span className="app-context-divider">/</span>
                            <strong>Lab operations</strong>
                        </div>
                        <div className="app-date">
                            <CalendarDays size={16} aria-hidden="true" />
                            <time dateTime={today.toISOString()}>{dateFormatter.format(today)}</time>
                        </div>
                    </header>
                    <main className="app-content">
                        <Routes>
                            <Route path="/" element={<Dashboard />} />
                            <Route path="/labs-data" element={<LabsData />} />
                            <Route path="/students-data" element={<StudentData />} />
                            <Route path="/departments" element={<Departments />} />
                            <Route path="/courses" element={<Courses />} />
                            <Route path="/time-table" element={<Booking />} />
                            <Route path="/vacant-labs" element={<VacantLabs />} />
                            <Route path="/allotted-labs" element={<AllottedLabs />} />
                            <Route path="*" element={<Navigate to="/" replace />} />
                        </Routes>
                    </main>
                </div>
            </div>
        </Router>
    );
};

export default App;
