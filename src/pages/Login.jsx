import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/login.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const currentYear = new Date().getFullYear();
  const appName = 'Finance Pro';  // ✅ Fixed app name
  const appLogo = null;           // ✅ Use a default icon instead of DB logo

  return (
    <div className="lp-container">
      <div className="lp-card">
        <div className="lp-logo">
          {appLogo ? (
            <img src={appLogo} alt={appName} className="lp-logo-img" />
          ) : (
            <i className="fas fa-chart-line" style={{ fontSize: '3rem', color: 'var(--primary)' }}></i>
          )}
          <h1>{appName}</h1>
        </div>

        <form onSubmit={handleSubmit} className="lp-form">
          <div className="lp-form-group">
            <label>Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="lp-form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          {error && <div className="lp-error">{error}</div>}

          <button type="submit" className="lp-btn" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="lp-footer">
          <p>
            Don't have an account? <Link to="/signup">Sign up</Link>
          </p>
        </div>

        <div className="lp-copyright">
          © {currentYear} {appName}. All rights reserved.
        </div>
      </div>
    </div>
  );
}