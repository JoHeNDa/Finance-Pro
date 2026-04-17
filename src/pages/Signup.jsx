import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useOrganization } from '../context/OrganizationContext';
import '../styles/signup.css';

export default function Signup() {
  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [secondaryColor, setSecondaryColor] = useState('#ffd700');
  const [vatRate, setVatRate] = useState('20');
  const [currencySymbol, setCurrencySymbol] = useState('£');
  const [currencyCode, setCurrencyCode] = useState('GBP');
  
  // UI state
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [loading, setLoading] = useState(false);
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Caps lock states
  const [capsLockOnPassword, setCapsLockOnPassword] = useState(false);
  const [capsLockOnConfirm, setCapsLockOnConfirm] = useState(false);
  
  const { signUp, user, userProfile } = useAuth();
  const { organization } = useOrganization();
  const navigate = useNavigate();
  const navigationTriggered = useRef(false);
  const fileInputRef = useRef(null);

  // Navigation after successful signup
  useEffect(() => {
    if (creatingAccount && !navigationTriggered.current && userProfile && organization) {
      console.log('✅ Profile and organization ready, navigating to dashboard');
      navigationTriggered.current = true;
      navigate('/dashboard');
    }
  }, [userProfile, organization, creatingAccount, navigate]);

  // Fallback navigation timeout
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

  // Helper to detect caps lock
  const handleCapsLock = (e, setter) => {
    if (e.getModifierState && e.getModifierState('CapsLock')) {
      setter(true);
    } else {
      setter(false);
    }
  };

  // Password strength calculator
  const calculatePasswordStrength = (pass) => {
    let strength = 0;
    if (pass.length >= 8) strength++;
    if (pass.match(/[a-z]/) && pass.match(/[A-Z]/)) strength++;
    if (pass.match(/\d/)) strength++;
    if (pass.match(/[^a-zA-Z\d]/)) strength++;
    return strength;
  };

  // Handle password change with strength update
  const handlePasswordChange = (e) => {
    const newPassword = e.target.value;
    setPassword(newPassword);
    setPasswordStrength(calculatePasswordStrength(newPassword));
    if (touched.confirmPassword && confirmPassword && newPassword !== confirmPassword) {
      setErrors(prev => ({ ...prev, confirmPassword: 'Passwords do not match' }));
    } else if (touched.confirmPassword && confirmPassword && newPassword === confirmPassword) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.confirmPassword;
        return newErrors;
      });
    }
  };

  // Validation function
  const validateForm = () => {
    const newErrors = {};
    
    if (!organizationName.trim()) {
      newErrors.organizationName = 'Organization name is required';
    }
    
    if (!name.trim()) {
      newErrors.name = 'Full name is required';
    } else if (name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    }
    
    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Email is invalid';
    }
    
    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    } else if (passwordStrength < 3) {
      newErrors.password = 'Password is too weak (use uppercase, lowercase, numbers, and symbols)';
    }
    
    if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    
    const vat = parseFloat(vatRate);
    if (isNaN(vat) || vat < 0 || vat > 100) {
      newErrors.vatRate = 'VAT rate must be between 0 and 100';
    }
    
    if (!agreeTerms) {
      newErrors.agreeTerms = 'You must agree to the terms and conditions';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleBlur = (field) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      setErrors(prev => ({ ...prev, logo: 'Please upload an image file' }));
      return;
    }
    
    if (file.size > 2 * 1024 * 1024) {
      setErrors(prev => ({ ...prev, logo: 'Logo must be less than 2MB' }));
      return;
    }
    
    setUploadingLogo(true);
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors.logo;
      return newErrors;
    });
    
    const reader = new FileReader();
    reader.onloadend = () => {
      setLogoUrl(reader.result);
      setUploadingLogo(false);
    };
    reader.onerror = () => {
      setUploadingLogo(false);
      setErrors(prev => ({ ...prev, logo: 'Failed to read logo file' }));
    };
    reader.readAsDataURL(file);
  };

  const removeLogo = () => {
    setLogoUrl('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      // Scroll to first error
      const firstErrorField = Object.keys(errors)[0];
      const element = document.querySelector(`[name="${firstErrorField}"]`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.focus();
      }
      return;
    }
    
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
        null, // primary color
        secondaryColor,
        parseFloat(vatRate),
        currencySymbol,
        currencyCode
      );
    } catch (err) {
      console.error('Signup error:', err);
      setErrors({ general: err.message });
      setCreatingAccount(false);
    } finally {
      setLoading(false);
    }
  };

  // Get password strength label and color
  const getStrengthLabel = () => {
    switch (passwordStrength) {
      case 0: return { text: 'Very Weak', color: '#ef4444' };
      case 1: return { text: 'Weak', color: '#f59e0b' };
      case 2: return { text: 'Fair', color: '#eab308' };
      case 3: return { text: 'Good', color: '#10b981' };
      case 4: return { text: 'Strong', color: '#059669' };
      default: return { text: '', color: '#cbd5e1' };
    }
  };

  const strength = getStrengthLabel();

  if (creatingAccount) {
    return (
      <div className="sp-loader-fullscreen">
        <div className="sp-loader-content">
          <div className="sp-loader-spinner"></div>
          <h3>Creating your workspace</h3>
          <p>Setting up your organization and secure environment</p>
          <div className="sp-loader-steps">
            <div className="sp-step">
              <i className="fas fa-check-circle"></i>
              <span>Securing your account</span>
            </div>
            <div className="sp-step">
              <i className="fas fa-spinner fa-pulse"></i>
              <span>Configuring organization settings</span>
            </div>
            <div className="sp-step">
              <i className="fas fa-spinner fa-pulse"></i>
              <span>Preparing your dashboard</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="sp-scroll-container">
      <div className="sp-page">
        <div className="sp-header-section">
          <h1 className="sp-page-title">
            Get Started
          </h1>
          <p className="sp-page-subtitle">
            Create your organization and start managing finances professionally
          </p>
        </div>

        <form onSubmit={handleSubmit} className="sp-form" noValidate>
          {/* Organization Details Card */}
          <div className="sp-section-card">
            <div className="sp-card-header">
              <h3><i className="fas fa-building"></i> Organization Details</h3>
            </div>
            <div className="sp-card-body">
              <div className="sp-group">
                <label>
                  Organization Name <span className="sp-required">*</span>
                </label>
                <input
                  type="text"
                  name="organizationName"
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                  onBlur={() => handleBlur('organizationName')}
                  placeholder="e.g., Acme Corporation"
                  className={touched.organizationName && errors.organizationName ? 'sp-error-input' : ''}
                />
                {touched.organizationName && errors.organizationName && (
                  <div className="sp-field-error">{errors.organizationName}</div>
                )}
              </div>

              <div className="sp-group">
                <label>Organization Logo</label>
                <div 
                  className={`logo-upload-area ${uploadingLogo ? 'sp-uploading' : ''}`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files[0];
                    if (file) handleLogoUpload({ target: { files: [file] } });
                  }}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="logo-input"
                  />
                  {uploadingLogo ? (
                    <div className="logo-uploading">
                      <i className="fas fa-spinner fa-pulse"></i>
                      <p>Uploading...</p>
                    </div>
                  ) : logoUrl ? (
                    <div className="logo-preview">
                      <img src={logoUrl} alt="Organization logo" />
                      <button 
                        type="button" 
                        onClick={(e) => {
                          e.stopPropagation();
                          removeLogo();
                        }}
                        className="sp-remove-logo"
                      >
                        <i className="fas fa-times"></i>
                      </button>
                    </div>
                  ) : (
                    <div className="logo-placeholder">
                      <i className="fas fa-cloud-upload-alt"></i>
                      <p>Click or drag to upload logo</p>
                      <small>PNG, JPG up to 2MB</small>
                    </div>
                  )}
                </div>
                {errors.logo && <div className="sp-field-error">{errors.logo}</div>}
              </div>
            </div>
          </div>

          {/* Branding Card */}
          <div className="sp-section-card">
            <div className="sp-card-header">
              <h3><i className="fas fa-palette"></i> Branding</h3>
            </div>
            <div className="sp-card-body">
              <div className="sp-group">
                <label>Brand Accent Color</label>
                <div className="color-picker-wrapper">
                  <input
                    type="color"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                  />
                  <div className="color-preview" style={{ backgroundColor: secondaryColor }}></div>
                  <span className="color-value">{secondaryColor}</span>
                </div>
                <small>Used for buttons, highlights, and active states across your dashboard</small>
              </div>
            </div>
          </div>

          {/* Financial Settings Card */}
          <div className="sp-section-card">
            <div className="sp-card-header">
              <h3><i className="fas fa-chart-line"></i> Financial Settings</h3>
            </div>
            <div className="sp-card-body">
              <div className="sp-row">
                <div className="sp-group">
                  <label>VAT Rate (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={vatRate}
                    onChange={(e) => setVatRate(e.target.value)}
                    onBlur={() => handleBlur('vatRate')}
                    className={touched.vatRate && errors.vatRate ? 'sp-error-input' : ''}
                  />
                  {touched.vatRate && errors.vatRate && (
                    <div className="sp-field-error">{errors.vatRate}</div>
                  )}
                  <small>Leave 0 if VAT doesn't apply to your business</small>
                </div>
                <div className="sp-group">
                  <label>Base Currency</label>
                  <select
                    value={currencyCode}
                    onChange={(e) => {
                      setCurrencyCode(e.target.value);
                      const symbols = { 
                        GBP: '£', USD: '$', EUR: '€', 
                        NGN: '₦', KES: 'KSh', UGX: 'USh',
                        CAD: 'C$', AUD: 'A$', JPY: '¥', CNY: '¥'
                      };
                      setCurrencySymbol(symbols[e.target.value] || '£');
                    }}
                  >
                    <option value="GBP">British Pound (£)</option>
                    <option value="USD">US Dollar ($)</option>
                    <option value="EUR">Euro (€)</option>
                    <option value="NGN">Nigerian Naira (₦)</option>
                    <option value="KES">Kenyan Shilling (KSh)</option>
                    <option value="UGX">Ugandan Shilling (USh)</option>
                    <option value="CAD">Canadian Dollar (C$)</option>
                    <option value="AUD">Australian Dollar (A$)</option>
                    <option value="JPY">Japanese Yen (¥)</option>
                    <option value="CNY">Chinese Yuan (¥)</option>
                  </select>
                  <small>All financial transactions will use this currency</small>
                </div>
              </div>
            </div>
          </div>

          {/* Admin Account Card */}
          <div className="sp-section-card">
            <div className="sp-card-header">
              <h3><i className="fas fa-user-shield"></i> Admin Account</h3>
            </div>
            <div className="sp-card-body">
              <div className="sp-group">
                <label>
                  Full Name <span className="sp-required">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={() => handleBlur('name')}
                  className={touched.name && errors.name ? 'sp-error-input' : ''}
                />
                {touched.name && errors.name && <div className="sp-field-error">{errors.name}</div>}
              </div>

              <div className="sp-group">
                <label>
                  Email Address <span className="sp-required">*</span>
                </label>
                <input
                  type="email"
                  name="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => handleBlur('email')}
                  className={touched.email && errors.email ? 'sp-error-input' : ''}
                />
                {touched.email && errors.email && <div className="sp-field-error">{errors.email}</div>}
              </div>

              {/* Password field with caps lock indicator */}
              <div className="sp-group">
                <label>
                  Password <span className="sp-required">*</span>
                </label>
                <div className="sp-password-wrapper">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={password}
                    onChange={handlePasswordChange}
                    onBlur={() => handleBlur('password')}
                    onKeyDown={(e) => handleCapsLock(e, setCapsLockOnPassword)}
                    className={touched.password && errors.password ? 'sp-error-input' : ''}
                  />
                  <button
                    type="button"
                    className="sp-toggle-password"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                  </button>
                </div>
                {capsLockOnPassword && (
                  <div className="sp-caps-warning">
                    <i className="fas fa-exclamation-triangle"></i> Caps Lock is on
                  </div>
                )}
                {touched.password && errors.password && (
                  <div className="sp-field-error">{errors.password}</div>
                )}
                {password && (
                  <div className="sp-password-strength">
                    <div className="sp-strength-bar">
                      <div 
                        className="sp-strength-fill" 
                        style={{ 
                          width: `${(passwordStrength / 4) * 100}%`,
                          backgroundColor: strength.color
                        }}
                      ></div>
                    </div>
                    <span className="sp-strength-label" style={{ color: strength.color }}>
                      {strength.text}
                    </span>
                  </div>
                )}
              </div>

              {/* Confirm Password field with caps lock indicator */}
              <div className="sp-group">
                <label>
                  Confirm Password <span className="sp-required">*</span>
                </label>
                <div className="sp-password-wrapper">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (password && e.target.value !== password) {
                        setErrors(prev => ({ ...prev, confirmPassword: 'Passwords do not match' }));
                      } else if (password && e.target.value === password) {
                        setErrors(prev => {
                          const newErrors = { ...prev };
                          delete newErrors.confirmPassword;
                          return newErrors;
                        });
                      }
                    }}
                    onBlur={() => handleBlur('confirmPassword')}
                    onKeyDown={(e) => handleCapsLock(e, setCapsLockOnConfirm)}
                    className={touched.confirmPassword && errors.confirmPassword ? 'sp-error-input' : ''}
                  />
                  <button
                    type="button"
                    className="sp-toggle-password"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    <i className={`fas ${showConfirmPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                  </button>
                </div>
                {capsLockOnConfirm && (
                  <div className="sp-caps-warning">
                    <i className="fas fa-exclamation-triangle"></i> Caps Lock is on
                  </div>
                )}
                {touched.confirmPassword && errors.confirmPassword && (
                  <div className="sp-field-error">{errors.confirmPassword}</div>
                )}
              </div>
            </div>
          </div>

          {/* Terms and Conditions */}
          <div className="sp-terms">
            <label className="sp-checkbox-label">
              <input
                type="checkbox"
                checked={agreeTerms}
                onChange={(e) => setAgreeTerms(e.target.checked)}
              />
              <span className="sp-checkbox-custom"></span>
              <span>
                I agree to the <Link to="/terms" target="_blank">Terms of Service</Link> and{' '}
                <Link to="/privacy" target="_blank">Privacy Policy</Link>
              </span>
            </label>
            {touched.agreeTerms && errors.agreeTerms && (
              <div className="sp-field-error">{errors.agreeTerms}</div>
            )}
          </div>

          {errors.general && <div className="sp-error">{errors.general}</div>}

          <button 
            type="submit" 
            className="sp-btn" 
            disabled={loading || uploadingLogo}
          >
            {loading ? (
              <>
                <i className="fas fa-spinner fa-pulse"></i>
                Creating Organization...
              </>
            ) : (
              <>
                <i className="fas fa-check-circle"></i>
                Create Organization
              </>
            )}
          </button>
        </form>

        <p className="sp-footer">
          Already have an account? <Link to="/login">Sign in to your workspace</Link>
        </p>
      </div>
    </div>
  );
}