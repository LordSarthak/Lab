import React, { useEffect, useState } from "react";
import api from "../api";
import Calendar from "react-calendar";
import 'react-calendar/dist/Calendar.css';
import {
    LayoutGrid,
    FlaskConical,
    Search,
    LogOut
} from "lucide-react";
import "./Dashboard.css";
import { Link } from "react-router-dom";

const Dashboard = () => {
    const [labs, setLabs] = useState([]);
    const [date, setDate] = useState(new Date());

    useEffect(() => {
        api.get("/labs")
            .then((res) => setLabs(res.data))
            .catch((err) => console.error("Failed to load labs", err));
    }, []);

    const availableLabs = labs.filter(lab => lab.status === "Available");

    return (
        <div className="dashboard-container">
            <div className="main-content">
                <div className="top-bar">
                    <h1>Dashboard</h1>
                    <div className="top-right">
                        {/* <div className="search-bar">
                            <Search size={18} />
                            <input type="text" placeholder="Search..." />
                        </div> */}
                        <button className="admin-button">Admin ▾</button>
                        <button className="logout-btn"><LogOut size={18} /></button>
                    </div>
                </div>

                <div className="cards-container">
                    <Card title="Total Labs" value={labs.length} icon={<LayoutGrid />} color="blue" />
                    <Card title="Labs Available" value={availableLabs.length} icon={<FlaskConical />} color="yellow" />
                </div>

                <div className="panels">
                    <div className="panel">
                        <h2>Recent Activity</h2>
                        <ul>
                            <li>Sample: Lab records loaded from database</li>
                        </ul>
                    </div>
                    <div className="panel">
                        <h2>Calendar</h2>
                        <Calendar value={date} onChange={setDate} className="custom-calendar" />
                    </div>
                </div>

                <div className="buttons-container">
                    <Link to ='/labs-data'><button className="btn blue">Add New Lab</button></Link>
                    <Link to ='/students-data'><button className="btn green">Add New Student</button></Link>
                    <Link to ='/time-table'><button className="btn gray">Lab Slot Scheduling</button></Link>
                </div>
            </div>
        </div>
    );
};

const Card = ({ title, value, icon, color }) => (
    <div className={`card ${color}`}>
        <div className="card-icon">{icon}</div>
        <div className="card-content">
            <p className="card-title">{title}</p>
            <p className="card-value">{value}</p>
        </div>
    </div>
);

export default Dashboard;
