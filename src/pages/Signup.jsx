import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useOrganization } from '../context/OrganizationContext';
import '../styles/signup.css';

export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [secondaryColor, setSecondaryColor] = useState('#ffd700');
  const [vatRate, setVatRate] = useState('20');
  const [currencySymbol, setCurrencySymbol] = useState('£');
  const [currencyCode, setCurrencyCode] = useState('GBP');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const { signUp, user, userProfile } = useAuth();
  const { organization } = useOrganization();
  const navigate = useNavigate();
  const navigationTriggered = useRef(false);

  // Navigate only when both profile and organization are fully loaded
  useEffect(() => {
    if (creatingAccount && !navigationTriggered.current && userProfile && organization) {
      console.log('✅ Profile and organization ready, navigating to dashboard');
      navigationTriggered.current = true;
      navigate('/dashboard');
    }
  }, [userProfile, organization, creatingAccount, navigate]);

  // Fallback: force navigation after 12 seconds (prevents infinite loader)
  useEffect(() => {
    if (creatingAccount && !navigationTriggered.current) {
      const timeout = setTimeout(() => {
        if (!navigationTriggered.current) {
          console.warn('⚠️ Fallback navigation triggered after timeout');
          navigationTriggered.current = true;
          navigate('/dashboard');
        }
      }, 12000);
      return () => clearTimeout(timeout);
    }
  }, [creatingAccount, navigate]);

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError('Logo must be less than 2MB');
      return;
    }
    setUploadingLogo(true);
    const reader = new FileReader();
    reader.onloadend = () => {
      setLogoUrl(reader.result);
      setUploadingLogo(false);
    };
    reader.onerror = () => {
      setUploadingLogo(false);
      setError('Failed to read logo file');
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setCreatingAccount(true);
    navigationTriggered.current = false;

    try {
      await signUp(
        email,
        password,
        name,
        organizationName,
        logoUrl,
        '#2e7d32',      // default primary – theme will override
        secondaryColor,
        parseFloat(vatRate),
        currencySymbol,
        currencyCode
      );
      // Navigation will happen in the useEffect above
    } catch (err) {
      console.error('Signup error:', err);
      setError(err.message);
      setCreatingAccount(false);
    } finally {
      setLoading(false);
    }
  };

  // Full‑page loader while account is being created
  if (creatingAccount) {
    return (
      <div className="sp-loader-fullscreen">
        <div className="sp-loader-content">
          <div className="sp-loader-spinner"></div>
          <h3>Creating your account...</h3>
          <p>Setting up your organization and workspace</p>
        </div>
      </div>
    );
  }

  // Signup form (unchanged)
  return (
    <div className="sp-container">
      <div className="sp-card">
        <div className="sp-header">
          <h1>Create Your Organization</h1>
          <p>Set up your financial management system</p>
        </div>

        <form onSubmit={handleSubmit} className="sp-form">
          {/* Organization Details */}
          <div className="sp-section">
            <h3><i className="fas fa-building"></i> Organization Details</h3>

            <div className="sp-group">
              <label>Organization Name *</label>
              <input
                type="text"
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                placeholder="e.g., Acme Corp"
                required
              />
            </div>

            <div className="sp-group">
              <label>Organization Logo (optional)</label>
              <div className="logo-upload-area">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="logo-input"
                />
                {logoUrl ? (
                  <div className="logo-preview">
                    <img src={logoUrl} alt="Preview" />
                    <button type="button" onClick={() => setLogoUrl('')}>
                      <i className="fas fa-times"></i>
                    </button>
                  </div>
                ) : (
                  <div className="logo-placeholder">
                    <i className="fas fa-cloud-upload-alt"></i>
                    <p>Click to upload logo</p>
                    <small>PNG, JPG up to 2MB</small>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Branding – only secondary color */}
          <div className="sp-section">
            <h3><i className="fas fa-palette"></i> Branding</h3>

            <div className="sp-group">
              <label>Secondary / Accent Color</label>
              <div className="color-picker-wrapper">
                <input
                  type="color"
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                />
                <span>{secondaryColor}</span>
              </div>
              <small>Used for highlights, badges, and active states</small>
            </div>
          </div>

          {/* Financial Settings */}
          <div className="sp-section">
            <h3><i className="fas fa-chart-line"></i> Financial Settings</h3>

            <div className="sp-row">
              <div className="sp-group">
                <label>VAT Rate (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={vatRate}
                  onChange={(e) => setVatRate(e.target.value)}
                />
                <small>Leave 0 if VAT doesn't apply</small>
              </div>

              <div className="sp-group">
                <label>Currency</label>
                <select
                  value={currencyCode}
                  onChange={(e) => {
                    setCurrencyCode(e.target.value);
                    const symbols = { GBP: '£', USD: '$', EUR: '€', NGN: '₦', KES: 'KSh', UGX: 'USh' };
                    setCurrencySymbol(symbols[e.target.value] || '£');
                  }}
                >
                  <option value="GBP">British Pound (£)</option>
                  <option value="USD">US Dollar ($)</option>
                  <option value="EUR">Euro (€)</option>
                  <option value="NGN">Nigerian Naira (₦)</option>
                  <option value="KES">Kenyan Shilling (KSh)</option>
                  <option value="UGX">Ugandan Shilling (USh)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Admin User Details */}
          <div className="sp-section">
            <h3><i className="fas fa-user-shield"></i> Admin Account</h3>

            <div className="sp-group">
              <label>Full Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="sp-group">
              <label>Email Address *</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="sp-group">
              <label>Password *</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          {error && <div className="sp-error">{error}</div>}

          <button type="submit" className="sp-btn" disabled={loading || uploadingLogo}>
            {loading ? 'Creating Organization...' : 'Create Organization'}
          </button>
        </form>

        <p className="sp-footer">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}