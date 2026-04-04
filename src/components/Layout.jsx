import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useOrganization } from '../context/OrganizationContext';
import '../styles/layout.css';

export default function Layout() {
  const { signOut, user, userProfile } = useAuth();
  const { organization } = useOrganization();
  const location = useLocation();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState('');
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    if (userProfile) forceUpdate(prev => prev + 1);
  }, [userProfile]);

  useEffect(() => {
    const updateDate = () => {
      const now = new Date();
      const isMobile = window.innerWidth <= 768;
      const options = {
        weekday: isMobile ? 'short' : 'long',
        year: 'numeric',
        month: isMobile ? 'short' : 'long',
        day: 'numeric'
      };
      setCurrentDate(now.toLocaleDateString('en-US', options));
    };
    updateDate();
    window.addEventListener('resize', updateDate);
    return () => window.removeEventListener('resize', updateDate);
  }, []);

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  const toggleSidebar = () => setIsSidebarOpen(prev => !prev);
  const closeSidebar = () => setIsSidebarOpen(false);

  const getPageIcon = (path) => {
    const icons = {
      '/dashboard': 'home',
      '/add': 'plus-circle',
      '/records': 'table',
      '/reports': 'chart-bar',
      '/analytics': 'chart-line',
      '/budgets': 'wallet',
      '/recurring': 'repeat',
      '/settings': 'cog',
      '/profile': 'user-circle',
      '/admin': 'users-cog'
    };
    return icons[path] || 'home';
  };

  const pageTitle = {
    '/dashboard': 'Dashboard',
    '/add': 'Add Transaction',
    '/records': 'View Records',
    '/reports': 'Reports',
    '/analytics': 'Analytics',
    '/budgets': 'Budgets',
    '/recurring': 'Recurring',
    '/settings': 'Settings',
    '/profile': 'My Profile',
    '/admin': 'Admin Panel'
  }[location.pathname] || 'Dashboard';

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const appName = organization?.name || 'Infinite FMIS';
  const appLogo = organization?.logo_url || null;
  const userName = userProfile?.name || user?.email?.split('@')[0] || 'Admin';
  const userRole = userProfile?.role || 'Financial Manager';
  const isAdmin = userProfile?.role === 'owner' || userProfile?.role === 'admin';
  const userAvatar = userProfile?.avatar_url || null;

  const navItems = [
    { path: '/dashboard', icon: 'home', label: 'Dashboard' },
    { path: '/add', icon: 'plus-circle', label: 'Add Transaction' },
    { path: '/records', icon: 'table', label: 'View Records' },
    { path: '/reports', icon: 'chart-bar', label: 'Reports' },
    { path: '/analytics', icon: 'chart-line', label: 'Analytics' },
    { path: '/budgets', icon: 'wallet', label: 'Budgets' },
  ];

  return (
    <div className="layout-app">
      <aside className={`layout-sidebar ${isSidebarOpen ? 'layout-active' : ''}`}>
        <div className="layout-sidebar-header">
          <Link to="/dashboard" className="layout-logo">
            <div className="layout-logo-icon-container">
              {appLogo ? (
                <img
                  src={appLogo}
                  alt={appName}
                  className="layout-logo-img"
                  style={{ width: '3rem', height: '3rem', objectFit: 'contain' }}
                />
              ) : (
                <i className="fas fa-chart-line" style={{ fontSize: '1.5rem', color: 'var(--secondary)' }}></i>
              )}
            </div>
            <span className="layout-logo-text">{appName}</span>
          </Link>
        </div>

        <ul className="layout-nav-menu">
          {/* Group 1: Financial Management */}
          <li className="nav-section-title">
            <span>Financial Management</span>
          </li>
          {navItems.map((item) => (
            <li
              key={item.path}
              className={`layout-nav-item ${location.pathname === item.path ? 'layout-active' : ''}`}
            >
              <Link to={item.path}>
                <i className={`fas fa-${item.icon}`}></i>
                <span>{item.label}</span>
              </Link>
            </li>
          ))}

          {/* Separator */}
          <li className="nav-divider"></li>

          {/* Group 2: Administration (only for owners/admins) */}
          {isAdmin && (
            <>
              <li className="nav-section-title">
                <span>Administration</span>
              </li>
              <li className={`layout-nav-item ${location.pathname === '/admin' ? 'layout-active' : ''}`}>
                <Link to="/admin">
                  <i className="fas fa-users-cog"></i>
                  <span>Admin Panel</span>
                </Link>
              </li>
              <li className={`layout-nav-item ${location.pathname === '/settings' ? 'layout-active' : ''}`}>
                <Link to="/settings">
                  <i className="fas fa-cog"></i>
                  <span>Settings</span>
                </Link>
              </li>
              <li className="nav-divider"></li>
            </>
          )}

          {/* Group 3: Account */}
          <li className="nav-section-title">
            <span>Account</span>
          </li>
          <li className={`layout-nav-item ${location.pathname === '/profile' ? 'layout-active' : ''}`}>
            <Link to="/profile">
              <i className="fas fa-user-circle"></i>
              <span>My Profile</span>
            </Link>
          </li>
        </ul>

        <div className="layout-sidebar-footer">
          <div className="layout-user-info">
            {userAvatar ? (
              <img
                src={userAvatar}
                alt={userName}
                className="layout-user-avatar"
                style={{
                  width: '2rem',
                  height: '2rem',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '1px solid var(--sidebar-border)'
                }}
              />
            ) : (
              <i className="fas fa-user-circle"></i>
            )}
            <div className="layout-user-details">
              <span className="layout-user-name">{userName}</span>
              <span className="layout-user-role">{userRole}</span>
            </div>
          </div>
          <button className="layout-logout-btn" onClick={handleLogout}>
            <i className="fas fa-sign-out-alt"></i>
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <div
        className={`layout-sidebar-overlay ${isSidebarOpen ? 'layout-active' : ''}`}
        onClick={closeSidebar}
      ></div>

      <main className="layout-main-content">
        <div className="layout-top-bar">
          <h1 className="layout-page-title">
            <i className={`fas fa-${getPageIcon(location.pathname)}`}></i>
            {pageTitle}
          </h1>
          <div className="layout-top-bar-actions">
            <div className="layout-date-display">
              <i className="far fa-calendar-alt"></i>
              <span>{currentDate}</span>
            </div>
            <button className="layout-refresh-btn" onClick={() => window.location.reload()} title="Refresh">
              <i className="fas fa-sync-alt"></i>
            </button>
            <button className="layout-menu-toggle" onClick={toggleSidebar}>
              <i className="fas fa-bars"></i>
            </button>
          </div>
        </div>
        <div className="layout-content-area">
          <Outlet />
        </div>
      </main>
    </div>
  );
}