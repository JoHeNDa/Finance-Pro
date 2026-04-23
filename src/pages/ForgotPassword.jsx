import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import '../styles/login.css';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [toast, setToast] = useState({ show: false, type: '', text: '' });
  const [loading, setLoading] = useState(false);

  const showToast = (type, text) => {
    setToast({ show: true, type, text });
    setTimeout(() => setToast({ show: false, type: '', text: '' }), 3000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${globalThis.location.origin}/update-password`,
      });
      if (error) throw error;
      showToast('success', 'Password reset link sent! Check your email.');
      setEmail('');
    } catch (err) {
      showToast('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="lp-container">
      {/* Toast notification */}
      {toast.show && (
        <div className={`lp-toast lp-toast-${toast.type}`}>
          {toast.text}
        </div>
      )}

      <div className="lp-card">
        <div className="lp-logo">
          <i className="fas fa-key" style={{ fontSize: '3rem', color: 'var(--primary)' }} />
          <h1>Reset Password</h1>
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