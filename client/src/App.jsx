
import { BrowserRouter, Routes, Route } from "react-router-dom";

import AuthProvider from "./context/AuthProvider";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Employees from "./pages/Employees";
import Attendance from "./pages/Attendance";
import Reports from "./pages/Reports";
import Leaves from "./pages/Leaves";
import Profile from "./pages/Profile";
import Tasks from "./pages/Tasks";
import EmployeePolicies from "./pages/EmployeePolicies";
import Payroll from "./pages/Payroll";
import MyPayroll from "./pages/MyPayroll";
import Announcements from "./pages/Announcements";
import Policies from "./pages/Policies";
import ManagerPerformance from "./pages/ManagerPerformance";
import EmployeePerformance from "./pages/EmployeePerformance";
import HRPerformance from "./pages/HRPerformance";


export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Login Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/manager-login" element={<Login />} />

          {/* Protected Routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/attendance" element={<Attendance />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/leaves" element={<Leaves />} />
              <Route path="/tasks" element={<Tasks />} />
              <Route path="/profile" element={<Profile />} />

              {/* HR / Admin Only */}
              <Route element={<ProtectedRoute role="admin" />}>
                <Route path="/employees" element={<Employees />} />
                <Route path="/payroll" element={<Payroll />} />
                <Route path="/policies" element={<Policies />} />
                <Route path="/hr-performance" element={<HRPerformance />} />
                <Route
                  path="/announcements"
                  element={<Announcements />}
                />
              </Route>

              {/* Employee Only */}
              <Route element={<ProtectedRoute role="employee" />}>
                <Route path="/my-payroll" element={<MyPayroll />} />
                <Route
                  path="/company-policies"
                  element={<EmployeePolicies />}
                />
                <Route
                  path="/my-performance"
                  element={<EmployeePerformance />}
                />
              </Route>
              {/* Manager Only */}
              <Route element={<ProtectedRoute role="manager" />}>
                <Route
                  path="/manager-performance"
                  element={<ManagerPerformance />}
                />
              </Route>
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
