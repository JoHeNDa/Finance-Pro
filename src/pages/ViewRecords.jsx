import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useOrganization } from '../context/OrganizationContext.jsx';
import { formatCurrency } from '../utils/formatting.js';
import { useDebounce } from '../hooks/useDebounce.js';
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
    receiptUrls: [],
  });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newReceiptFiles, setNewReceiptFiles] = useState([]);

  const [totalRecords, setTotalRecords] = useState(0);
  const [dateRange, setDateRange] = useState({ min: '', max: '' });
  const [totalAmount, setTotalAmount] = useState(0);
  const [visibleStart, setVisibleStart] = useState(1);

  const currencySymbol = organization?.currency_symbol || '£';

  const getPageSize = () => {
    if (viewMode === 'cards') return 12;
    return window.innerWidth <= 480 ? 7 : 10;
  };

  useEffect(() => {
    const updatePageSize = () => setPageSize(getPageSize());
    updatePageSize();
    window.addEventListener('resize', updatePageSize);
    return () => window.removeEventListener('resize', updatePageSize);
  }, [viewMode]);

  useEffect(() => setPage(1), [viewMode]);

  const formatNumberOnly = (amount) => {
    const num = Number(amount);
    if (Math.abs(num) < 0.001) return '';
    return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatCurrencyWithSymbol = (amount) => {
    const num = Number(amount);
    if (Math.abs(num) < 0.001) return '';
    return `${currencySymbol} ${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getFileIcon = (fileName) => {
    const ext = fileName.split('.').pop().toLowerCase();
    if (ext === 'pdf') return 'fas fa-file-pdf';
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'].includes(ext)) return 'fas fa-file-image';
    if (['doc', 'docx'].includes(ext)) return 'fas fa-file-word';
    if (['xls', 'xlsx', 'csv'].includes(ext)) return 'fas fa-file-excel';
    if (ext === 'txt') return 'fas fa-file-alt';
    return 'fas fa-file';
  };

  const parseReceiptUrls = (receiptUrl) => {
    if (!receiptUrl) return [];
    if (receiptUrl.includes('|')) {
      return receiptUrl.split('|').map(u => u.trim()).filter(u => u);
    }
    const parts = receiptUrl.split(',');
    let urls = [];
    let current = '';
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed.startsWith('http')) {
        if (current) urls.push(current);
        current = trimmed;
      } else {
        current += ',' + trimmed;
      }
    }
    if (current) urls.push(current);
    return urls.filter(u => u);
  };

  useEffect(() => {
    const fetchUsers = async () => {
      if (!userProfile?.organization_id) return;
      const { data, error } = await supabase.from('users').select('id, name').eq('organization_id', userProfile.organization_id);
      if (!error && data) {
        const userMap = {};
        data.forEach((u) => { userMap[u.id] = u.name; });
        setUsers(userMap);
      }
    };
    fetchUsers();
  }, [userProfile]);

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

    if (typeFilter !== 'all') query = query.eq('type', typeFilter);
    if (debouncedSearch) query = query.or(`particular.ilike.%${debouncedSearch}%,description.ilike.%${debouncedSearch}%`);
    if (startDate) query = query.gte('date', startDate);
    if (endDate) query = query.lte('date', endDate);

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;
    if (!error && data) {
      setTransactions(data.map(tx => ({ ...tx, receiptUrls: parseReceiptUrls(tx.receipt_url) })));
      setTotalCount(count);
    } else console.error(error);
    setLoading(false);
  };

  const fetchStats = async () => {
    if (!userProfile?.organization_id) return;
    const { count } = await supabase.from('transactions').select('*', { count: 'exact', head: true }).eq('organization_id', userProfile.organization_id);
    setTotalRecords(count || 0);

    const { data: datesMin } = await supabase.from('transactions').select('date').eq('organization_id', userProfile.organization_id).order('date', { ascending: true }).limit(1);
    const { data: datesMax } = await supabase.from('transactions').select('date').eq('organization_id', userProfile.organization_id).order('date', { ascending: false }).limit(1);
    if (datesMin?.[0] && datesMax?.[0]) {
      const minDate = datesMin[0].date;
      const maxDate = datesMax[0].date;
      setDateRange({
        min: new Date(minDate).toLocaleDateString(),
        max: new Date(maxDate).toLocaleDateString(),
      });
      setStartDate(prev => prev === '' ? minDate : prev);
      setEndDate(prev => prev === '' ? maxDate : prev);
    }

    const { data: amounts } = await supabase.from('transactions').select('amount').eq('organization_id', userProfile.organization_id);
    if (amounts) setTotalAmount(amounts.reduce((s, tx) => s + tx.amount, 0));
  };

  const handleSort = (column) => {
    if (sortColumn === column) setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    else { setSortColumn(column); setSortDirection('asc'); }
  };

  const openDeleteModal = (tx) => {
    setSelectedTransaction(tx);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedTransaction) return;
    setSaving(true);
    const { error } = await supabase.from('transactions').delete().eq('id', selectedTransaction.id);
    if (error) alert('Failed to delete transaction');
    else { fetchTransactions(); fetchStats(); }
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
      receiptUrls: parseReceiptUrls(tx.receipt_url),
    });
    setNewReceiptFiles([]);
    setEditModalOpen(true);
  };

  const removeExistingReceipt = (indexToRemove) => {
    setEditFormData(prev => ({ ...prev, receiptUrls: prev.receiptUrls.filter((_, idx) => idx !== indexToRemove) }));
  };

  const handleReceiptFilesChange = (e) => {
    if (e.target.files && e.target.files.length) {
      const files = Array.from(e.target.files);
      if (files.length > 5) return alert('You can upload up to 5 files');
      for (const file of files) if (file.size > 5 * 1024 * 1024) return alert(`File "${file.name}" is larger than 5MB`);
      setNewReceiptFiles(prev => [...prev, ...files]);
    }
  };

  const removeNewReceiptFile = (indexToRemove) => {
    setNewReceiptFiles(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const uploadMultipleReceipts = async (files) => {
    const uploadedUrls = [];
    for (const file of files) {
      const fileName = `${userProfile.organization_id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from('receipts').upload(fileName, file);
      if (uploadError) continue;
      const { data: publicUrl } = supabase.storage.from('receipts').getPublicUrl(fileName);
      uploadedUrls.push(publicUrl.publicUrl);
    }
    return uploadedUrls;
  };

  const saveEdit = async () => {
    if (!selectedTransaction) return;
    setSaving(true);
    let finalReceiptUrls = [...editFormData.receiptUrls];
    if (newReceiptFiles.length) {
      setUploading(true);
      const newUrls = await uploadMultipleReceipts(newReceiptFiles);
      finalReceiptUrls = [...finalReceiptUrls, ...newUrls];
      setUploading(false);
    }
    const updatedTransaction = {
      date: editFormData.date,
      type: editFormData.type,
      particular: editFormData.particular,
      description: editFormData.description,
      amount: parseFloat(editFormData.amount) || 0,
      vat_amount: parseFloat(editFormData.vatAmount) || 0,
      payment_mode: editFormData.paymentMode,
      user_id: editFormData.recordedBy,
      receipt_url: finalReceiptUrls.join('|'),
    };
    const { error } = await supabase.from('transactions').update(updatedTransaction).eq('id', selectedTransaction.id);
    setSaving(false);
    if (error) alert('Failed to update transaction');
    else {
      fetchTransactions();
      fetchStats();
      setEditModalOpen(false);
      setSelectedTransaction(null);
      setNewReceiptFiles([]);
    }
  };

  const handleExport = async () => {
    const originalLoading = loading;
    setLoading(true);
    try {
      let query = supabase.from('transactions').select('*').eq('organization_id', userProfile.organization_id).order('date', { ascending: true });
      if (typeFilter !== 'all') query = query.eq('type', typeFilter);
      if (debouncedSearch) query = query.or(`particular.ilike.%${debouncedSearch}%,description.ilike.%${debouncedSearch}%`);
      if (startDate) query = query.gte('date', startDate);
      if (endDate) query = query.lte('date', endDate);
      const { data: allTransactions, error } = await query;
      if (error) throw error;
      if (!allTransactions || !allTransactions.length) { alert('No transactions to export'); return; }
      const fmtNumber = (v) => { const n = parseFloat(v) || 0; return Math.abs(n) < 0.001 ? '' : n.toFixed(2); };
      const headers = ['Date', 'Particular', 'Description', `Gross Revenue (${currencySymbol})`, `VAT (${currencySymbol})`, `Net Revenue (${currencySymbol})`, `Expense (${currencySymbol})`, `Balance (${currencySymbol})`, 'Payment Mode', 'Recorded By', 'Receipt URLs', 'Timestamp'];
      let runningBalance = 0, totalGross = 0, totalVAT = 0, totalNet = 0, totalExpense = 0;
      const rows = allTransactions.map(tx => {
        const revenue = tx.type === 'Revenue' ? tx.amount : 0;
        const expense = tx.type === 'Expense' ? tx.amount : 0;
        const vat = tx.type === 'Revenue' ? (tx.vat_amount || 0) : 0;
        const gross = revenue + vat;
        runningBalance += revenue - expense;
        totalGross += gross; totalVAT += vat; totalNet += revenue; totalExpense += expense;
        return [new Date(tx.date).toLocaleDateString(), tx.particular, tx.description || '', fmtNumber(gross), fmtNumber(vat), fmtNumber(revenue), fmtNumber(expense), fmtNumber(runningBalance), tx.payment_mode, users[tx.user_id] || tx.user_id, tx.receipt_url || '', new Date(tx.timestamp).toLocaleString()];
      });
      rows.push(['TOTAL', '', '', fmtNumber(totalGross), fmtNumber(totalVAT), fmtNumber(totalNet), fmtNumber(totalExpense), fmtNumber(totalNet - totalExpense), '', '', '', '']);
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
    } catch (err) { console.error(err); alert('Failed to export data'); }
    finally { setLoading(originalLoading); }
  };

  const totalPages = Math.ceil(totalCount / pageSize);
  const startIndex = (page - 1) * pageSize + 1;
  const endIndex = Math.min(page * pageSize, totalCount);

  useEffect(() => setVisibleStart(1), [totalPages]);
  useEffect(() => { setStartDate(''); setEndDate(''); }, [userProfile?.organization_id]);

  const toggleFilters = () => setShowFilters(!showFilters);
  const closeModal = () => { setDeleteModalOpen(false); setSelectedTransaction(null); };
  const closeEditModal = () => { setEditModalOpen(false); setSelectedTransaction(null); setNewReceiptFiles([]); };

  const changeViewPage = (direction) => {
    let newPage = page;
    if (direction === 'prev' && page > 1) newPage = page - 1;
    else if (direction === 'next' && page < totalPages) newPage = page + 1;
    setPage(newPage);
    if (newPage < visibleStart) setVisibleStart(Math.max(1, newPage - 2));
    else if (newPage > visibleStart + 3) setVisibleStart(Math.min(totalPages - 3, newPage - 2));
  };

  if (loading && transactions.length === 0) {
    return <div className="layout-loading-spinner"><div className="layout-spinner"></div><p>Loading transactions...</p></div>;
  }

  return (
    <>
      <div className="view-records-page">
        <div className="records-header">
          <div className="records-stats">
            <div className="stat-badge"><i className="fas fa-database"></i><span>{totalRecords}</span></div>
            <div className="stat-badge"><i className="fas fa-calendar-alt"></i><span>{dateRange.min && dateRange.max ? `${dateRange.min} - ${dateRange.max}` : '-'}</span></div>
            <div className="stat-badge"><i className="fas fa-chart-line"></i><span>{formatCurrencyWithSymbol(totalAmount)}</span></div>
          </div>
          <button className="mobile-filter-toggle" onClick={toggleFilters}><i className="fas fa-sliders-h"></i> Filters</button>
          <div className={`filter-section ${showFilters ? 'show' : ''}`}>
            <div className="filter-row-1">
              <div className="search-box"><i className="fas fa-search"></i><input type="text" placeholder="Search transactions..." className="search-input" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
            </div>
            <div className="filter-row-2">
              <div className="date-range"><input type="date" className="date-input" value={startDate} onChange={(e) => setStartDate(e.target.value)} /><input type="date" className="date-input" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
              <button className="btn-filter" onClick={() => { setPage(1); fetchTransactions(); }}>Apply</button>
            </div>
            <div className="filter-row-3">
              <select className="filter-select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                <option value="all">All Types</option><option value="Revenue">Revenue Only</option><option value="Expense">Expenses Only</option>
              </select>
              <div className="filter-actions">
                <div className="view-options">
                  <button className={`view-btn ${viewMode === 'table' ? 'active' : ''}`} onClick={() => setViewMode('table')}><i className="fas fa-table"></i></button>
                  <button className={`view-btn ${viewMode === 'cards' ? 'active' : ''}`} onClick={() => setViewMode('cards')}><i className="fas fa-th-large"></i></button>
                </div>
              </div>
              <button className="btn-export" onClick={handleExport}><i className="fas fa-download"></i> Export</button>
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
                    <th onClick={() => handleSort('date')}>Date <i className="fas fa-sort"></i></th>
                    <th onClick={() => handleSort('type')}>Type <i className="fas fa-sort"></i></th>
                    <th>Particular</th>
                    <th>Description</th>
                    <th onClick={() => handleSort('amount')}>Gross Amt ({currencySymbol}) <i className="fas fa-sort"></i></th>
                    <th onClick={() => handleSort('vat_amount')}>VAT ({currencySymbol}) <i className="fas fa-sort"></i></th>
                    <th onClick={() => handleSort('amount')}>Net Amt ({currencySymbol}) <i className="fas fa-sort"></i></th>
                    <th>Payment Mode</th>
                    <th>Recorded By</th>
                    <th>Receipt(s)</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && transactions.length === 0 ? (
                    <tr><td colSpan="11" className="loading-state">Loading...</td></tr>
                  ) : transactions.length === 0 ? (
                    <tr><td colSpan="11" className="loading-state">No transactions found</td></tr>
                  ) : (
                    transactions.map((tx) => {
                      const gross = tx.type === 'Revenue' ? tx.amount + (tx.vat_amount || 0) : tx.amount;
                      const vatClass = tx.type === 'Revenue' ? 'vat-income' : 'vat-expense';
                      const grossClass = tx.type === 'Revenue' ? 'gross-income' : 'gross-expense';
                      return (
                        <tr key={tx.id}>
                          <td>{new Date(tx.date).toLocaleDateString()}</td>
                          <td><span className={tx.type === 'Revenue' ? 'badge-income' : 'badge-expense'}>{tx.type}</span></td>
                          <td>{tx.particular}</td>
                          <td>{tx.description || '-'}</td>
                          <td className={grossClass}>{formatNumberOnly(gross)}</td>
                          <td className={vatClass}>{formatNumberOnly(tx.vat_amount || 0)}</td>
                          <td className={tx.type === 'Revenue' ? 'income-text' : 'expense-text'}>{formatNumberOnly(tx.amount)}</td>
                          <td>{tx.payment_mode}</td>
                          <td>{users[tx.user_id] || tx.user_id}</td>
                          <td>
                            {tx.receiptUrls && tx.receiptUrls.length > 0 ? (
                              <div className="receipt-links">
                                {tx.receiptUrls.map((url, idx) => (
                                  <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="receipt-link">
                                    <i className="fas fa-file-alt"></i> View {tx.receiptUrls.length > 1 ? idx + 1 : ''}
                                  </a>
                                ))}
                              </div>
                            ) : <span className="no-receipt">No receipt</span>}
                            </td>
                          <td>
                            <div className="action-buttons">
                              <button className="action-btn edit" onClick={() => openEditModal(tx)}><i className="fas fa-edit"></i></button>
                              <button className="action-btn delete" onClick={() => openDeleteModal(tx)}><i className="fas fa-trash"></i></button>
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

        {/* Card View – added conditional class "card-view" for scrollable area */}
        <div className={`view-container ${viewMode === 'cards' ? 'card-view' : ''}`} style={{ display: viewMode === 'cards' ? 'block' : 'none' }}>
          <div className="cards-grid">
            {loading && transactions.length === 0 ? (
              <div className="loading-state">Loading...</div>
            ) : transactions.length === 0 ? (
              <div className="loading-state">No transactions found</div>
            ) : (
              transactions.map((tx) => {
                const gross = tx.type === 'Revenue' ? tx.amount + (tx.vat_amount || 0) : tx.amount;
                const vatClass = tx.type === 'Revenue' ? 'vat-income' : 'vat-expense';
                const netClass = tx.type === 'Revenue' ? 'gross-income' : 'gross-expense';
                const formatCardCurrency = (amount) => `${currencySymbol} ${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                return (
                  <div key={tx.id} className={`transaction-card ${tx.type === 'Expense' ? 'expense' : ''}`}>
                    <div className="card-header">
                      <span className={`card-type ${tx.type === 'Revenue' ? 'income' : 'expense'}`}>{tx.type}</span>
                      <div className="card-date"><i className="fas fa-calendar-alt"></i> {new Date(tx.date).toLocaleDateString()}</div>
                    </div>
                    <div className="card-particular">{tx.particular}</div>
                    <div className="card-description">{tx.description || '-'}</div>
                    <div className="card-amount">{formatCardCurrency(gross)}</div>
                    <div className={`card-vat ${vatClass}`}>VAT: {formatCardCurrency(tx.vat_amount || 0)}</div>
                    <div className={`card-gross ${netClass}`}>Net: {formatCardCurrency(tx.amount)}</div>
                    <div className="card-footer">
                      <div className="card-payment"><i className="fas fa-credit-card"></i> {tx.payment_mode}</div>
                      <div className="card-actions">
                        {tx.receiptUrls && tx.receiptUrls.map((url, idx) => (
                          <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="card-action-btn"><i className="fas fa-file-alt"></i></a>
                        ))}
                        <button className="card-action-btn edit" onClick={() => openEditModal(tx)}><i className="fas fa-edit"></i></button>
                        <button className="card-action-btn delete" onClick={() => openDeleteModal(tx)}><i className="fas fa-trash"></i></button>
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
          <div className="pagination-info">Showing {startIndex} to {endIndex} of {totalCount} entries</div>
          <div className="pagination-controls">
            <button className="page-btn" onClick={() => changeViewPage('prev')} disabled={page === 1}><i className="fas fa-chevron-left"></i></button>
            <div className="page-numbers">
              <button className="page-btn window-nav" onClick={() => setVisibleStart(Math.max(1, visibleStart - 1))} disabled={visibleStart === 1}><i className="fas fa-angle-double-left"></i></button>
              {Array.from({ length: Math.min(4, totalPages) }, (_, i) => visibleStart + i).map((pageNum) => (
                <button key={pageNum} className={`page-number ${pageNum === page ? 'active' : ''}`} onClick={() => { setPage(pageNum); if (pageNum < visibleStart) setVisibleStart(Math.max(1, pageNum - 2)); else if (pageNum > visibleStart + 3) setVisibleStart(Math.min(totalPages - 3, pageNum - 2)); }}>{pageNum}</button>
              ))}
              <button className="page-btn window-nav" onClick={() => setVisibleStart(Math.min(totalPages - 3, visibleStart + 1))} disabled={visibleStart + 3 >= totalPages}><i className="fas fa-angle-double-right"></i></button>
            </div>
            <button className="page-btn" onClick={() => changeViewPage('next')} disabled={page === totalPages || totalPages === 0}><i className="fas fa-chevron-right"></i></button>
          </div>
        </div>
      </div>

      {/* Delete Modal */}
      {deleteModalOpen && (
        <div className="modal" style={{ display: 'flex' }}>
          <div className="modal-content">
            <div className="modal-header"><i className="fas fa-exclamation-triangle"></i><h3>Confirm Deletion</h3></div>
            <div className="modal-body"><p>Are you sure you want to delete this transaction?</p><p className="text-warning">This action cannot be undone.</p></div>
            <div className="modal-footer"><button className="btn btn-secondary" onClick={closeModal}>Cancel</button><button className="btn btn-danger" onClick={confirmDelete}>Delete</button></div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editModalOpen && (
        <div className="modal" style={{ display: 'flex' }}>
          <div className="modal-content modal-content-edit">
            <div className="modal-header"><h3><i className="fas fa-edit"></i> Edit Transaction</h3><button className="close-modal" onClick={closeEditModal}>&times;</button></div>
            <div className="modal-body">
              <form id="editForm">
                <div className="edit-form-grid">
                  <div className="form-group"><label>Date</label><input type="date" className="form-control" value={editFormData.date} onChange={(e) => setEditFormData(prev => ({ ...prev, date: e.target.value }))} required /></div>
                  <div className="form-group"><label>Type</label><select className="form-control" value={editFormData.type} onChange={(e) => setEditFormData(prev => ({ ...prev, type: e.target.value }))} required><option value="Revenue">Revenue</option><option value="Expense">Expense</option></select></div>
                  <div className="form-group"><label>Particular</label><input type="text" className="form-control" value={editFormData.particular} onChange={(e) => setEditFormData(prev => ({ ...prev, particular: e.target.value }))} required /></div>
                  <div className="form-group"><label>Description</label><input type="text" className="form-control" value={editFormData.description} onChange={(e) => setEditFormData(prev => ({ ...prev, description: e.target.value }))} /></div>
                  <div className="form-group"><label>Net Amount</label><input type="number" step="0.01" className="form-control" value={editFormData.amount} onChange={(e) => setEditFormData(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))} required /></div>
                  <div className="form-group"><label>VAT Amount</label><input type="number" step="0.01" min="0" className="form-control" value={editFormData.vatAmount} onChange={(e) => setEditFormData(prev => ({ ...prev, vatAmount: parseFloat(e.target.value) || 0 }))} /></div>
                  <div className="form-group"><label>Payment Mode</label><select className="form-control" value={editFormData.paymentMode} onChange={(e) => setEditFormData(prev => ({ ...prev, paymentMode: e.target.value }))} required><option value="Cash">Cash</option><option value="Mobile Money">Mobile Money</option><option value="Bank">Bank Transfer</option><option value="Card">Card Payment</option><option value="Online">Online Transfer</option><option value="Other">Other</option></select></div>
                  <div className="form-group"><label>Recorded By (User ID)</label><input type="text" className="form-control" value={editFormData.recordedBy} onChange={(e) => setEditFormData(prev => ({ ...prev, recordedBy: e.target.value }))} required /></div>

                  <div className="form-group full-width">
                    <label>Current Receipts</label>
                    <div className="edit-receipt-current">
                      {editFormData.receiptUrls && editFormData.receiptUrls.length > 0 ? (
                        editFormData.receiptUrls.map((url, idx) => (
                          <div key={idx} className="current-receipt-item">
                            <a href={url} target="_blank" rel="noopener noreferrer" className="receipt-link">
                              <i className="fas fa-file-alt"></i> Receipt {idx + 1}
                            </a>
                            <button type="button" className="remove-existing-receipt" onClick={() => removeExistingReceipt(idx)} title="Remove this receipt"><i className="fas fa-times"></i></button>
                          </div>
                        ))
                      ) : <span style={{ color: 'var(--text-muted)' }}>No receipts attached</span>}
                    </div>
                  </div>
                </div>

                <div className="file-upload-section">
                  <label>Add more receipts (optional, max 5 files total)</label>
                  <div className="file-upload-area">
                    <input type="file" accept="image/*,.pdf" multiple className="file-input" onChange={handleReceiptFilesChange} />
                    <div className="file-upload-content" style={{ display: newReceiptFiles.length ? 'none' : 'flex' }}>
                      <i className="fas fa-cloud-upload-alt"></i>
                      <p>Drag & drop or <span>browse</span> to upload</p>
                      <small>Images, PDF (Max 5MB each, up to 5 files)</small>
                    </div>
                    {newReceiptFiles.length > 0 && (
                      <div className="file-preview-list">
                        {newReceiptFiles.map((file, idx) => (
                          <div key={idx} className="file-preview">
                            <i className={getFileIcon(file.name)}></i>
                            <span className="file-name">{file.name}</span>
                            <span className="file-size">{(file.size / 1024).toFixed(1)} KB</span>
                            <button type="button" className="remove-file" onClick={(e) => { e.stopPropagation(); removeNewReceiptFile(idx); }} title="Remove this file"><i className="fas fa-times"></i></button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </form>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={closeEditModal}>Cancel</button>
              <button className="ap-invite-btn" onClick={saveEdit} disabled={saving || uploading}>{saving ? 'Saving...' : uploading ? 'Uploading...' : 'Save Changes'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}