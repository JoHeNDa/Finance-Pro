import { useState, useEffect } from 'react';
import { useOrganization } from '../context/OrganizationContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import '../styles/organizationSettings.css';

export default function OrganizationSettings() {
  const { organization, updateOrganization, refresh, loading: orgLoading } = useOrganization();
  const { userProfile } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    logo_url: '',
    secondary_color: '#ffd700',
    vat_rate: 20,
    currency_symbol: '£',
    currency_code: 'GBP',
    enable_vat: true,
    enable_receipts: true,
    enable_notifications: true,
  });
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    if (organization) {
      setFormData({
        name: organization.name || '',
        logo_url: organization.logo_url || '',
        secondary_color: organization.theme?.secondaryColor || '#ffd700',
        vat_rate: organization.vat_rate || 20,
        currency_symbol: organization.currency_symbol || '£',
        currency_code: organization.currency_code || 'GBP',
        enable_vat: organization.settings?.enableVAT ?? true,
        enable_receipts: organization.settings?.enableReceipts ?? true,
        enable_notifications: organization.settings?.enableNotifications ?? true,
      });
    }
  }, [organization]);

  const isAdmin = userProfile?.role === 'owner' || userProfile?.role === 'admin';

  if (!isAdmin) {
    return (
      <div className="access-denied-card">
        <div className="access-denied-icon">
          <i className="fas fa-lock"></i>
        </div>
        <h2>Access Denied</h2>
        <p>Only organization owners and admins can access settings.</p>
      </div>
    );
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'Logo must be less than 2MB' });
      return;
    }

    setUploadingLogo(true);

    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData(prev => ({ ...prev, logo_url: reader.result }));
      setUploadingLogo(false);
      setMessage({ type: 'success', text: 'Logo uploaded! Click Save to apply.' });
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    };
    reader.onerror = () => {
      setUploadingLogo(false);
      setMessage({ type: 'error', text: 'Failed to read logo file' });
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: '', text: '' });

    try {
      if (!formData.name || formData.name.trim() === '') {
        throw new Error('Organization name is required');
      }

      const updates = {
        name: formData.name.trim(),
        logo_url: formData.logo_url || null,
        theme: {
          primaryColor: organization?.theme?.primaryColor || '#2e7d32',
          secondaryColor: formData.secondary_color,
          accentColor: formData.secondary_color,
          fontFamily: 'Inter'
        },
        vat_rate: parseFloat(formData.vat_rate) || 0,
        currency_symbol: formData.currency_symbol,
        currency_code: formData.currency_code,
        settings: {
          enableVAT: formData.enable_vat,
          enableReceipts: formData.enable_receipts,
          enableMultipleCurrencies: false,
          enableBudgeting: false,
          enableNotifications: formData.enable_notifications,
        }
      };

      await updateOrganization(updates);
      await refresh();

      setMessage({ type: 'success', text: 'Settings saved! Reloading...' });

      setTimeout(() => {
        window.location.reload();
      }, 1500);

    } catch (err) {
      console.error('Save error:', err);
      setMessage({ type: 'error', text: err.message || 'Failed to save settings' });
      setSaving(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    setMessage({ type: '', text: '' });

    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('organization_id', organization.id)
        .order('date', { ascending: false });

      if (error) throw error;

      if (!data || data.length === 0) {
        setMessage({ type: 'error', text: 'No transactions to export' });
        setExporting(false);
        return;
      }

      const headers = ['Date', 'Type', 'Particular', 'Description', 'Amount', 'VAT', 'Payment Mode', 'Receipt URL'];
      const rows = data.map(tx => [
        tx.date,
        tx.type,
        tx.particular,
        tx.description || '',
        tx.amount,
        tx.vat_amount || 0,
        tx.payment_mode,
        tx.receipt_url || '',
      ]);

      const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `transactions_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setMessage({ type: 'success', text: `Exported ${data.length} transactions!` });
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to export: ' + err.message });
    } finally {
      setExporting(false);
    }
  };

  const handleRemoveLogo = () => {
    setFormData(prev => ({ ...prev, logo_url: '' }));
    setMessage({ type: 'success', text: 'Logo removed. Click Save to apply.' });
    setTimeout(() => setMessage({ type: '', text: '' }), 3000);
  };

  if (orgLoading) {
    return (
      <div className="loading-spinner">
        <div className="spinner"></div>
        <p>Loading organization...</p>
      </div>
    );
  }

  return (
    <div className="org-settings-page">
      <div className="settings-header">
        <p>Customize your organization's branding and financial settings</p>
      </div>

      {message.text && (
        <div className={`notification ${message.type}`}>
          <i className={`fas ${message.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}`}></i>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="settings-form">
        {/* Basic Information */}
        <div className="settings-card">
          <h2><i className="fas fa-info-circle"></i> Basic Information</h2>

          <div className="form-group">
            <label htmlFor="org-name">Organization Name *</label>
            <input
              type="text"
              id="org-name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label>Organization Logo</label>
            <div className="logo-upload-area" onClick={() => document.getElementById('logo-input').click()}>
              <input
                id="logo-input"
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                style={{ display: 'none' }}
              />
              {formData.logo_url ? (
                <div className="logo-preview">
                  <img src={formData.logo_url} alt="Logo" />
                  <button type="button" className="logo-remove" onClick={handleRemoveLogo}>×</button>
                </div>
              ) : (
                <div className="logo-placeholder">
                  <i className="fas fa-cloud-upload-alt"></i>
                  <p>Click to upload logo</p>
                  <small>PNG, JPG up to 2MB</small>
                </div>
              )}
              {uploadingLogo && <p>Uploading...</p>}
            </div>
          </div>
        </div>

        {/* Branding Section – Only Secondary Color */}
        <div className="settings-card">
          <h2><i className="fas fa-palette"></i> Branding Colors</h2>
          <p style={{ marginBottom: '20px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Customize your organization's accent color. This will appear for highlights, badges, and active states.
          </p>

          <div className="form-group">
            <label>Secondary / Accent Color</label>
            <div className="color-input-wrapper">
              <input
                type="color"
                name="secondary_color"
                value={formData.secondary_color}
                onChange={handleChange}
                className="color-picker"
              />
              <span className="color-value">{formData.secondary_color}</span>
            </div>
            <small>Used for highlights, badges, active navigation, and important accents</small>
          </div>

          {/* Live Preview */}
          <div className="preview-section">
            <h3>Live Preview</h3>
            <div className="preview-buttons">
              <button
                type="button"
                className="preview-secondary"
                style={{ backgroundColor: formData.secondary_color, color: '#1e293b' }}
              >
                Accent Button
              </button>
            </div>
            <div className="preview-badge">
              <span className="badge-example" style={{ backgroundColor: formData.secondary_color, color: '#1e293b' }}>
                Accent Badge
              </span>
            </div>
          </div>
        </div>

        {/* Financial Settings */}
        <div className="settings-card">
          <h2><i className="fas fa-chart-line"></i> Financial Settings</h2>

          <div className="form-row">
            <div className="form-group">
              <label>VAT Rate (%)</label>
              <input
                type="number"
                name="vat_rate"
                value={formData.vat_rate}
                onChange={handleChange}
                step="0.1"
              />
              <small>Set to 0 if VAT doesn't apply</small>
            </div>

            <div className="form-group">
              <label>Currency</label>
              <select name="currency_code" value={formData.currency_code} onChange={(e) => {
                const symbols = { GBP: '£', USD: '$', EUR: '€', NGN: '₦', KES: 'KSh', UGX: 'USh' };
                setFormData(prev => ({
                  ...prev,
                  currency_code: e.target.value,
                  currency_symbol: symbols[e.target.value] || '£'
                }));
              }}>
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

        {/* Feature Toggles */}
        <div className="settings-card">
          <h2><i className="fas fa-toggle-on"></i> Features</h2>

          <label className="checkbox-label">
            <input type="checkbox" name="enable_vat" checked={formData.enable_vat} onChange={handleChange} />
            <span>Enable VAT calculation</span>
          </label>
          <label className="checkbox-label">
            <input type="checkbox" name="enable_receipts" checked={formData.enable_receipts} onChange={handleChange} />
            <span>Enable receipt attachments</span>
          </label>
          <label className="checkbox-label">
            <input type="checkbox" name="enable_notifications" checked={formData.enable_notifications} onChange={handleChange} />
            <span>Enable email notifications</span>
          </label>
        </div>

        {/* Data Backup */}
        <div className="settings-card">
          <h2><i className="fas fa-database"></i> Data Backup</h2>
          <button type="button" onClick={handleExport} disabled={exporting} className="backup-btn">
            <i className="fas fa-download"></i> {exporting ? 'Exporting...' : 'Export All Data (CSV)'}
          </button>
        </div>

        <div className="form-actions">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}