import { useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useNavigate } from 'react-router-dom';
import '../styles/login.css';

export default function SetPassword() {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ show: false, type: '', text: '' });
  const navigate = useNavigate();

  const showToast = (type, text) => {
    setToast({ show: true, type, text });
    setTimeout(() => setToast({ show: false, type: '', text: '' }), 3000);
  };

  const handleSetPassword = async (e) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      showToast('error', error.message);
      setLoading(false);
      return;
    }

    // Success
    showToast('success', 'Password set successfully! Redirecting to dashboard...');
    setTimeout(() => navigate('/dashboard'), 1500);
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
          <i className="fas fa-lock" style={{ fontSize: '3rem', color: 'var(--primary)' }} />
          <h1>Set Your Password</h1>
        </div>

        <form onSubmit={handleSetPassword} className="lp-form">
          <div className="lp-form-group">
            <label>New Password</label>
            <div className="lp-password-wrapper">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                placeholder="Enter your new password"
              />
              <button
                type="button"
                className="lp-toggle-password"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex="-1"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`} />
              </button>
            </div>
          </div>

          <button type="submit" className="lp-btn" disabled={loading}>
            {loading ? 'Saving...' : 'Set Password'}
          </button>
        </form>

        <div className="lp-footer">
          <p>
            Already have an account? <a href="/login" onClick={(e) => { e.preventDefault(); navigate('/login'); }}>Sign in</a>
          </p>
        </div>

        <div className="lp-copyright">
          © {new Date().getFullYear()} IUS Finance Pro. All rights reserved.
        </div>
      </div>
    </div>
  );
}