import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import '../styles/login.css';

export default function UpdatePassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    if (password !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match' });
      return;
    }
    if (password.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters' });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setMessage({ type: 'success', text: 'Password updated! Redirecting to login...' });
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="lp-container">
      <div className="lp-card">
        <div className="lp-logo">
          <i className="fas fa-lock" style={{ fontSize: '3rem', color: 'var(--primary)' }}></i>
          <h1>Set New Password</h1>
        </div>

        {message.text && (
          <div className={`lp-error ${message.type === 'success' ? 'lp-success' : ''}`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="lp-form">
          <div className="lp-form-group">
            <label>New Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              placeholder="••••••"
            />
          </div>

          <div className="lp-form-group">
            <label>Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
              placeholder="••••••"
            />
          </div>

          <button type="submit" className="lp-btn" disabled={loading}>
            {loading ? 'Updating...' : 'Update Password'}
          </button>
        </form>

        <div className="lp-footer">
          <p>
            <Link to="/login">Back to Sign In</Link>
          </p>
        </div>

        <div className="lp-copyright">
          © {new Date().getFullYear()} IUS Finance Pro. All rights reserved.
        </div>
      </div>
    </div>
  );
}