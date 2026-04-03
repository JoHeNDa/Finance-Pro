import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useOrganization } from '../context/OrganizationContext';
import { formatCurrency } from '../utils/formatting';
import { useDebounce } from '../hooks/useDebounce';
import '../styles/viewRecords.css';

export default function ViewRecords() {
  const { user, userProfile } = useAuth();
  const { organization } = useOrganization();
  const [transactions, setTransactions] = useState([]);
  const [users, setUsers] = useState({});
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortColumn, setSortColumn] = useState('date');
  const [sortDirection, setSortDirection] = useState('desc');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 500);
  const [typeFilter, setTypeFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [viewMode, setViewMode] = useState('table');
  const [showFilters, setShowFilters] = useState(false);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [editFormData, setEditFormData] = useState({
    date: '',
    type: 'Revenue',
    particular: '',
    description: '',
    amount: 0,
    vatAmount: 0,
    paymentMode: 'Cash',
    recordedBy: '',
    receiptUrl: '',
  });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newReceiptFile, setNewReceiptFile] = useState(null);

  const [totalRecords, setTotalRecords] = useState(0);
  const [dateRange, setDateRange] = useState({ min: '', max: '' });
  const [totalAmount, setTotalAmount] = useState(0);

  const currencySymbol = organization?.currency_symbol || '£';
  const formatCurrencyWithSymbol = (amount) => {
    return `${currencySymbol} ${Number(amount).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  // Fetch users mapping
  useEffect(() => {
    const fetchUsers = async () => {
      if (!userProfile?.organization_id) return;
      const { data, error } = await supabase
        .from('users')
        .select('id, name')
        .eq('organization_id', userProfile.organization_id);
      
      if (!error && data) {
        const userMap = {};
        data.forEach(u => { userMap[u.id] = u.name; });
        setUsers(userMap);
      }
    };
    fetchUsers();
  }, [userProfile]);

  // Fetch transactions
  useEffect(() => {
    if (!userProfile?.organization_id) return;
    fetchTransactions();
    fetchStats();
  }, [userProfile, page, pageSize, sortColumn, sortDirection, debouncedSearch, typeFilter, startDate, endDate]);

  const fetchTransactions = async () => {
    setLoading(true);
    let query = supabase
      .from('transactions')
      .select('*', { count: 'exact' })
      .eq('organization_id', userProfile.organization_id)
      .order(sortColumn, { ascending: sortDirection === 'asc' });

    if (typeFilter !== 'all') {
      query = query.eq('type', typeFilter);
    }

    if (debouncedSearch) {
      query = query.or(`particular.ilike.%${debouncedSearch}%,description.ilike.%${debouncedSearch}%`);
    }

    if (startDate) {
      query = query.gte('date', startDate);
    }
    if (endDate) {
      query = query.lte('date', endDate);
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;
    if (error) {
      console.error('Error fetching transactions:', error);
    } else {
      setTransactions(data);
      setTotalCount(count);
    }
    setLoading(false);
  };

  const fetchStats = async () => {
    if (!userProfile?.organization_id) return;
    const { count } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', userProfile.organization_id);
    setTotalRecords(count || 0);

    const { data: dates } = await supabase
      .from('transactions')
      .select('date')
      .eq('organization_id', userProfile.organization_id)
      .order('date', { ascending: true })
      .limit(1);
    const { data: datesDesc } = await supabase
      .from('transactions')
      .select('date')
      .eq('organization_id', userProfile.organization_id)
      .order('date', { ascending: false })
      .limit(1);

    if (dates && dates[0] && datesDesc && datesDesc[0]) {
      setDateRange({
        min: new Date(dates[0].date).toLocaleDateString(),
        max: new Date(datesDesc[0].date).toLocaleDateString(),
      });
    }

    const { data: amounts } = await supabase
      .from('transactions')
      .select('amount')
      .eq('organization_id', userProfile.organization_id);
    if (amounts) {
      const total = amounts.reduce((sum, tx) => sum + tx.amount, 0);
      setTotalAmount(total);
    }
  };

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const openDeleteModal = (tx) => {
    setSelectedTransaction(tx);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedTransaction) return;
    setSaving(true);

    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', selectedTransaction.id);

    if (error) {
      console.error('Error deleting transaction:', error);
      alert('Failed to delete transaction');
    } else {
      fetchTransactions();
      fetchStats();
    }
    setDeleteModalOpen(false);
    setSelectedTransaction(null);
    setSaving(false);
  };

  const openEditModal = (tx) => {
    setSelectedTransaction(tx);
    setEditFormData({
      date: tx.date,
      type: tx.type,
      particular: tx.particular,
      description: tx.description || '',
      amount: tx.amount,
      vatAmount: tx.vat_amount || 0,
      paymentMode: tx.payment_mode,
      recordedBy: tx.user_id,
      receiptUrl: tx.receipt_url || '',
    });
    setNewReceiptFile(null);
    setEditModalOpen(true);
  };

  const handleReceiptFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) {
        alert('File size must be less than 5MB');
        return;
      }
      setNewReceiptFile(file);
    }
  };

  const uploadReceipt = async (file) => {
    if (!file) return null;
    const fileName = `${userProfile.organization_id}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from('receipts')
      .upload(fileName, file);
    if (uploadError) {
      console.error('Upload error:', uploadError);
      return null;
    }
    const { data: publicUrl } = supabase.storage
      .from('receipts')
      .getPublicUrl(fileName);
    return publicUrl.publicUrl;
  };

  const saveEdit = async () => {
    if (!selectedTransaction) return;
    setSaving(true);
    setUploading(true);
    
    let receiptUrl = editFormData.receiptUrl;
    if (newReceiptFile) {
      const uploadedUrl = await uploadReceipt(newReceiptFile);
      if (uploadedUrl) {
        receiptUrl = uploadedUrl;
      }
    }
    setUploading(false);

    const updatedTransaction = {
      date: editFormData.date,
      type: editFormData.type,
      particular: editFormData.particular,
      description: editFormData.description,
      amount: parseFloat(editFormData.amount) || 0,
      vat_amount: parseFloat(editFormData.vatAmount) || 0,
      payment_mode: editFormData.paymentMode,
      user_id: editFormData.recordedBy,
      receipt_url: receiptUrl,
    };

    const { error } = await supabase
      .from('transactions')
      .update(updatedTransaction)
      .eq('id', selectedTransaction.id);

    setSaving(false);

    if (error) {
      console.error('Error updating transaction:', error);
      alert('Failed to update transaction');
    } else {
      fetchTransactions();
      fetchStats();
      setEditModalOpen(false);
      setSelectedTransaction(null);
      setNewReceiptFile(null);
    }
  };

  const handleExport = () => {
    const headers = ['Date', 'Type', 'Particular', 'Description', 'Net Amount', 'VAT', 'Gross Amount', 'Payment Mode', 'Recorded By', 'Receipt URL', 'Timestamp'];
    const rows = transactions.map(tx => {
      const gross = tx.type === 'Revenue' ? tx.amount + (tx.vat_amount || 0) : tx.amount;
      return [
        new Date(tx.date).toLocaleDateString(),
        tx.type,
        tx.particular,
        tx.description || '',
        tx.amount,
        tx.vat_amount || 0,
        gross,
        tx.payment_mode,
        users[tx.user_id] || tx.user_id,
        tx.receipt_url || '',
        new Date(tx.timestamp).toLocaleString(),
      ];
    });
    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `transactions_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const totalPages = Math.ceil(totalCount / pageSize);
  const startIndex = (page - 1) * pageSize + 1;
  const endIndex = Math.min(page * pageSize, totalCount);

  const toggleFilters = () => setShowFilters(!showFilters);
  const closeModal = () => {
    setDeleteModalOpen(false);
    setSelectedTransaction(null);
  };
  const closeEditModal = () => {
    setEditModalOpen(false);
    setSelectedTransaction(null);
    setNewReceiptFile(null);
  };
  const changeViewPage = (direction) => {
    if (direction === 'prev' && page > 1) {
      setPage(page - 1);
    } else if (direction === 'next' && page < totalPages) {
      setPage(page + 1);
    }
  };

  if (loading && transactions.length === 0) {
    return (
      <div className="layout-loading-spinner">
        <div className="layout-spinner"></div>
        <p>Loading transactions...</p>
      </div>
    );
  }

  return (
    <>
      <div className="view-records-page">
        {/* Header with Stats and Filters */}
        <div className="records-header">
          <div className="records-stats">
            <div className="stat-badge">
              <i className="fas fa-database"></i>
              <span>{totalRecords}</span>
            </div>
            <div className="stat-badge">
              <i className="fas fa-calendar-alt"></i>
              <span>{dateRange.min && dateRange.max ? `${dateRange.min} - ${dateRange.max}` : '-'}</span>
            </div>
            <div className="stat-badge">
              <i className="fas fa-chart-line"></i>
              <span>{formatCurrencyWithSymbol(totalAmount)}</span>
            </div>
          </div>

          {/* Filter Section – three rows */}
          <button className="mobile-filter-toggle" onClick={toggleFilters}>
            <i className="fas fa-sliders-h"></i> Filters
          </button>

          <div className={`filter-section ${showFilters ? 'show' : ''}`}>
            {/* Row 1: Search */}
            <div className="filter-row-1">
              <div className="search-box">
                <i className="fas fa-search"></i>
                <input
                  type="text"
                  placeholder="Search transactions..."
                  className="search-input"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            {/* Row 2: Date range + Apply */}
            <div className="filter-row-2">
              <div className="date-range">
                <input
                  type="date"
                  className="date-input"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
                <input
                  type="date"
                  className="date-input"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <button className="btn-filter" onClick={() => { setPage(1); fetchTransactions(); }}>
                Apply
              </button>
            </div>

            {/* Row 3: Type select + View options + Export */}
            <div className="filter-row-3">
              <select
                className="filter-select"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <option value="all">All Types</option>
                <option value="Revenue">Revenue Only</option>
                <option value="Expense">Expenses Only</option>
              </select>
              <div className="filter-actions">
                <div className="view-options">
                  <button
                    className={`view-btn ${viewMode === 'table' ? 'active' : ''}`}
                    onClick={() => setViewMode('table')}
                  >
                    <i className="fas fa-table"></i>
                  </button>
                  <button
                    className={`view-btn ${viewMode === 'cards' ? 'active' : ''}`}
                    onClick={() => setViewMode('cards')}
                  >
                    <i className="fas fa-th-large"></i>
                  </button>
                </div>
              </div>
              <button className="btn-export" onClick={handleExport}>
                <i className="fas fa-download"></i> Export
              </button>
            </div>
          </div>
        </div>

        {/* Table View */}
        <div className="view-container" style={{ display: viewMode === 'table' ? 'block' : 'none' }}>
          <div className="table-card">
            <div className="table-responsive">
              <table className="records-table">
                <thead>
                  <tr>
                    <th onClick={() => handleSort('date')}>
                      Date <i className="fas fa-sort"></i>
                    </th>
                    <th onClick={() => handleSort('type')}>
                      Type <i className="fas fa-sort"></i>
                    </th>
                    <th>Particular</th>
                    <th>Description</th>
                    <th onClick={() => handleSort('amount')}>
                      Net Amt <i className="fas fa-sort"></i>
                    </th>
                    <th onClick={() => handleSort('vat_amount')}>
                      VAT <i className="fas fa-sort"></i>
                    </th>
                    <th>Gross Amt</th>
                    <th>Payment Mode</th>
                    <th>Recorded By</th>
                    <th>Receipt</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && transactions.length === 0 ? (
                    <tr>
                      <td colSpan="11" className="loading-state">Loading...</td>
                    </tr>
                  ) : transactions.length === 0 ? (
                    <tr>
                      <td colSpan="11" className="loading-state">No transactions found</td>
                    </tr>
                  ) : (
                    transactions.map((tx) => {
                      const gross = tx.type === 'Revenue' ? tx.amount + (tx.vat_amount || 0) : tx.amount;
                      return (
                        <tr key={tx.id}>
                          <td>{new Date(tx.date).toLocaleDateString()}</td>
                          <td>
                            <span className={tx.type === 'Revenue' ? 'badge-income' : 'badge-expense'}>
                              {tx.type}
                            </span>
                          </td>
                          <td>{tx.particular}</td>
                          <td>{tx.description || '-'}</td>
                          <td className={tx.type === 'Revenue' ? 'income-text' : 'expense-text'}>
                            {formatCurrencyWithSymbol(tx.amount)}
                          </td>
                          <td>{formatCurrencyWithSymbol(tx.vat_amount || 0)}</td>
                          <td>{formatCurrencyWithSymbol(gross)}</td>
                          <td>{tx.payment_mode}</td>
                          <td>{users[tx.user_id] || tx.user_id}</td>
                          <td>
                            {tx.receipt_url ? (
                              <a href={tx.receipt_url} target="_blank" rel="noopener noreferrer" className="receipt-link">
                                <i className="fas fa-file-alt"></i> View
                              </a>
                            ) : (
                              <span className="no-receipt">No receipt</span>
                            )}
                          </td>
                          <td>
                            <div className="action-buttons">
                              <button className="action-btn edit" onClick={() => openEditModal(tx)}>
                                <i className="fas fa-edit"></i>
                              </button>
                              <button className="action-btn delete" onClick={() => openDeleteModal(tx)}>
                                <i className="fas fa-trash"></i>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Card View */}
        <div className="view-container" style={{ display: viewMode === 'cards' ? 'block' : 'none' }}>
          <div className="cards-grid">
            {loading && transactions.length === 0 ? (
              <div className="loading-state">Loading...</div>
            ) : transactions.length === 0 ? (
              <div className="loading-state">No transactions found</div>
            ) : (
              transactions.map((tx) => {
                const gross = tx.type === 'Revenue' ? tx.amount + (tx.vat_amount || 0) : tx.amount;
                return (
                  <div key={tx.id} className={`transaction-card ${tx.type === 'Expense' ? 'expense' : ''}`}>
                    <div className="card-header">
                      <span className={`card-type ${tx.type === 'Revenue' ? 'income' : 'expense'}`}>
                        {tx.type}
                      </span>
                      <div className="card-date">
                        <i className="fas fa-calendar-alt"></i>
                        {new Date(tx.date).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="card-particular">{tx.particular}</div>
                    <div className="card-description">{tx.description || '-'}</div>
                    <div className="card-amount">{formatCurrencyWithSymbol(tx.amount)}</div>
                    <div className="card-vat">VAT: {formatCurrencyWithSymbol(tx.vat_amount || 0)}</div>
                    <div className="card-footer">
                      <div className="card-payment">
                        <i className="fas fa-credit-card"></i> {tx.payment_mode}
                      </div>
                      <div className="card-actions">
                        {tx.receipt_url && (
                          <a href={tx.receipt_url} target="_blank" rel="noopener noreferrer" className="card-action-btn">
                            <i className="fas fa-file-alt"></i>
                          </a>
                        )}
                        <button className="card-action-btn edit" onClick={() => openEditModal(tx)}>
                          <i className="fas fa-edit"></i>
                        </button>
                        <button className="card-action-btn delete" onClick={() => openDeleteModal(tx)}>
                          <i className="fas fa-trash"></i>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Pagination */}
        <div className="table-footer">
          <div className="pagination-info">
            Showing {startIndex} to {endIndex} of {totalCount} entries
          </div>
          <div className="pagination-controls">
            <button className="page-btn" onClick={() => changeViewPage('prev')} disabled={page === 1}>
              <i className="fas fa-chevron-left"></i>
            </button>
            <div className="page-numbers">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(num => (
                <button
                  key={num}
                  className={`page-number ${num === page ? 'active' : ''}`}
                  onClick={() => setPage(num)}
                >
                  {num}
                </button>
              ))}
            </div>
            <button className="page-btn" onClick={() => changeViewPage('next')} disabled={page === totalPages || totalPages === 0}>
              <i className="fas fa-chevron-right"></i>
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && (
        <div className="modal" style={{ display: 'flex' }}>
          <div className="modal-content">
            <div className="modal-header">
              <i className="fas fa-exclamation-triangle"></i>
              <h3>Confirm Deletion</h3>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to delete this transaction?</p>
              <p className="text-warning">This action cannot be undone.</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeModal}>Cancel</button>
              <button className="btn btn-danger" onClick={confirmDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editModalOpen && (
        <div className="modal" style={{ display: 'flex' }}>
          <div className="modal-content" style={{ maxWidth: '700px' }}>
            <div className="modal-header" style={{ background: 'linear-gradient(135deg, #2e7d32, #1b5e20)' }}>
              <i className="fas fa-edit"></i>
              <h3>Edit Transaction</h3>
            </div>
            <div className="modal-body">
              <form>
                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div className="form-group">
                    <label>Date</label>
                    <input
                      type="date"
                      className="form-control"
                      value={editFormData.date}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, date: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Type</label>
                    <select
                      className="form-control"
                      value={editFormData.type}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, type: e.target.value }))}
                      required
                    >
                      <option value="Revenue">Revenue</option>
                      <option value="Expense">Expense</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Particular</label>
                    <input
                      type="text"
                      className="form-control"
                      value={editFormData.particular}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, particular: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Description</label>
                    <input
                      type="text"
                      className="form-control"
                      value={editFormData.description}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, description: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Amount</label>
                    <input
                      type="number"
                      className="form-control"
                      step="0.01"
                      value={editFormData.amount}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>VAT Amount</label>
                    <input
                      type="number"
                      className="form-control"
                      step="0.01"
                      min="0"
                      value={editFormData.vatAmount}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, vatAmount: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                  <div className="form-group">
                    <label>Payment Mode</label>
                    <select
                      className="form-control"
                      value={editFormData.paymentMode}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, paymentMode: e.target.value }))}
                      required
                    >
                      <option value="Cash">Cash</option>
                      <option value="Mobile Money">Mobile Money</option>
                      <option value="Bank">Bank Transfer</option>
                      <option value="Card">Card Payment</option>
                      <option value="Online">Online Transfer</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Recorded By</label>
                    <input
                      type="text"
                      className="form-control"
                      value={editFormData.recordedBy}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, recordedBy: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Receipt (current)</label>
                    <div className="edit-receipt-current">
                      {editFormData.receiptUrl ? (
                        <a href={editFormData.receiptUrl} target="_blank" rel="noopener noreferrer">
                          View current receipt
                        </a>
                      ) : (
                        <span style={{ color: '#999' }}>No receipt attached</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* New file upload area */}
                <div style={{ marginTop: '20px', borderTop: '1px solid #e2e8f0', paddingTop: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Update Receipt (optional)</label>
                  <div className="file-upload-area" style={{ minHeight: '100px', border: '2px dashed #cbd5e1', borderRadius: '16px', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      className="file-input"
                      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', zIndex: 10 }}
                      onChange={handleReceiptFileChange}
                    />
                    <div className="file-upload-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '18px 16px', pointerEvents: 'none', zIndex: 5 }}>
                      <i className="fas fa-cloud-upload-alt" style={{ fontSize: '2rem', color: '#2e7d32', marginBottom: '8px' }}></i>
                      <p style={{ margin: '0 0 4px', color: '#1e293b', fontWeight: 500, fontSize: '0.9rem' }}>Drag & drop or <span style={{ color: '#2e7d32', fontWeight: 600, textDecoration: 'underline', textDecorationStyle: 'dotted' }}>browse</span> to upload</p>
                      <small style={{ color: '#64748b', fontSize: '0.75rem' }}>Images, PDF (Max 5MB)</small>
                    </div>
                    {newReceiptFile && (
                      <div className="file-preview" style={{ display: 'flex', background: 'white', margin: '10px', padding: '10px 16px', borderRadius: '40px', boxShadow: '0 8px 20px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0', width: 'calc(100% - 20px)', alignItems: 'center', gap: '8px' }}>
                        <i className="fas fa-file-pdf" style={{ color: '#c62828', fontSize: '1.4rem' }}></i>
                        <span className="file-name">{newReceiptFile.name}</span>
                        <button type="button" className="remove-file" onClick={() => setNewReceiptFile(null)} style={{ background: 'none', border: 'none', color: '#c62828', cursor: 'pointer', padding: '6px', borderRadius: '50%', fontSize: '1.1rem', marginLeft: 'auto' }}>
                          <i className="fas fa-times"></i>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </form>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeEditModal}>Cancel</button>
              <button className="btn btn-primary" onClick={saveEdit}>Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}