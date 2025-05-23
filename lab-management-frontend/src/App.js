import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import LabsData from "./pages/LabsData";
import StudentData from "./pages/StudentData";
import VacantLabs from "./pages/VacantLabs";
import AllottedLabs from "./pages/AllottedLabs";
import Booking from "./pages/Booking";

const App = () => {
    return (
        <Router>
            <div className="dashboard-container">
                <Sidebar />
                    <Routes>
                        <Route path="/" element={<Dashboard />} />
                        <Route path="/labs-data" element={<LabsData />} />
                        <Route path="/students-data" element={<StudentData />} />
                        <Route path="/time-table" element={<Booking />} />
                        <Route path="/vacant-labs" element={<VacantLabs />} />
                        <Route path="/allotted-labs" element={<AllottedLabs />} />
                    </Routes>
            </div>
        </Router>
    );
};

export default App;
