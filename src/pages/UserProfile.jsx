import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useOrganization } from '../context/OrganizationContext';
import { useTheme } from '../context/ThemeContext';
import '../styles/profile.css';

export default function UserProfile() {
  const { user, userProfile, refreshProfile } = useAuth();
  const { organization } = useOrganization();
  const { theme, changeTheme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: userProfile?.name || '',
    email: user?.email || '',
    phone: '',
    job_title: '',
    department: '',
    avatar_url: '',
    preferences: {
      notifications: true,
      emailReports: true,
      darkMode: theme === 'dark',
    },
  });
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [toast, setToast] = useState({ show: false, type: '', message: '' });
  const toastTimeoutRef = useRef(null);

  const showToast = (type, message) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ show: true, type, message });
    toastTimeoutRef.current = setTimeout(() => {
      setToast({ show: false, type: '', message: '' });
    }, 4000);
  };

  useEffect(() => {
    const loadUserProfile = async () => {
      if (!user?.id) return;
      
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        console.error('Error loading user profile:', error);
      } else if (data) {
        setFormData(prev => ({
          ...prev,
          phone: data.phone || '',
          job_title: data.job_title || '',
          department: data.department || '',
          avatar_url: data.avatar_url || '',
          preferences: {
            ...prev.preferences,
            ...(data.preferences || {}),
            darkMode: theme === 'dark',
          },
        }));
      }
    };
    
    loadUserProfile();
  }, [user]); // ✅ removed theme from dependencies

  const handleDarkModeToggle = async (checked) => {
    const newTheme = checked ? 'dark' : 'light';
    changeTheme(newTheme);
    setFormData(prev => ({
      ...prev,
      preferences: { ...prev.preferences, darkMode: checked },
    }));

    // Persist immediately in the background
    if (user?.id) {
      try {
        await supabase
          .from('user_profiles')
          .upsert({
            id: user.id,
            preferences: { ...formData.preferences, darkMode: checked },
            updated_at: new Date().toISOString(),
          });
      } catch (err) {
        console.error('Failed to persist dark mode preference:', err);
      }
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name === 'preferences.darkMode') {
      handleDarkModeToggle(checked);
    } else if (name.startsWith('preferences.')) {
      const prefKey = name.split('.')[1];
      setFormData(prev => ({
        ...prev,
        preferences: {
          ...prev.preferences,
          [prefKey]: type === 'checkbox' ? checked : value,
        },
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (file.size > 2 * 1024 * 1024) {
      showToast('error', 'Avatar must be less than 2MB');
      return;
    }
    
    setUploadingAvatar(true);
    
    const fileName = `avatars/${user.id}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, file);
    
    if (uploadError) {
      showToast('error', 'Failed to upload avatar');
      setUploadingAvatar(false);
      return;
    }
    
    const { data: publicUrl } = supabase.storage
      .from('avatars')
      .getPublicUrl(fileName);
    
    setFormData(prev => ({ ...prev, avatar_url: publicUrl.publicUrl }));
    setUploadingAvatar(false);
    showToast('success', 'Avatar uploaded! Click Save to apply.');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      const { error: userError } = await supabase
        .from('users')
        .update({ name: formData.name })
        .eq('id', user.id);
      
      if (userError) throw userError;
      
      const { error: profileError } = await supabase
        .from('user_profiles')
        .upsert({
          id: user.id,
          phone: formData.phone,
          job_title: formData.job_title,
          department: formData.department,
          avatar_url: formData.avatar_url,
          preferences: formData.preferences,
          updated_at: new Date().toISOString(),
        });
      
      if (profileError) throw profileError;
      
      showToast('success', 'Profile updated successfully!');
      if (refreshProfile) refreshProfile();
    } catch (err) {
      showToast('error', err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="user-profile-page">
      {/* Toast Notification */}
      {toast.show && (
        <div className={`toast-notification ${toast.type}`}>
          <i className={`fas ${toast.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}`}></i>
          <span>{toast.message}</span>
        </div>
      )}

      <div className="profile-header">
        <p>Manage your personal information and preferences</p>
      </div>
      
      <form onSubmit={handleSubmit} className="profile-form">
        <div className="profile-grid">
          <div className="profile-avatar-section">
            <div className="avatar-container">
              {formData.avatar_url ? (
                <img src={formData.avatar_url} alt="Avatar" className="avatar-preview" />
              ) : (
                <div className="avatar-placeholder">
                  <i className="fas fa-user"></i>
                </div>
              )}
              <div className="avatar-upload">
                <label htmlFor="avatar-input" className="avatar-upload-btn">
                  <i className="fas fa-camera"></i> Change Photo
                </label>
                <input
                  id="avatar-input"
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  style={{ display: 'none' }}
                />
              </div>
              {uploadingAvatar && <p className="uploading-text">Uploading...</p>}
            </div>
            <div className="org-info">
              <h3>{organization?.name}</h3>
              <p className="org-role">{userProfile?.role?.charAt(0).toUpperCase() + userProfile?.role?.slice(1)}</p>
            </div>
          </div>
          
          <div className="profile-form-section">
            <div className="form-card">
              <h2><i className="fas fa-id-card"></i> Personal Information</h2>
              
              <div className="form-group">
                <label>Full Name</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                />
              </div>
              
              <div className="form-group">
                <label>Email Address</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  disabled
                  className="disabled-input"
                />
                <small>Email cannot be changed</small>
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Phone Number</label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="+44 123 456 789"
                  />
                </div>
                
                <div className="form-group">
                  <label>Job Title</label>
                  <input
                    type="text"
                    name="job_title"
                    value={formData.job_title}
                    onChange={handleChange}
                    placeholder="e.g., Financial Manager"
                  />
                </div>
              </div>
              
              <div className="form-group">
                <label>Department</label>
                <input
                  type="text"
                  name="department"
                  value={formData.department}
                  onChange={handleChange}
                  placeholder="e.g., Finance, Sales, Operations"
                />
              </div>
            </div>
            
            <div className="form-card">
              <h2><i className="fas fa-bell"></i> Notification Preferences</h2>
              
              <div className="checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="preferences.notifications"
                    checked={formData.preferences.notifications}
                    onChange={handleChange}
                  />
                  <span>Enable push notifications</span>
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="preferences.emailReports"
                    checked={formData.preferences.emailReports}
                    onChange={handleChange}
                  />
                  <span>Receive monthly reports via email</span>
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="preferences.darkMode"
                    checked={formData.preferences.darkMode}
                    onChange={handleChange}
                  />
                  <span>Enable dark mode</span>
                </label>
              </div>
            </div>
            
            <div className="form-actions">
              <button type="submit" className="ap-invite-btn" disabled={saving || uploadingAvatar}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* Add the same toast CSS as in OrganizationSettings */}
      <style>{`
        .toast-notification {
          position: fixed;
          top: 20px;
          right: 20px;
          z-index: 10000;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 20px;
          border-radius: 12px;
          background: white;
          box-shadow: 0 8px 24px rgba(0,0,0,0.15);
          animation: slideIn 0.3s ease;
          border-left: 4px solid;
        }
        .toast-notification.success {
          border-left-color: #2e7d32;
          color: #2e7d32;
        }
        .toast-notification.error {
          border-left-color: #c62828;
          color: #c62828;
        }
        .toast-notification i {
          font-size: 20px;
        }
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}