import { useState, useEffect } from 'react';
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
  const [message, setMessage] = useState({ type: '', text: '' });
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
            darkMode: data.preferences?.darkMode ?? (theme === 'dark'),
          },
        }));
      }
    };
    
    loadUserProfile();
  }, [user, theme]);

  const handleDarkModeToggle = (checked) => {
    const newTheme = checked ? 'dark' : 'light';
    changeTheme(newTheme);
    setFormData(prev => ({
      ...prev,
      preferences: { ...prev.preferences, darkMode: checked },
    }));
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
      setMessage({ type: 'error', text: 'Avatar must be less than 2MB' });
      return;
    }
    
    setUploadingAvatar(true);
    
    const fileName = `avatars/${user.id}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, file);
    
    if (uploadError) {
      setMessage({ type: 'error', text: 'Failed to upload avatar' });
      setUploadingAvatar(false);
      return;
    }
    
    const { data: publicUrl } = supabase.storage
      .from('avatars')
      .getPublicUrl(fileName);
    
    setFormData(prev => ({ ...prev, avatar_url: publicUrl.publicUrl }));
    setUploadingAvatar(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: '', text: '' });
    
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
      
      setMessage({ type: 'success', text: 'Profile updated successfully!' });
      if (refreshProfile) refreshProfile();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="user-profile-page">
      <div className="profile-header">
        <p>Manage your personal information and preferences</p>
      </div>
      
      {message.text && (
        <div className={`notification ${message.type}`}>
          {message.text}
        </div>
      )}
      
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
              <button type="submit" className="btn-primary" disabled={saving || uploadingAvatar}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}