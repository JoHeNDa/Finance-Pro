import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import '../styles/login.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
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
      let friendlyMessage = err.message;
      // Customize common Supabase error messages
      if (err.message.includes('Invalid login credentials')) {
        friendlyMessage = 'Incorrect email or password. Please try again.';
      } else if (err.message.includes('Email not confirmed')) {
        friendlyMessage = 'Please confirm your email address before logging in.';
      } else if (err.message.includes('rate limit')) {
        friendlyMessage = 'Too many failed attempts. Please wait a few minutes.';
      }
      setError(friendlyMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.getModifierState && e.getModifierState('CapsLock')) {
      setCapsLockOn(true);
    } else {
      setCapsLockOn(false);
    }
  };

  const currentYear = new Date().getFullYear();
  const appName = 'IUS Finance Pro';
  const appLogo = null;

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
            <div className="lp-password-wrapper">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                className="lp-toggle-password"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex="-1"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
              </button>
            </div>
            {capsLockOn && (
              <div className="lp-caps-warning">
                <i className="fas fa-exclamation-triangle"></i> Caps Lock is on
              </div>
            )}
          </div>

          <div className="lp-forgot-link">
            <Link to="/forgot-password">Forgot password?</Link>
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