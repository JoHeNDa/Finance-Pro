import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../utils/formatting';

export default function RecurringTransactions() {
  const { userProfile } = useAuth();
  const [recurring, setRecurring] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [formData, setFormData] = useState({
    type: 'Expense',
    particular: '',
    description: '',
    amount: '',
    vat_amount: 0,
    payment_mode: 'Cash',
    frequency: 'monthly',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    is_active: true,
  });

  const canManage = userProfile?.role === 'owner' || userProfile?.role === 'admin';

  useEffect(() => {
    if (userProfile?.organization_id) {
      fetchRecurring();
    }
  }, [userProfile]);

  const fetchRecurring = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('recurring_transactions')
      .select('*')
      .eq('organization_id', userProfile.organization_id)
      .order('next_processing_date', { ascending: true });
    
    if (!error) {
      setRecurring(data || []);
    } else {
      console.error('Error fetching recurring:', error);
      setMessage({ type: 'error', text: 'Failed to load recurring transactions' });
    }
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: '', text: '' });

    if (!formData.particular || !formData.amount) {
      setMessage({ type: 'error', text: 'Please fill in all required fields' });
      setSaving(false);
      return;
    }

    const data = {
      organization_id: userProfile.organization_id,
      user_id: userProfile.id,
      ...formData,
      amount: parseFloat(formData.amount),
      vat_amount: parseFloat(formData.vat_amount) || 0,
    };

    let error;
    if (editing) {
      const { error: updateError } = await supabase
        .from('recurring_transactions')
        .update(data)
        .eq('id', editing.id);
      error = updateError;
    } else {
      // Calculate next processing date
      data.next_processing_date = data.start_date;
      const { error: insertError } = await supabase
        .from('recurring_transactions')
        .insert([data]);
      error = insertError;
    }

    if (error) {
      setMessage({ type: 'error', text: error.message });
    } else {
      setMessage({ type: 'success', text: editing ? 'Recurring transaction updated!' : 'Recurring transaction created!' });
      fetchRecurring();
      setShowModal(false);
      resetForm();
    }
    setSaving(false);
  };

  const toggleActive = async (id, currentActive) => {
    const { error } = await supabase
      .from('recurring_transactions')
      .update({ is_active: !currentActive })
      .eq('id', id);
    
    if (!error) {
      fetchRecurring();
      setMessage({ type: 'success', text: `Transaction ${!currentActive ? 'activated' : 'paused'}` });
    } else {
      setMessage({ type: 'error', text: 'Failed to update status' });
    }
  };

  const resetForm = () => {
    setEditing(null);
    setFormData({
      type: 'Expense',
      particular: '',
      description: '',
      amount: '',
      vat_amount: 0,
      payment_mode: 'Cash',
      frequency: 'monthly',
      start_date: new Date().toISOString().split('T')[0],
      end_date: '',
      is_active: true,
    });
  };

  const handleEdit = (item) => {
    setEditing(item);
    setFormData({
      type: item.type,
      particular: item.particular,
      description: item.description || '',
      amount: item.amount,
      vat_amount: item.vat_amount,
      payment_mode: item.payment_mode,
      frequency: item.frequency,
      start_date: item.start_date,
      end_date: item.end_date || '',
      is_active: item.is_active,
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this recurring transaction?')) return;
    
    const { error } = await supabase
      .from('recurring_transactions')
      .delete()
      .eq('id', id);
    
    if (error) {
      setMessage({ type: 'error', text: error.message });
    } else {
      setMessage({ type: 'success', text: 'Recurring transaction deleted!' });
      fetchRecurring();
    }
  };

  const getFrequencyLabel = (frequency) => {
    const labels = {
      daily: 'Daily',
      weekly: 'Weekly',
      monthly: 'Monthly',
      quarterly: 'Quarterly',
      yearly: 'Yearly',
    };
    return labels[frequency] || frequency;
  };

  const getFrequencyClass = (frequency) => {
    const classes = {
      daily: 'frequency-daily',
      weekly: 'frequency-weekly',
      monthly: 'frequency-monthly',
      quarterly: 'frequency-quarterly',
      yearly: 'frequency-yearly',
    };
    return classes[frequency] || '';
  };

  if (!canManage) {
    return (
      <div className="access-denied-card">
        <div className="access-denied-icon">
          <i className="fas fa-lock"></i>
        </div>
        <h2>Access Denied</h2>
        <p>Only organization owners and admins can manage recurring transactions.</p>
      </div>
    );
  }

  return (
    <div className="recurring-page">
      <div className="page-header">
        <div>
          <h1><i className="fas fa-repeat"></i> Recurring Transactions</h1>
          <p>Set up automatic recurring revenue and expense transactions</p>
        </div>
        <button className="btn-primary" onClick={() => {
          resetForm();
          setShowModal(true);
        }}>
          <i className="fas fa-plus"></i> Add Recurring
        </button>
      </div>

      {message.text && (
        <div className={`notification ${message.type}`} style={{ display: 'block', marginBottom: '20px' }}>
          {message.text}
        </div>
      )}

      {loading ? (
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading recurring transactions...</p>
        </div>
      ) : recurring.length === 0 ? (
        <div className="empty-state">
          <i className="fas fa-repeat"></i>
          <p>No recurring transactions set up yet</p>
          <button className="btn-primary" onClick={() => setShowModal(true)}>
            Create your first recurring transaction
          </button>
        </div>
      ) : (
        <div className="recurring-grid">
          {recurring.map(item => (
            <div key={item.id} className={`recurring-card ${!item.is_active ? 'inactive' : ''}`}>
              <div className="recurring-header">
                <h3>{item.particular}</h3>
                <div className={`recurring-badge ${getFrequencyClass(item.frequency)}`}>
                  {getFrequencyLabel(item.frequency)}
                </div>
              </div>
              
              <div className="recurring-details">
                <div className="detail">
                  <span>Type:</span>
                  <strong className={item.type === 'Revenue' ? 'income-text' : 'expense-text'}>
                    {item.type}
                  </strong>
                </div>
                <div className="detail">
                  <span>Amount:</span>
                  <strong>{formatCurrency(item.amount)}</strong>
                </div>
                <div className="detail">
                  <span>VAT:</span>
                  <span>{formatCurrency(item.vat_amount || 0)}</span>
                </div>
                <div className="detail">
                  <span>Payment:</span>
                  <span>{item.payment_mode}</span>
                </div>
                <div className="detail">
                  <span>Next:</span>
                  <span>{new Date(item.next_processing_date).toLocaleDateString()}</span>
                </div>
                <div className="detail">
                  <span>Status:</span>
                  <span className={`status-badge ${item.is_active ? 'active' : 'inactive'}`}>
                    {item.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
              
              <div className="recurring-actions">
                <button className="btn-toggle" onClick={() => toggleActive(item.id, item.is_active)}>
                  <i className={`fas ${item.is_active ? 'fa-pause' : 'fa-play'}`}></i>
                  {item.is_active ? 'Pause' : 'Resume'}
                </button>
                <button className="btn-edit" onClick={() => handleEdit(item)}>
                  <i className="fas fa-edit"></i> Edit
                </button>
                <button className="btn-delete" onClick={() => handleDelete(item.id)}>
                  <i className="fas fa-trash"></i> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal for create/edit */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <i className="fas fa-repeat"></i>
              <h2>{editing ? 'Edit' : 'Create'} Recurring Transaction</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Type *</label>
                  <select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                    <option value="Expense">Expense</option>
                    <option value="Revenue">Revenue</option>
                  </select>
                </div>
                
                <div className="form-group">
                  <label>Category / Particular *</label>
                  <input
                    type="text"
                    value={formData.particular}
                    onChange={e => setFormData({...formData, particular: e.target.value})}
                    placeholder="e.g., Rent, Subscription, Client Payment"
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    value={formData.description}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                    rows="3"
                    placeholder="Additional details about this recurring transaction"
                  />
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label>Amount *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.amount}
                      onChange={e => setFormData({...formData, amount: e.target.value})}
                      placeholder="0.00"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>VAT Amount</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.vat_amount}
                      onChange={e => setFormData({...formData, vat_amount: e.target.value})}
                      placeholder="0.00"
                    />
                  </div>
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label>Payment Mode *</label>
                    <select value={formData.payment_mode} onChange={e => setFormData({...formData, payment_mode: e.target.value})}>
                      <option value="Cash">Cash</option>
                      <option value="Bank">Bank Transfer</option>
                      <option value="Card">Card Payment</option>
                      <option value="Mobile Money">Mobile Money</option>
                      <option value="Online">Online Transfer</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Frequency *</label>
                    <select value={formData.frequency} onChange={e => setFormData({...formData, frequency: e.target.value})} required>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  </div>
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label>Start Date *</label>
                    <input
                      type="date"
                      value={formData.start_date}
                      onChange={e => setFormData({...formData, start_date: e.target.value})}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>End Date (optional)</label>
                    <input
                      type="date"
                      value={formData.end_date}
                      onChange={e => setFormData({...formData, end_date: e.target.value})}
                    />
                    <small>Leave empty for indefinite</small>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : (editing ? 'Update' : 'Create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .recurring-page {
          padding: 24px;
          max-width: 1200px;
          margin: 0 auto;
        }
        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 32px;
        }
        .page-header h1 {
          margin: 0 0 8px;
          font-size: 1.75rem;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .page-header p {
          margin: 0;
          color: #64748b;
        }
        .recurring-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
          gap: 20px;
          margin-top: 20px;
        }
        .recurring-card {
          background: white;
          border-radius: 20px;
          padding: 20px;
          box-shadow: 0 2px 12px rgba(0,0,0,0.05);
          transition: all 0.2s;
          border-left: 4px solid #2e7d32;
        }
        .recurring-card.inactive {
          opacity: 0.7;
          border-left-color: #9e9e9e;
        }
        .recurring-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0,0,0,0.1);
        }
        .recurring-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
          padding-bottom: 12px;
          border-bottom: 1px solid #e9ecef;
        }
        .recurring-header h3 {
          margin: 0;
          font-size: 1.1rem;
          color: #1e293b;
        }
        .recurring-badge {
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 0.7rem;
          font-weight: 600;
          text-transform: uppercase;
        }
        .frequency-daily { background: #e3f2fd; color: #1565c0; }
        .frequency-weekly { background: #e8f5e9; color: #2e7d32; }
        .frequency-monthly { background: #fff3e0; color: #f57c00; }
        .frequency-quarterly { background: #f3e5f5; color: #7b1fa2; }
        .frequency-yearly { background: #fce4ec; color: #c2185b; }
        .recurring-details {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 20px;
        }
        .detail {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.85rem;
        }
        .detail span:first-child {
          color: #64748b;
        }
        .detail strong, .detail span:last-child {
          font-weight: 600;
          color: #1e293b;
        }
        .income-text {
          color: #2e7d32;
        }
        .expense-text {
          color: #c62828;
        }
        .status-badge {
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 0.7rem;
          font-weight: 600;
        }
        .status-badge.active {
          background: #e8f5e9;
          color: #2e7d32;
        }
        .status-badge.inactive {
          background: #ffebee;
          color: #c62828;
        }
        .recurring-actions {
          display: flex;
          gap: 8px;
          justify-content: flex-end;
          padding-top: 12px;
          border-top: 1px solid #e9ecef;
        }
        .btn-toggle, .btn-edit, .btn-delete {
          padding: 8px 16px;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 0.8rem;
          font-weight: 500;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          transition: all 0.2s;
        }
        .btn-toggle {
          background: #e9ecef;
          color: #495057;
        }
        .btn-toggle:hover {
          background: #dee2e6;
          transform: translateY(-1px);
        }
        .btn-edit {
          background: linear-gradient(135deg, #2e7d32, #1b5e20);
          color: white;
        }
        .btn-edit:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(46,125,50,0.2);
        }
        .btn-delete {
          background: linear-gradient(135deg, #c62828, #b71c1c);
          color: white;
        }
        .btn-delete:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(198,40,40,0.2);
        }
        .btn-primary {
          padding: 10px 24px;
          background: linear-gradient(135deg, #2e7d32, #1b5e20);
          border: none;
          border-radius: 10px;
          color: white;
          font-weight: 600;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          transition: all 0.2s;
        }
        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(46,125,50,0.3);
        }
        .empty-state {
          text-align: center;
          padding: 60px;
          background: white;
          border-radius: 20px;
        }
        .empty-state i {
          font-size: 3rem;
          color: #cbd5e1;
          margin-bottom: 16px;
        }
        .empty-state p {
          color: #64748b;
          margin-bottom: 20px;
        }
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2000;
          animation: fadeIn 0.2s ease;
        }
        .modal-content {
          background: white;
          border-radius: 24px;
          width: 90%;
          max-width: 600px;
          max-height: 90vh;
          overflow-y: auto;
          animation: slideUp 0.3s ease;
        }
        .modal-header {
          background: linear-gradient(135deg, #2e7d32, #1b5e20);
          color: white;
          padding: 24px;
          text-align: center;
          position: relative;
          border-radius: 24px 24px 0 0;
        }
        .modal-header i {
          font-size: 2rem;
          margin-bottom: 8px;
        }
        .modal-header h2 {
          margin: 0;
          font-size: 1.3rem;
        }
        .modal-close {
          position: absolute;
          top: 20px;
          right: 20px;
          background: none;
          border: none;
          color: white;
          font-size: 1.2rem;
          cursor: pointer;
          opacity: 0.7;
          transition: opacity 0.2s;
        }
        .modal-close:hover {
          opacity: 1;
        }
        .modal-body {
          padding: 24px;
        }
        .modal-footer {
          padding: 16px 24px 24px;
          display: flex;
          gap: 12px;
          justify-content: flex-end;
          border-top: 1px solid #e9ecef;
        }
        .form-group {
          margin-bottom: 20px;
        }
        .form-group label {
          display: block;
          margin-bottom: 8px;
          font-weight: 600;
          color: #334155;
        }
        .form-group input,
        .form-group select,
        .form-group textarea {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          font-size: 0.95rem;
          font-family: inherit;
        }
        .form-group input:focus,
        .form-group select:focus,
        .form-group textarea:focus {
          outline: none;
          border-color: #2e7d32;
          box-shadow: 0 0 0 3px rgba(46,125,50,0.1);
        }
        .form-group small {
          display: block;
          margin-top: 4px;
          color: #64748b;
          font-size: 0.7rem;
        }
        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .btn-secondary {
          padding: 10px 20px;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.2s;
        }
        .btn-secondary:hover {
          background: #f8fafc;
        }
        .notification {
          padding: 12px 20px;
          border-radius: 10px;
          animation: slideIn 0.3s ease;
        }
        .notification.success {
          background: #e8f5e9;
          color: #2e7d32;
          border-left: 4px solid #2e7d32;
        }
        .notification.error {
          background: #ffebee;
          color: #c62828;
          border-left: 4px solid #c62828;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes slideIn {
          from { transform: translateX(-100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @media (max-width: 768px) {
          .recurring-page {
            padding: 16px;
          }
          .page-header {
            flex-direction: column;
            gap: 16px;
          }
          .recurring-grid {
            grid-template-columns: 1fr;
          }
          .form-row {
            grid-template-columns: 1fr;
          }
          .modal-content {
            max-width: 95%;
          }
        }
      `}</style>
    </div>
  );
}