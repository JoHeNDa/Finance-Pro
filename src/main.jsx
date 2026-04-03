import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { OrganizationProvider } from './context/OrganizationContext';
import { ThemeProvider } from './context/ThemeContext'; // ✅ Import ThemeProvider
import { BrandingProvider } from './context/BrandingContext';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import AddTransaction from './pages/AddTransaction';
import ViewRecords from './pages/ViewRecords';
import Reports from './pages/Reports';
import Analytics from './pages/Analytics';
import Budgets from './pages/Budgets';
import AdminPanel from './pages/AdminPanel';
import OrganizationSettings from './pages/OrganizationSettings';
import UserProfile from './pages/UserProfile';
import RecurringTransactions from './pages/RecurringTransactions';

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
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
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
        <Route path="/" element={<Navigate to="/dashboard" />} />
        <Route path="/recurring" element={<RecurringTransactions />} />
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
          <ThemeProvider>  {/* ✅ ThemeProvider wraps everything that needs theme */}
            <BrandingProvider>
              <AppRoutes />
            </BrandingProvider>
          </ThemeProvider>
        </OrganizationProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);