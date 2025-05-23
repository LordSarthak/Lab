import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import { Menu } from "lucide-react";
import { LayoutGrid, Book, Users, Calendar, Monitor, CheckCircle, Settings } from "lucide-react";

const Sidebar = () => {
    const [collapsed, setCollapsed] = useState(false);

    return (
        <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
            <div className="sidebar-header">
                <span>Lab Management System</span>
                <button className="collapse-btn" onClick={() => setCollapsed(!collapsed)}>
                    <Menu size={20} />
                </button>
            </div>
            <nav className="nav">
                <NavLink to="/" end><LayoutGrid size={18} /> Dashboard</NavLink>
                <NavLink to="/labs-data"><Book size={18} /> Labs Data</NavLink>
                <NavLink to="/students-data"><Users size={18} /> Student Data</NavLink>
                <NavLink to="/time-table"><Calendar size={18} /> Lab Time Table</NavLink>
                <NavLink to="/vacant-labs"><Monitor size={18} /> Vacant Labs</NavLink>
                <NavLink to="/allotted-labs"><CheckCircle size={18} /> Allotted Labs</NavLink>
            </nav>
        </aside>
    );
};

export default Sidebar;