import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import '../styles/login.css';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/update-password`,
      });
      if (error) throw error;
      setMessage({
        type: 'success',
        text: 'Password reset link sent! Check your email.',
      });
      setEmail('');
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
          <i className="fas fa-key" style={{ fontSize: '3rem', color: 'var(--primary)' }}></i>
          <h1>Reset Password</h1>
        </div>

        {message.text && (
          <div className={`lp-error ${message.type === 'success' ? 'lp-success' : ''}`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="lp-form">
          <div className="lp-form-group">
            <label>Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="your@email.com"
            />
          </div>

          <button type="submit" className="lp-btn" disabled={loading}>
            {loading ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>

        <div className="lp-footer">
          <p>
            Remember your password? <Link to="/login">Back to Sign In</Link>
          </p>
        </div>

        <div className="lp-copyright">
          © {new Date().getFullYear()} IUS Finance Pro. All rights reserved.
        </div>
      </div>
    </div>
  );
}