import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useOrganizationSettings } from '../hooks/useOrganizationSettings';
import { formatCurrency } from '../utils/formatting';
import { logAuditEvent } from '../lib/audit';
import '../styles/addTransaction.css';

export default function AddTransaction() {
  const { user, userProfile } = useAuth();
  const navigate = useNavigate();
  const { vatRate, enableVAT, enableReceipts, currencySymbol } = useOrganizationSettings();

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    type: 'Revenue',
    particular: '',
    description: '',
    amount: 0,
    vatAmount: 0,
    paymentMode: 'Cash',
  });
  const [file, setFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [balance, setBalance] = useState(0);
  const [rawDigits, setRawDigits] = useState('');
  const [recentTransactions, setRecentTransactions] = useState([]);

  // Fetch recent transactions based on timestamp (only the most recent record)
  const fetchRecentTransactions = async () => {
    if (!userProfile?.organization_id) return;
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('organization_id', userProfile.organization_id)
        .order('timestamp', { ascending: false }) // Order by timestamp instead of date
        .limit(1); // Only get 1 transaction
      
      if (!error && data) {
        console.log('Fetched transactions:', data.length);
        setRecentTransactions(data);
      } else if (error) {
        console.error('Error fetching recent transactions:', error);
      }
    } catch (err) {
      console.error('Failed to fetch recent transactions:', err);
    }
  };

  useEffect(() => {
    const loadBalance = async () => {
      if (!userProfile?.organization_id) return;
      const { data, error } = await supabase
        .from('transactions')
        .select('type, amount')
        .eq('organization_id', userProfile.organization_id);
      if (!error && data) {
        let revenue = 0, expenses = 0;
        data.forEach(tx => {
          if (tx.type === 'Revenue') revenue += tx.amount;
          else expenses += tx.amount;
        });
        setBalance(revenue - expenses);
      }
    };
    loadBalance();
    fetchRecentTransactions();
  }, [userProfile]);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const canAddTransaction = userProfile && ['owner', 'admin', 'manager'].includes(userProfile.role);
  if (!canAddTransaction) {
    return (
      <div className="tx-access-denied">
        <i className="fas fa-lock"></i>
        <h2>Access Denied</h2>
        <p>You don't have permission to add transactions.</p>
      </div>
    );
  }

  // ---------- Handlers ----------
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  const handleTypeToggle = (type) => setFormData(prev => ({ ...prev, type }));
  const handleVatAmountChange = (e) => {
    const value = parseFloat(e.target.value) || 0;
    setFormData(prev => ({ ...prev, vatAmount: Math.round(value * 100) / 100 }));
  };
  const handleTotalIncludingVat = (e) => {
    const total = parseFloat(e.target.value) || 0;
    const net = Math.round((total / (1 + vatRate / 100)) * 100) / 100;
    const vat = total - net;
    setFormData(prev => ({ ...prev, amount: net, vatAmount: vat }));
    setRawDigits(Math.round(net * 100).toString());
  };
  const handleAmountInput = (e) => {
    const input = e.target.value;
    const digits = input.replace(/\D/g, '');
    let newRaw = digits;
    if (digits.length < rawDigits.length) {
      newRaw = digits;
    } else {
      const lastChar = digits.slice(-1);
      newRaw = rawDigits + lastChar;
    }
    setRawDigits(newRaw);
    let display = newRaw.padStart(3, '0');
    const pounds = display.slice(0, -2) || '0';
    const pence = display.slice(-2);
    const formatted = pounds + '.' + pence;
    e.target.value = formatted;
    setFormData(prev => ({ ...prev, amount: parseFloat(formatted) }));
  };
  const handleAmountKeyDown = (e) => {
    if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      if (rawDigits.length > 0) {
        const newRaw = rawDigits.slice(0, -1);
        setRawDigits(newRaw);
        let display = newRaw.padStart(3, '0');
        const pounds = display.slice(0, -2) || '0';
        const pence = display.slice(-2);
        const formatted = pounds + '.' + pence;
        e.target.value = formatted;
        setFormData(prev => ({ ...prev, amount: parseFloat(formatted) }));
      }
    }
  };
  const handleAmountBlur = (e) => {
    let num = parseFloat(e.target.value);
    if (isNaN(num)) num = 0;
    e.target.value = num.toFixed(2);
    setFormData(prev => ({ ...prev, amount: num }));
  };
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.size > 5 * 1024 * 1024) {
        setError('File size must be less than 5MB');
        return;
      }
      setFile(selectedFile);
      setError('');
    }
  };
  const handleRemoveFile = () => {
    setFile(null);
    setUploadProgress(0);
    const fileInput = document.getElementById('txReceiptFile');
    if (fileInput) fileInput.value = '';
  };
  const uploadFile = async (file) => {
    if (!file) return null;
    const fileName = `${userProfile.organization_id}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from('receipts')
      .upload(fileName, file);
    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw uploadError;
    }
    const { data: publicUrl } = supabase.storage
      .from('receipts')
      .getPublicUrl(fileName);
    return publicUrl.publicUrl;
  };
  const resetForm = () => {
    setFormData({
      date: new Date().toISOString().split('T')[0],
      type: 'Revenue',
      particular: '',
      description: '',
      amount: 0,
      vatAmount: 0,
      paymentMode: 'Cash',
    });
    setFile(null);
    setRawDigits('');
    setUploadProgress(0);
    const fileInput = document.getElementById('txReceiptFile');
    if (fileInput) fileInput.value = '';
  };
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.particular.trim()) {
      setError('Please enter a particular/category');
      return;
    }
    setSubmitting(true);
    try {
      let receiptUrl = null;
      if (enableReceipts && file) {
        receiptUrl = await uploadFile(file);
      }
      const { data: insertedData, error: insertError } = await supabase
        .from('transactions')
        .insert({
          organization_id: userProfile.organization_id,
          user_id: userProfile.id,
          date: formData.date,
          type: formData.type,
          particular: formData.particular,
          description: formData.description,
          amount: formData.amount,
          vat_amount: formData.type === 'Revenue' && enableVAT ? formData.vatAmount : 0,
          payment_mode: formData.paymentMode,
          receipt_url: receiptUrl,
          timestamp: new Date().toISOString(),
        })
        .select();
      if (insertError) throw insertError;
      await logAuditEvent('create', 'transactions', insertedData[0].id, userProfile.id, { transaction: insertedData[0] });
      setSuccessMessage('Transaction added successfully!');
      resetForm();
      await fetchRecentTransactions();
    } catch (err) {
      console.error(err);
      setError('Failed to add transaction. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="tx-page">
      {successMessage && <div className="tx-notification tx-success">{successMessage}</div>}
      {error && <div className="tx-notification tx-error">{error}</div>}

      <div className="tx-header">
        <div className="tx-header-content">
          <p className="tx-subtitle">Enter the details below to add a revenue or expense record</p>
        </div>
        <div className="tx-header-stats">
          <div className="tx-stat-badge">
            <i className="fas fa-wallet"></i>
            <span>{formatCurrency(balance, currencySymbol)}</span>
          </div>
        </div>
      </div>

      <form className="tx-form" onSubmit={handleSubmit}>
        <div className="tx-two-columns">
          {/* LEFT COLUMN – Form Card */}
          <div className="tx-form-col">
            <div className="tx-card">
              <div className="tx-card-header">
                <h3><i className="fas fa-info-circle"></i> Transaction Information</h3>
              </div>
              <div className="tx-form-grid">
                <div className="tx-form-column">
                  <div className="tx-input-group">
                    <label htmlFor="txDate">Transaction Date</label>
                    <div className="tx-input-icon">
                      <i className="far fa-calendar-alt"></i>
                      <input type="date" id="txDate" name="date" value={formData.date} onChange={handleChange} required />
                    </div>
                  </div>
                  <div className="tx-input-group">
                    <label>Transaction Type</label>
                    <div className="tx-type-toggle">
                      <button type="button" className={`tx-type-option tx-revenue-btn ${formData.type === 'Revenue' ? 'tx-active' : ''}`} onClick={() => handleTypeToggle('Revenue')}>
                        <i className="fas fa-arrow-down"></i><span>Revenue</span>
                      </button>
                      <button type="button" className={`tx-type-option tx-expense-btn ${formData.type === 'Expense' ? 'tx-active' : ''}`} onClick={() => handleTypeToggle('Expense')}>
                        <i className="fas fa-arrow-up"></i><span>Expense</span>
                      </button>
                    </div>
                    <input type="hidden" name="type" value={formData.type} />
                  </div>
                  <div className="tx-input-group">
                    <label htmlFor="txParticular">Particular / Category</label>
                    <div className="tx-input-icon">
                      <i className="fas fa-tag"></i>
                      <input type="text" id="txParticular" name="particular" placeholder="e.g., Scan Payment, Rent, Fuel" value={formData.particular} onChange={handleChange} required />
                    </div>
                  </div>
                </div>
                <div className="tx-form-column">
                  <div className="tx-input-group">
                    <label htmlFor="txDescription">Description</label>
                    <div className="tx-input-icon">
                      <i className="fas fa-align-left"></i>
                      <textarea id="txDescription" name="description" rows="4" placeholder="Additional details about this transaction..." value={formData.description} onChange={handleChange} required></textarea>
                    </div>
                  </div>
                  <div className="tx-input-group">
                    <label htmlFor="txPaymentMode">Payment Mode</label>
                    <div className="tx-input-icon">
                      <i className="fas fa-credit-card"></i>
                      <select id="txPaymentMode" name="paymentMode" value={formData.paymentMode} onChange={handleChange} required>
                        <option value="" disabled>Select payment method</option>
                        <option value="Cash">Cash</option>
                        <option value="Mobile Money">Mobile Money</option>
                        <option value="Bank">Bank Transfer</option>
                        <option value="Card">Card Payment</option>
                        <option value="Online">Online Transfer</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>
                  <div className="tx-input-group">
                    <label htmlFor="txRecordedBy">Recorded By</label>
                    <div className="tx-input-icon">
                      <i className="fas fa-user"></i>
                      <input type="text" id="txRecordedBy" value={userProfile?.name || user?.email} disabled readOnly />
                    </div>
                  </div>
                </div>
              </div>

              <div className="tx-amount-vat-row">
                <div className="tx-input-group">
                  <label htmlFor="txAmountDisplay">Amount ({currencySymbol}) (Net)</label>
                  <div className="tx-input-icon">
                    <i className="fas fa-coins"></i>
                    <input type="text" id="txAmountDisplay" placeholder="0" className="tx-amount-input" value={formData.amount === 0 ? '' : formData.amount.toFixed(2)} onInput={handleAmountInput} onKeyDown={handleAmountKeyDown} onBlur={handleAmountBlur} />
                    <input type="hidden" name="amount" value={formData.amount} />
                  </div>
                </div>
                {enableVAT && formData.type === 'Revenue' && (
                  <div className="tx-input-group">
                    <label htmlFor="txVatAmount">VAT Amount ({currencySymbol}) ({vatRate}%)</label>
                    <div className="tx-input-icon">
                      <i className="fas fa-percent"></i>
                      <input type="number" id="txVatAmount" step="0.01" min="0" value={formData.vatAmount} onChange={handleVatAmountChange} placeholder="0.00" />
                    </div>
                  </div>
                )}
              </div>

              {enableVAT && formData.type === 'Revenue' && (
                <div className="tx-vat-calculator">
                  <div className="tx-input-group">
                    <label htmlFor="txTotalIncludingVat">Total including VAT ({currencySymbol})</label>
                    <div className="tx-input-icon">
                      <i className="fas fa-calculator"></i>
                      <input type="number" id="txTotalIncludingVat" step="0.01" min="0" placeholder="Enter total including VAT" onChange={handleTotalIncludingVat} />
                    </div>
                    <p className="tx-vat-info"><i className="fas fa-info-circle"></i> VAT ({vatRate}%) will be calculated automatically.</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN – Attachment + Summary */}
          <div className="tx-right-col">
            {enableReceipts && (
              <div className="tx-card">
                <div className="tx-card-header">
                  <h3><i className="fas fa-paperclip"></i> Attachment (Optional)</h3>
                </div>
                <div className="tx-file-area">
                  <input type="file" id="txReceiptFile" accept="image/*,.pdf" className="tx-file-input" onChange={handleFileChange} />
                  <div className="tx-file-content" style={{ display: file ? 'none' : 'flex' }}>
                    <i className="fas fa-cloud-upload-alt"></i>
                    <p>Drag & drop or <span>browse</span> to upload</p>
                    <small>Images, PDF (Max 5MB)</small>
                  </div>
                  {file && (
                    <div className="tx-file-preview">
                      <i className="fas fa-file-pdf"></i>
                      <span className="tx-file-name">{file.name}</span>
                      {uploading && (
                        <div className="tx-upload-progress">
                          <div className="tx-progress-bar" style={{ width: `${uploadProgress}%` }}></div>
                          <span>{uploadProgress}%</span>
                        </div>
                      )}
                      <button type="button" className="tx-remove-file" onClick={handleRemoveFile}><i className="fas fa-times"></i></button>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="tx-card tx-summary-card">
              <div className="tx-card-header">
                <h3><i className="fas fa-chart-simple"></i> Summary Preview</h3>
              </div>
              <div className="tx-summary">
                <div className="tx-summary-item">
                  <span>Type:</span>
                  <strong>{formData.type}</strong>
                </div>
                <div className="tx-summary-item">
                  <span>Amount:</span>
                  <strong>{formatCurrency(formData.amount, currencySymbol)}</strong>
                </div>
                {enableVAT && formData.type === 'Revenue' && (
                  <div className="tx-summary-item">
                    <span>VAT:</span>
                    <strong>{formatCurrency(formData.vatAmount, currencySymbol)}</strong>
                  </div>
                )}
                <div className="tx-summary-item">
                  <span>Payment:</span>
                  <strong>{formData.paymentMode}</strong>
                </div>
                <div className="tx-actions">
                  <button type="button" className="tx-btn-secondary" onClick={resetForm}>
                    <i className="fas fa-undo"></i> Reset
                  </button>
                  <button type="submit" className="tx-btn-primary" disabled={submitting || uploading}>
  <i className="fas fa-save"></i>
  {uploading ? ` Uploading... ${uploadProgress}%` : (submitting ? ' Saving...' : ' Save')}
</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>

      {/* Recent Transactions Section - Now showing only the most recent transaction based on timestamp */}
      {recentTransactions.length > 0 && (
        <div className="tx-recent-card">
          <div className="tx-card-header">
            <h3><i className="fas fa-history"></i> Most Recent Transaction</h3>
            <Link to="/records" className="tx-view-all-link">
              View All <i className="fas fa-arrow-right"></i>
            </Link>
          </div>
          <div className="tx-recent-table-wrapper">
            <table className="tx-recent-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Particular</th>
                  <th>Description</th>
                  <th>Net Amt</th>
                  {enableVAT && <th>VAT</th>}
                  <th>Gross Amt</th>
                  <th>Payment Mode</th>
                </tr>
              </thead>
              <tbody>
                {recentTransactions.map(tx => {
                  const gross = tx.type === 'Revenue' ? tx.amount + (tx.vat_amount || 0) : tx.amount;
                  return (
                    <tr key={tx.id}>
                      <td>{new Date(tx.date).toLocaleDateString()}</td>
                      <td className={tx.type === 'Revenue' ? 'tx-income-text' : 'tx-expense-text'}>
                        {tx.type}
                      </td>
                      <td>{tx.particular}</td>
                      <td>{tx.description || '-'}</td>
                      <td className={tx.type === 'Revenue' ? 'tx-income-text' : 'tx-expense-text'}>
                        {formatCurrency(tx.amount, currencySymbol)}
                      </td>
                      {enableVAT && (
                        <td className={tx.type === 'Revenue' ? 'tx-income-text' : 'tx-expense-text'}>
                          {formatCurrency(tx.vat_amount || 0, currencySymbol)}
                        </td>
                      )}
                      <td className={tx.type === 'Revenue' ? 'tx-income-text' : 'tx-expense-text'}>
                        {formatCurrency(gross, currencySymbol)}
                      </td>
                      <td>{tx.payment_mode}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}