import { NavLink } from "react-router-dom";
import { LayoutGrid, Book, Users, CalendarDays, Monitor, CircleCheck, FlaskConical, Building2, BookOpen } from "lucide-react";

const Sidebar = () => {
    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <div className="brand-mark"><FlaskConical size={21} aria-hidden="true" /></div>
                <div className="brand-copy">
                    <strong>Campus Labs</strong>
                    <span>LAB MANAGEMENT</span>
                </div>
            </div>
            <nav className="nav" aria-label="Main navigation">
                <span className="nav-section-label">WORKSPACE</span>
                <NavLink className="nav-link" to="/" end><LayoutGrid size={18} aria-hidden="true" /> Dashboard</NavLink>
                <NavLink className="nav-link" to="/labs-data"><Book size={18} aria-hidden="true" /> Labs</NavLink>
                <NavLink className="nav-link" to="/students-data"><Users size={18} aria-hidden="true" /> Student Data</NavLink>
                <NavLink className="nav-link" to="/departments"><Building2 size={18} aria-hidden="true" /> Departments</NavLink>
                <NavLink className="nav-link" to="/courses"><BookOpen size={18} aria-hidden="true" /> Courses</NavLink>
                <NavLink className="nav-link" to="/time-table"><CalendarDays size={18} aria-hidden="true" /> Lab Time Table</NavLink>
                <NavLink className="nav-link" to="/vacant-labs"><Monitor size={18} aria-hidden="true" /> Vacant Labs</NavLink>
                <NavLink className="nav-link" to="/allotted-labs"><CircleCheck size={18} aria-hidden="true" /> Allotted Labs</NavLink>
            </nav>
            <div className="sidebar-foot"><span className="sidebar-foot-mark" /> Academic facilities</div>
        </aside>
    );
};

export default Sidebar;