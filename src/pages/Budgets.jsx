import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useOrganization } from '../context/OrganizationContext';
import { formatCurrency } from '../utils/formatting';
import '../styles/budgets.css';

export default function Budgets() {
  const { userProfile } = useAuth();
  const { organization } = useOrganization();
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingBudget, setEditingBudget] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [actualSpending, setActualSpending] = useState({});
  const [selectedPeriod, setSelectedPeriod] = useState('current');
  const [formData, setFormData] = useState({
    category: '',
    amount: '',
    period: 'monthly',
    start_date: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end_date: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0],
  });

  const isAdmin = userProfile?.role === 'owner' || userProfile?.role === 'admin';
  const currencySymbol = organization?.currency_symbol || '£';

  useEffect(() => {
    if (!userProfile?.organization_id) return;
    fetchBudgets();
    fetchActualSpending();
  }, [userProfile, selectedPeriod]);

  const fetchBudgets = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('budgets')
      .select('*')
      .eq('organization_id', userProfile.organization_id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching budgets:', error);
      setMessage({ type: 'error', text: 'Failed to load budgets' });
    } else {
      setBudgets(data);
    }
    setLoading(false);
  };

  const fetchActualSpending = async () => {
    let startDate, endDate;
    const now = new Date();
    
    if (selectedPeriod === 'current') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    } else if (selectedPeriod === 'last') {
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
      endDate = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
    } else if (selectedPeriod === 'year') {
      startDate = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
      endDate = new Date(now.getFullYear(), 11, 31).toISOString().split('T')[0];
    }

    const { data, error } = await supabase
      .from('transactions')
      .select('particular, amount')
      .eq('organization_id', userProfile.organization_id)
      .eq('type', 'Expense')
      .gte('date', startDate)
      .lte('date', endDate);

    if (!error && data) {
      const spending = {};
      data.forEach(tx => {
        spending[tx.particular] = (spending[tx.particular] || 0) + tx.amount;
      });
      setActualSpending(spending);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: '', text: '' });

    if (!formData.category || !formData.amount) {
      setMessage({ type: 'error', text: 'Please fill in all required fields' });
      setSaving(false);
      return;
    }

    const budgetData = {
      organization_id: userProfile.organization_id,
      category: formData.category,
      amount: parseFloat(formData.amount),
      period: formData.period,
      start_date: formData.start_date,
      end_date: formData.end_date,
    };

    let error;
    if (editingBudget) {
      const { error: updateError } = await supabase
        .from('budgets')
        .update(budgetData)
        .eq('id', editingBudget.id);
      error = updateError;
    } else {
      const { error: insertError } = await supabase
        .from('budgets')
        .insert([budgetData]);
      error = insertError;
    }

    if (error) {
      setMessage({ type: 'error', text: error.message });
    } else {
      setMessage({ type: 'success', text: editingBudget ? 'Budget updated!' : 'Budget created!' });
      fetchBudgets();
      setShowModal(false);
      resetForm();
    }
    setSaving(false);
  };

  const resetForm = () => {
    setEditingBudget(null);
    setFormData({
      category: '',
      amount: '',
      period: 'monthly',
      start_date: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
      end_date: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0],
    });
  };

  const handleEdit = (budget) => {
    setEditingBudget(budget);
    setFormData({
      category: budget.category,
      amount: budget.amount,
      period: budget.period,
      start_date: budget.start_date,
      end_date: budget.end_date,
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this budget?')) return;
    
    setDeleting(true);
    const { error } = await supabase
      .from('budgets')
      .delete()
      .eq('id', id);
    
    if (error) {
      setMessage({ type: 'error', text: error.message });
    } else {
      setMessage({ type: 'success', text: 'Budget deleted!' });
      fetchBudgets();
    }
    setDeleting(false);
  };

  const getProgressColor = (spent, budget) => {
    const percentage = (spent / budget) * 100;
    if (percentage >= 100) return '#dc3545';
    if (percentage >= 80) return '#ffc107';
    return '#2e7d32';
  };

  const formatPeriodLabel = (period) => {
    const labels = {
      monthly: 'Monthly',
      quarterly: 'Quarterly',
      yearly: 'Yearly',
    };
    return labels[period] || period;
  };

  if (!isAdmin) {
    return (
      <div className="bd-page">
        <div className="bd-access-denied">
          <div className="bd-access-icon">
            <i className="fas fa-lock"></i>
          </div>
          <h2>Access Denied</h2>
          <p>Only organization owners and admins can manage budgets.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bd-page">
      <div className="bd-header">
        <div>
          <h1><i className="fas fa-chart-line"></i> Budget Management</h1>
          <p>Set spending limits and track your progress</p>
        </div>
        <div className="bd-header-actions">
          <select 
            value={selectedPeriod} 
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="bd-period-select"
          >
            <option value="current">Current Month</option>
            <option value="last">Last Month</option>
            <option value="year">This Year</option>
          </select>
          <button className="bd-btn-primary" onClick={() => {
            resetForm();
            setShowModal(true);
          }}>
            <i className="fas fa-plus"></i> Create Budget
          </button>
        </div>
      </div>

      {message.text && (
        <div className={`bd-notification ${message.type}`}>
          {message.text}
        </div>
      )}

      {loading ? (
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading budgets...</p>
        </div>
      ) : budgets.length === 0 ? (
        <div className="bd-empty">
          <i className="fas fa-chart-line"></i>
          <p>No budgets created yet</p>
          <button className="bd-btn-primary" onClick={() => setShowModal(true)}>
            Create your first budget
          </button>
        </div>
      ) : (
        <div className="bd-grid">
          {budgets.map(budget => {
            const spent = actualSpending[budget.category] || 0;
            const remaining = budget.amount - spent;
            const percentage = Math.min((spent / budget.amount) * 100, 100);
            const isOverBudget = spent > budget.amount;
            
            return (
              <div key={budget.id} className="bd-card">
                <div className="bd-card-header">
                  <h3>{budget.category}</h3>
                  <div className="bd-actions">
                    <button className="bd-icon-btn" onClick={() => handleEdit(budget)} title="Edit">
                      <i className="fas fa-edit"></i>
                    </button>
                    <button className="bd-icon-btn delete" onClick={() => handleDelete(budget.id)} title="Delete" disabled={deleting}>
                      <i className="fas fa-trash"></i>
                    </button>
                  </div>
                </div>
                
                <div className="bd-amounts">
                  <div className="bd-amount-item">
                    <span className="label">Budget</span>
                    <span className="value">{formatCurrency(budget.amount, currencySymbol)}</span>
                  </div>
                  <div className="bd-amount-item">
                    <span className="label">Spent</span>
                    <span className={`value ${isOverBudget ? 'over-budget' : ''}`}>
                      {formatCurrency(spent, currencySymbol)}
                    </span>
                  </div>
                  <div className="bd-amount-item">
                    <span className="label">Remaining</span>
                    <span className={`value ${remaining < 0 ? 'negative' : ''}`}>
                      {formatCurrency(remaining, currencySymbol)}
                    </span>
                  </div>
                </div>
                
                <div className="bd-progress">
                  <div className="bd-progress-bar-bg">
                    <div 
                      className="bd-progress-fill" 
                      style={{ width: `${percentage}%`, backgroundColor: getProgressColor(spent, budget.amount) }}
                    />
                  </div>
                  <div className="bd-progress-percent">{percentage.toFixed(0)}% used</div>
                </div>
                
                <div className="bd-footer">
                  <span className="bd-period-badge">{formatPeriodLabel(budget.period)}</span>
                  <span className="bd-date-range">
                    <i className="fas fa-calendar-alt"></i>
                    {new Date(budget.start_date).toLocaleDateString()} - {new Date(budget.end_date).toLocaleDateString()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="bd-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="bd-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="bd-modal-header">
              <div className="bd-modal-icon">
                <i className="fas fa-chart-line"></i>
              </div>
              <h2>{editingBudget ? 'Edit Budget' : 'Create Budget'}</h2>
              <button className="bd-modal-close" onClick={() => setShowModal(false)}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="bd-modal-body">
                <div className="bd-form-group">
                  <label>Category Name *</label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="e.g., Rent, Marketing, Salaries"
                    required
                  />
                </div>
                
                <div className="bd-form-group">
                  <label>Budget Amount ({currencySymbol}) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    placeholder="0.00"
                    required
                  />
                </div>
                
                <div className="bd-form-group">
                  <label>Period</label>
                  <select
                    value={formData.period}
                    onChange={(e) => setFormData({ ...formData, period: e.target.value })}
                  >
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
                
                <div className="bd-form-row">
                  <div className="bd-form-group">
                    <label>Start Date</label>
                    <input
                      type="date"
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                      required
                    />
                  </div>
                  <div className="bd-form-group">
                    <label>End Date</label>
                    <input
                      type="date"
                      value={formData.end_date}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                      required
                    />
                  </div>
                </div>
              </div>
              <div className="bd-modal-footer">
                <button type="button" className="bd-btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="bd-btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : (editingBudget ? 'Update Budget' : 'Create Budget')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}