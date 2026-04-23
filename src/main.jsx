import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { OrganizationProvider } from './context/OrganizationContext.jsx';
import { ThemeProvider } from './context/ThemeContext.js'; // ✅ Import ThemeProvider
import { BrandingProvider } from './context/BrandingContext.jsx';
import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';        // <-- ADDED
import UpdatePassword from './pages/UpdatePassword.jsx';        // <-- ADDED
import Layout from './components/Layout.jsx';
import Dashboard from './pages/Dashboard.jsx';
import AddTransaction from './pages/AddTransaction.jsx';
import ViewRecords from './pages/ViewRecords.jsx';
import Reports from './pages/Reports.jsx';
import Analytics from './pages/Analytics.jsx.';
import Budgets from './pages/Budgets.jsx';
import AdminPanel from './pages/AdminPanel.jsx';
import OrganizationSettings from './pages/OrganizationSettings.jsx';
import UserProfile from './pages/UserProfile.jsx';
import RecurringTransactions from './pages/RecurringTransactions.jsx';
import AuthCallback from './pages/AuthCallback.jsx';
import SetPassword from './pages/SetPassword.jsx';

import './styles/layout.css';
import './styles/dashboard.css';
import './styles/addTransaction.css';
import './styles/viewRecords.css';
import './styles/reports.css';
import './styles/analytics.css';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="loading-spinner">
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }
  return user ? children : <Navigate to="/login" />;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />   {/* <-- ADDED */}
      <Route path="/update-password" element={<UpdatePassword />} />   {/* <-- ADDED */}
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/set-password" element={<SetPassword />} />

      {/* Protected routes */}
      <Route element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/add" element={<AddTransaction />} />
        <Route path="/records" element={<ViewRecords />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/budgets" element={<Budgets />} />
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="/settings" element={<OrganizationSettings />} />
        <Route path="/profile" element={<UserProfile />} />
        <Route path="/recurring" element={<RecurringTransactions />} />
        <Route path="/" element={<Navigate to="/dashboard" />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" />} />
    </Routes>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <OrganizationProvider>
          <ThemeProvider>
            <BrandingProvider>
              <AppRoutes />
            </BrandingProvider>
          </ThemeProvider>
        </OrganizationProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);