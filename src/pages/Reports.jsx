import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../utils/formatting';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title, PointElement, LineElement } from 'chart.js';
import { Doughnut, Pie } from 'react-chartjs-2';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import '../styles/reports.css';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title, PointElement, LineElement);

export default function Reports() {
  const { userProfile } = useAuth();

  // Helper to get today at midnight (local time)
  const getToday = () => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  };

  // Local state for UI date pickers (changes immediately, no fetch)
  const [localStartDate, setLocalStartDate] = useState(getToday());
  const [localEndDate, setLocalEndDate] = useState(getToday());

  // Applied state for actual data fetching (only changes on Apply / preset)
  const [appliedStartDate, setAppliedStartDate] = useState(getToday());
  const [appliedEndDate, setAppliedEndDate] = useState(getToday());

  // Track which preset is active – initialised to 'today'
  const [activePreset, setActivePreset] = useState('today');

  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState({
    totalGrossRevenue: 0,
    totalNetRevenue: 0,
    totalVAT: 0,
    totalExpenses: 0,
    netIncome: 0,
    profitMargin: 0,
  });
  const [categories, setCategories] = useState({});
  const [paymentModes, setPaymentModes] = useState({});
  const [transactions, setTransactions] = useState([]);
  const [categoryChartData, setCategoryChartData] = useState({ labels: [], datasets: [] });
  const [paymentChartData, setPaymentChartData] = useState({ labels: [], datasets: [] });

  // Fetch only when applied dates change
  useEffect(() => {
    if (!userProfile?.organization_id) return;
    fetchReportData();
  }, [userProfile, appliedStartDate, appliedEndDate]);

  const setPresetDateRange = (range) => {
    const today = new Date();
    let start, end;
    switch (range) {
      case 'today':
        start = end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        break;
      case 'week':
        start = new Date(today);
        start.setDate(today.getDate() - today.getDay());
        start = new Date(start.getFullYear(), start.getMonth(), start.getDate());
        end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        break;
      case 'month':
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        break;
      case 'year':
        start = new Date(today.getFullYear(), 0, 1);
        end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        break;
      case 'all':
        start = new Date(2000, 0, 1);
        end = new Date(2100, 0, 1);
        break;
      default:
        return;
    }
    // Update both local and applied states immediately
    setLocalStartDate(start);
    setLocalEndDate(end);
    setAppliedStartDate(start);
    setAppliedEndDate(end);
    setActivePreset(range);
  };

  const handleApply = () => {
    setAppliedStartDate(localStartDate);
    setAppliedEndDate(localEndDate);
    setActivePreset(null); // Custom range clears preset highlight
  };

  const fetchReportData = async () => {
    if (!userProfile?.organization_id) return;
    setLoading(true);

    const start = appliedStartDate.toISOString().split('T')[0];
    const end = appliedEndDate.toISOString().split('T')[0];

    const { data: txData, error: txError } = await supabase
      .from('transactions')
      .select('*')
      .eq('organization_id', userProfile.organization_id)
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: false });

    if (txError) {
      console.error('Error fetching report data:', txError);
      setLoading(false);
      return;
    }

    let totalGrossRevenue = 0, totalNetRevenue = 0, totalVAT = 0, totalExpenses = 0;
    const expenseCategories = {};
    const paymentModesAgg = {};

    txData.forEach(tx => {
      if (tx.type === 'Revenue') {
        totalNetRevenue += tx.amount;
        totalVAT += tx.vat_amount || 0;
        totalGrossRevenue += tx.amount + (tx.vat_amount || 0);
      } else {
        totalExpenses += tx.amount;
        expenseCategories[tx.particular] = (expenseCategories[tx.particular] || 0) + tx.amount;
      }
      paymentModesAgg[tx.payment_mode] = (paymentModesAgg[tx.payment_mode] || 0) + tx.amount;
    });

    const netIncome = totalNetRevenue - totalExpenses;
    const profitMargin = totalNetRevenue > 0 ? (netIncome / totalNetRevenue) * 100 : 0;

    setSummary({
      totalGrossRevenue,
      totalNetRevenue,
      totalVAT,
      totalExpenses,
      netIncome,
      profitMargin,
    });
    setCategories(expenseCategories);
    setPaymentModes(paymentModesAgg);
    setTransactions(txData);

    // Chart data
    const catLabels = Object.keys(expenseCategories);
    const catValues = catLabels.map(l => expenseCategories[l]);
    setCategoryChartData({
      labels: catLabels,
      datasets: [{
        data: catValues,
        backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#FF6384', '#C9CBCF'],
      }],
    });

    const modeLabels = Object.keys(paymentModesAgg);
    const modeValues = modeLabels.map(l => paymentModesAgg[l]);
    setPaymentChartData({
      labels: modeLabels,
      datasets: [{
        data: modeValues,
        backgroundColor: ['#0288d1', '#f9a825', '#388e3c'],
      }],
    });

    setLoading(false);
  };

const exportToCSV = () => {
  // Sort by date ascending for running balance
  const sorted = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));

  const headers = [
    'Date',
    'Particular',
    'Description',
    'Revenue',
    'Expense',
    'VAT',
    'Gross Revenue',
    'Balance',
    'Payment Mode'
  ];

  let runningBalance = 0;
  let totalRevenue = 0, totalExpense = 0, totalVAT = 0, totalGrossRevenue = 0;

  const rows = sorted.map(tx => {
    const revenue = tx.type === 'Revenue' ? tx.amount : 0;
    const expense = tx.type === 'Expense' ? tx.amount : 0;
    const vat = tx.type === 'Revenue' ? (tx.vat_amount || 0) : 0;
    const grossRevenue = revenue + vat;

    runningBalance += (revenue - expense);
    totalRevenue += revenue;
    totalExpense += expense;
    totalVAT += vat;
    totalGrossRevenue += grossRevenue;

    return [
      new Date(tx.date).toLocaleDateString(),
      tx.particular,
      tx.description || '',
      revenue.toFixed(2),
      expense.toFixed(2),
      vat.toFixed(2),
      grossRevenue.toFixed(2),
      runningBalance.toFixed(2),
      tx.payment_mode
    ];
  });

  // Totals row
  const totalsRow = [
    'TOTAL',
    '', '',
    totalRevenue.toFixed(2),
    totalExpense.toFixed(2),
    totalVAT.toFixed(2),
    totalGrossRevenue.toFixed(2),
    (totalRevenue - totalExpense).toFixed(2),
    ''
  ];
  rows.push(totalsRow);

  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = `statement_${appliedStartDate.toISOString().split('T')[0]}_to_${appliedEndDate.toISOString().split('T')[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const exportToExcel = () => {
  const sorted = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));

  const wsData = [
    ['IUS Finances - Financial Statement'],
    [`Period: ${appliedStartDate.toLocaleDateString()} - ${appliedEndDate.toLocaleDateString()}`],
    [`Generated: ${new Date().toLocaleString()}`],
    [],
    ['TRANSACTION STATEMENT'],
    ['Date', 'Particular', 'Description', 'Revenue', 'Expense', 'VAT', 'Gross Revenue', 'Balance', 'Payment Mode']
  ];

  let runningBalance = 0;
  let totalRevenue = 0, totalExpense = 0, totalVAT = 0, totalGrossRevenue = 0;

  sorted.forEach(tx => {
    const revenue = tx.type === 'Revenue' ? tx.amount : 0;
    const expense = tx.type === 'Expense' ? tx.amount : 0;
    const vat = tx.type === 'Revenue' ? (tx.vat_amount || 0) : 0;
    const grossRevenue = revenue + vat;

    runningBalance += (revenue - expense);
    totalRevenue += revenue;
    totalExpense += expense;
    totalVAT += vat;
    totalGrossRevenue += grossRevenue;

    wsData.push([
      new Date(tx.date).toLocaleDateString(),
      tx.particular,
      tx.description || '',
      revenue.toFixed(2),
      expense.toFixed(2),
      vat.toFixed(2),
      grossRevenue.toFixed(2),
      runningBalance.toFixed(2),
      tx.payment_mode
    ]);
  });

  // Totals row
  wsData.push([
    'TOTAL',
    '', '',
    totalRevenue.toFixed(2),
    totalExpense.toFixed(2),
    totalVAT.toFixed(2),
    totalGrossRevenue.toFixed(2),
    (totalRevenue - totalExpense).toFixed(2),
    ''
  ]);

  // Summary sheet (optional)
  wsData.push([], ['SUMMARY'], ['Metric', 'Value']);
  wsData.push(['Gross Revenue', totalGrossRevenue.toFixed(2)]);
  wsData.push(['Net Revenue', totalRevenue.toFixed(2)]);
  wsData.push(['Total VAT', totalVAT.toFixed(2)]);
  wsData.push(['Total Expenses', totalExpense.toFixed(2)]);
  wsData.push(['Net Income', (totalRevenue - totalExpense).toFixed(2)]);
  wsData.push(['Profit Margin', totalRevenue ? ((totalRevenue - totalExpense) / totalRevenue * 100).toFixed(1) + '%' : '0.0%']);

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Statement');
  XLSX.writeFile(wb, `statement_${appliedStartDate.toISOString().split('T')[0]}_to_${appliedEndDate.toISOString().split('T')[0]}.xlsx`);
};

const exportToPDF = () => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFillColor(46,125,50);
  doc.rect(0,0,pageWidth,30,'F');
  doc.setTextColor(255,255,255);
  doc.setFontSize(16).setFont('helvetica','bold').text('IUS Finances',20,18);
  doc.setFontSize(10).setFont('helvetica','normal').text('Financial Statement',20,25);
  doc.setTextColor(0,0,0);
  doc.setFontSize(9);
  doc.text(`Period: ${appliedStartDate.toLocaleDateString()} - ${appliedEndDate.toLocaleDateString()}`, pageWidth-20,15, { align: 'right' });
  doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth-20,22, { align: 'right' });

  let y = 45;

  // Summary Table
  doc.setFontSize(14).setFont('helvetica','bold').text('Summary',20,y); y+=8;

  const summaryData = [
    ['Gross Revenue', formatCurrency(summary.totalGrossRevenue)],
    ['Net Revenue', formatCurrency(summary.totalNetRevenue)],
    ['Total VAT', formatCurrency(summary.totalVAT)],
    ['Total Expenses', formatCurrency(summary.totalExpenses)],
    ['Net Income', formatCurrency(summary.netIncome)],
    ['Profit Margin', `${summary.profitMargin.toFixed(1)}%`],
  ];
  autoTable(doc, {
    startY: y,
    head: [['Metric', 'Value']],
    body: summaryData,
    theme: 'striped',
    headStyles: { fillColor: [46,125,50] },
  });
  y = doc.lastAutoTable.finalY + 12;

  // Transaction Statement
  doc.setFontSize(14).setFont('helvetica','bold').text('Transaction Statement',20,y); y+=8;

  const sorted = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));
  let runningBalance = 0;
  let totalRevenue = 0, totalExpense = 0, totalVAT = 0, totalGrossRevenue = 0;

  const statementRows = sorted.map(tx => {
    const revenue = tx.type === 'Revenue' ? tx.amount : 0;
    const expense = tx.type === 'Expense' ? tx.amount : 0;
    const vat = tx.type === 'Revenue' ? (tx.vat_amount || 0) : 0;
    const grossRevenue = revenue + vat;

    runningBalance += (revenue - expense);
    totalRevenue += revenue;
    totalExpense += expense;
    totalVAT += vat;
    totalGrossRevenue += grossRevenue;

    return [
      new Date(tx.date).toLocaleDateString(),
      tx.particular,
      tx.description || '',
      formatCurrency(revenue),
      formatCurrency(expense),
      formatCurrency(vat),
      formatCurrency(grossRevenue),
      formatCurrency(runningBalance),
      tx.payment_mode
    ];
  });

  // Totals row
  statementRows.push([
    'TOTAL',
    '', '',
    formatCurrency(totalRevenue),
    formatCurrency(totalExpense),
    formatCurrency(totalVAT),
    formatCurrency(totalGrossRevenue),
    formatCurrency(totalRevenue - totalExpense),
    ''
  ]);

  autoTable(doc, {
    startY: y,
    head: [['Date', 'Particular', 'Description', 'Revenue', 'Expense', 'VAT', 'Gross Rev', 'Balance', 'Payment']],
    body: statementRows,
    theme: 'striped',
    headStyles: { fillColor: [46,125,50] },
    margin: { left: 10, right: 10 },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 25 },
      2: { cellWidth: 30 },
      3: { cellWidth: 20 },
      4: { cellWidth: 20 },
      5: { cellWidth: 18 },
      6: { cellWidth: 22 },
      7: { cellWidth: 22 },
      8: { cellWidth: 25 }
    },
    styles: { fontSize: 8 },
    headStyles: { fontSize: 8 }
  });

  doc.save(`statement_${appliedStartDate.toISOString().split('T')[0]}_to_${appliedEndDate.toISOString().split('T')[0]}.pdf`);
};

 const printReport = () => {
  const printWindow = window.open('', '_blank');
  
  // Sort transactions by date for running balance
  const sorted = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));
  
  let runningBalance = 0;
  let totalRevenue = 0, totalExpense = 0, totalVAT = 0, totalGrossRevenue = 0;

  // Generate transaction rows
  const transactionRowsHtml = sorted.map(tx => {
    const revenue = tx.type === 'Revenue' ? tx.amount : 0;
    const expense = tx.type === 'Expense' ? tx.amount : 0;
    const vat = tx.type === 'Revenue' ? (tx.vat_amount || 0) : 0;
    const grossRevenue = revenue + vat;
    
    runningBalance += (revenue - expense);
    totalRevenue += revenue;
    totalExpense += expense;
    totalVAT += vat;
    totalGrossRevenue += grossRevenue;

    return `
      <tr>
        <td>${new Date(tx.date).toLocaleDateString()}</td>
        <td>${tx.particular}</td>
        <td>${tx.description || '-'}</td>
        <td class="income">${formatCurrency(revenue)}</td>
        <td class="expense">${formatCurrency(expense)}</td>
        <td>${formatCurrency(vat)}</td>
        <td>${formatCurrency(grossRevenue)}</td>
        <td>${formatCurrency(runningBalance)}</td>
        <td>${tx.payment_mode}</td>
      </tr>
    `;
  }).join('');

  // Totals row
  const totalsRowHtml = `
    <tr style="font-weight: 700; background: #f1f8e9; border-top: 2px solid #2e7d32;">
      <td><strong>TOTAL</strong></td>
      <td></td>
      <td></td>
      <td class="income">${formatCurrency(totalRevenue)}</td>
      <td class="expense">${formatCurrency(totalExpense)}</td>
      <td>${formatCurrency(totalVAT)}</td>
      <td>${formatCurrency(totalGrossRevenue)}</td>
      <td>${formatCurrency(totalRevenue - totalExpense)}</td>
      <td></td>
    </tr>
  `;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>IUS Finances - Financial Statement</title>
      <style>
        body { 
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; 
          padding: 30px; 
          color: #212529;
        }
        h1 { 
          color: #2e7d32; 
          border-bottom: 3px solid #ffd700; 
          display: inline-block; 
          padding-bottom: 5px;
        }
        .period { 
          color: #666; 
          margin-bottom: 20px; 
          font-size: 0.9rem;
        }
        .summary-grid { 
          display: grid; 
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); 
          gap: 15px; 
          margin: 25px 0 30px; 
        }
        .summary-item { 
          background: #f8fafc; 
          border-left: 5px solid #2e7d32; 
          padding: 15px; 
          border-radius: 8px; 
        }
        .summary-item .label { 
          font-size: 0.8rem; 
          color: #64748b; 
          display: block; 
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .summary-item .value { 
          font-size: 1.8rem; 
          font-weight: 700; 
          color: #1e293b;
        }
        table { 
          width: 100%; 
          border-collapse: collapse; 
          margin-top: 20px; 
          font-size: 0.85rem;
        }
        th { 
          background: #2e7d32; 
          color: white; 
          padding: 12px 8px; 
          text-align: left; 
          font-weight: 600;
        }
        td { 
          padding: 8px; 
          border-bottom: 1px solid #e2e8f0; 
        }
        .income { color: #2e7d32; font-weight: 500; }
        .expense { color: #c62828; font-weight: 500; }
        .footer { 
          margin-top: 30px; 
          text-align: center; 
          color: #94a3b8; 
          font-size: 0.8rem;
          border-top: 1px solid #e2e8f0;
          padding-top: 15px;
        }
        @media print {
          body { padding: 15px; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <h1>IUS Finances</h1>
      <div class="period">
        Period: ${appliedStartDate.toLocaleDateString()} - ${appliedEndDate.toLocaleDateString()}<br>
        Generated: ${new Date().toLocaleString()}
      </div>
      
      <h3>Financial Summary</h3>
      <div class="summary-grid">
        <div class="summary-item">
          <span class="label">Gross Revenue</span>
          <span class="value">${formatCurrency(summary.totalGrossRevenue)}</span>
        </div>
        <div class="summary-item">
          <span class="label">Net Revenue</span>
          <span class="value">${formatCurrency(summary.totalNetRevenue)}</span>
        </div>
        <div class="summary-item">
          <span class="label">Total VAT</span>
          <span class="value">${formatCurrency(summary.totalVAT)}</span>
        </div>
        <div class="summary-item">
          <span class="label">Total Expenses</span>
          <span class="value">${formatCurrency(summary.totalExpenses)}</span>
        </div>
        <div class="summary-item">
          <span class="label">Net Income</span>
          <span class="value">${formatCurrency(summary.netIncome)}</span>
        </div>
        <div class="summary-item">
          <span class="label">Profit Margin</span>
          <span class="value">${summary.profitMargin.toFixed(1)}%</span>
        </div>
      </div>

      <h3>Transaction Statement</h3>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Particular</th>
            <th>Description</th>
            <th>Revenue</th>
            <th>Expense</th>
            <th>VAT</th>
            <th>Gross Rev</th>
            <th>Balance</th>
            <th>Payment Mode</th>
          </tr>
        </thead>
        <tbody>
          ${transactionRowsHtml}
          ${totalsRowHtml}
        </tbody>
      </table>

      <div class="footer">
        IUS Finances • Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}
      </div>
    </body>
    </html>
  `;
  
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
};

  if (loading) {
    return <div className="layout-loading-spinner"><div className="layout-spinner"></div><p>Loading report...</p></div>;
  }

  return (
    <div className="rp-page">
      <div className="rp-filter-card">
        <div className="rp-filter-header">
          <h3><i className="fas fa-calendar-alt"></i> Report Period</h3>
          <div className="rp-preset-buttons">
            <button 
              className={`rp-preset-btn ${activePreset === 'today' ? 'active' : ''}`} 
              onClick={() => setPresetDateRange('today')}
            >Today</button>
            <button 
              className={`rp-preset-btn ${activePreset === 'week' ? 'active' : ''}`} 
              onClick={() => setPresetDateRange('week')}
            >This Week</button>
            <button 
              className={`rp-preset-btn ${activePreset === 'month' ? 'active' : ''}`} 
              onClick={() => setPresetDateRange('month')}
            >This Month</button>
            <button 
              className={`rp-preset-btn ${activePreset === 'year' ? 'active' : ''}`} 
              onClick={() => setPresetDateRange('year')}
            >This Year</button>
            <button 
              className={`rp-preset-btn ${activePreset === 'all' ? 'active' : ''}`} 
              onClick={() => setPresetDateRange('all')}
            >All Time</button>
          </div>
        </div>
        <div className="rp-filter-body">
          <div className="rp-date-inputs">
            <div className="rp-date-group">
              <input
                type="date"
                className="rp-date-picker"
                value={localStartDate.toISOString().split('T')[0]}
                onChange={(e) => setLocalStartDate(new Date(e.target.value))}
              />
            </div>
            <div className="rp-date-group">
              <input
                type="date"
                className="rp-date-picker"
                value={localEndDate.toISOString().split('T')[0]}
                onChange={(e) => setLocalEndDate(new Date(e.target.value))}
              />
            </div>
          </div>
          <button className="rp-apply-btn" onClick={handleApply}>
            <i className="fas fa-filter"></i> Filter
          </button>
        </div>
      </div>

      {/* KPI grids, charts, table – unchanged from original */}
      <div className="rp-kpi-grid-primary">
        <div className="rp-kpi-card rp-gross-card">
          <div className="rp-kpi-icon"><i className="fas fa-coins"></i></div>
          <div className="rp-kpi-content">
            <span className="rp-kpi-label">Gross Revenue</span>
            <span className="rp-kpi-value">{formatCurrency(summary.totalGrossRevenue)}</span>
            <span className="rp-kpi-trend">including VAT</span>
          </div>
        </div>
        <div className="rp-kpi-card rp-vat-card">
          <div className="rp-kpi-icon"><i className="fas fa-calculator"></i></div>
          <div className="rp-kpi-content">
            <span className="rp-kpi-label">Total VAT</span>
            <span className="rp-kpi-value">{formatCurrency(summary.totalVAT)}</span>
            <span className="rp-kpi-trend">collected on revenue</span>
          </div>
        </div>
        <div className="rp-kpi-card rp-income-card">
          <div className="rp-kpi-icon"><i className="fas fa-arrow-down"></i></div>
          <div className="rp-kpi-content">
            <span className="rp-kpi-label">Net Revenue</span>
            <span className="rp-kpi-value">{formatCurrency(summary.totalNetRevenue)}</span>
            <span className="rp-kpi-trend"><i className="fas fa-arrow-up"></i> Minus VAT</span>
          </div>
        </div>
        <div className="rp-kpi-card rp-expense-card">
          <div className="rp-kpi-icon"><i className="fas fa-arrow-up"></i></div>
          <div className="rp-kpi-content">
            <span className="rp-kpi-label">Expenses</span>
            <span className="rp-kpi-value">{formatCurrency(summary.totalExpenses)}</span>
            <span className="rp-kpi-trend"><i className="fas fa-arrow-down"></i> outflow</span>
          </div>
        </div>
        <div className="rp-kpi-card rp-profit-card">
          <div className="rp-kpi-icon"><i className="fas fa-chart-line"></i></div>
          <div className="rp-kpi-content">
            <span className="rp-kpi-label">Net Income</span>
            <span className="rp-kpi-value">{formatCurrency(summary.netIncome)}</span>
            <span className="rp-kpi-trend">{summary.profitMargin.toFixed(1)}% margin</span>
          </div>
        </div>
        <div className="rp-kpi-card rp-margin-card">
          <div className="rp-kpi-icon"><i className="fas fa-percent"></i></div>
          <div className="rp-kpi-content">
            <span className="rp-kpi-label">Profit Margin</span>
            <span className="rp-kpi-value">{summary.profitMargin.toFixed(1)}%</span>
            <span className="rp-kpi-trend">of net revenue</span>
          </div>
        </div>
      </div>

      <div className="rp-kpi-grid-secondary">
        <div className="rp-kpi-card">
          <div className="rp-kpi-icon" style={{ background: 'linear-gradient(145deg, #6a1b9a, #ab47bc)' }}><i className="fas fa-fire"></i></div>
          <div className="rp-kpi-content">
            <span className="rp-kpi-label">Daily Burn Rate</span>
            <span className="rp-kpi-value">{formatCurrency(summary.totalExpenses / 30)}</span>
            <span className="rp-kpi-trend">avg daily expense</span>
          </div>
        </div>
        <div className="rp-kpi-card">
          <div className="rp-kpi-icon" style={{ background: 'linear-gradient(145deg, #00838f, #26c6da)' }}><i className="fas fa-balance-scale"></i></div>
          <div className="rp-kpi-content">
            <span className="rp-kpi-label">Expense Ratio</span>
            <span className="rp-kpi-value">{((summary.totalExpenses / summary.totalNetRevenue) * 100).toFixed(1)}%</span>
            <span className="rp-kpi-trend">of revenue spent</span>
          </div>
        </div>
        <div className="rp-kpi-card">
          <div className="rp-kpi-icon" style={{ background: 'linear-gradient(145deg, #2e7d32, #66bb6a)' }}><i className="fas fa-chart-line"></i></div>
          <div className="rp-kpi-content">
            <span className="rp-kpi-label">Revenue Growth</span>
            <span className="rp-kpi-value">N/A</span>
            <span className="rp-kpi-trend">vs previous period</span>
          </div>
        </div>
        <div className="rp-kpi-card">
          <div className="rp-kpi-icon" style={{ background: 'linear-gradient(145deg, #c62828, #ef5350)' }}><i className="fas fa-chart-line"></i></div>
          <div className="rp-kpi-content">
            <span className="rp-kpi-label">Expense Growth</span>
            <span className="rp-kpi-value">N/A</span>
            <span className="rp-kpi-trend">vs previous period</span>
          </div>
        </div>
        <div className="rp-kpi-card">
          <div className="rp-kpi-icon" style={{ background: 'linear-gradient(145deg, #1565c0, #42a5f5)' }}><i className="fas fa-chart-line"></i></div>
          <div className="rp-kpi-content">
            <span className="rp-kpi-label">Profit Growth</span>
            <span className="rp-kpi-value">N/A</span>
            <span className="rp-kpi-trend">vs previous period</span>
          </div>
        </div>
      </div>

      <div className="rp-stats-grid">
        <div className="rp-stat-card">
          <div className="rp-stat-icon"><i className="fas fa-receipt"></i></div>
          <div className="rp-stat-details">
            <span className="rp-stat-label">Revenue Transactions</span>
            <span className="rp-stat-number">{transactions.filter(t => t.type === 'Revenue').length}</span>
          </div>
        </div>
        <div className="rp-stat-card">
          <div className="rp-stat-icon"><i className="fas fa-file-invoice"></i></div>
          <div className="rp-stat-details">
            <span className="rp-stat-label">Expense Transactions</span>
            <span className="rp-stat-number">{transactions.filter(t => t.type === 'Expense').length}</span>
          </div>
        </div>
        <div className="rp-stat-card">
          <div className="rp-stat-icon"><i className="fas fa-calculator"></i></div>
          <div className="rp-stat-details">
            <span className="rp-stat-label">Avg. Transaction</span>
            <span className="rp-stat-number">{formatCurrency(transactions.length ? (summary.totalNetRevenue + summary.totalExpenses) / transactions.length : 0)}</span>
          </div>
        </div>
      </div>

      <div className="rp-export-toolbar">
        <div className="rp-export-title"><i className="fas fa-download"></i> Export Report</div>
        <div className="rp-export-buttons">
          <button className="rp-export-btn rp-pdf-btn" onClick={exportToPDF}><i className="fas fa-file-pdf"></i> PDF</button>
          <button className="rp-export-btn rp-excel-btn" onClick={exportToExcel}><i className="fas fa-file-excel"></i> Excel</button>
          <button className="rp-export-btn rp-csv-btn" onClick={exportToCSV}><i className="fas fa-file-csv"></i> CSV</button>
          <button className="rp-export-btn rp-print-btn" onClick={printReport}><i className="fas fa-print"></i> Print</button>
        </div>
      </div>

      <div className="rp-charts-grid">
        <div className="rp-chart-card">
          <div className="rp-chart-header"><h4><i className="fas fa-chart-pie"></i> Expense Categories</h4></div>
          <div className="rp-chart-container">
            {categoryChartData.labels.length > 0 ? (
              <Doughnut data={categoryChartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }} />
            ) : (
              <p className="rp-empty-state">No expense data</p>
            )}
          </div>
        </div>
        <div className="rp-chart-card">
          <div className="rp-chart-header"><h4><i className="fas fa-credit-card"></i> Payment Methods</h4></div>
          <div className="rp-chart-container">
            {paymentChartData.labels.length > 0 ? (
              <Pie data={paymentChartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }} />
            ) : (
              <p className="rp-empty-state">No payment data</p>
            )}
          </div>
        </div>
      </div>

      <div className="rp-transactions-card">
        <div className="rp-card-header">
          <h4><i className="fas fa-list"></i> Transaction Details</h4>
          <span className="rp-transaction-badge">{transactions.length} transactions</span>
        </div>
        <div className="rp-table-responsive">
          <table className="rp-data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Particular</th>
                <th>Description</th>
                <th>Net</th>
                <th>VAT</th>
                <th>Gross</th>
                <th>Payment Mode</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map(tx => {
                const gross = tx.type === 'Revenue' ? tx.amount + (tx.vat_amount || 0) : tx.amount;
                return (
                  <tr key={tx.id}>
                    <td>{new Date(tx.date).toLocaleDateString()}</td>
                    <td className={tx.type === 'Revenue' ? 'rp-income-text' : 'rp-expense-text'}>{tx.type}</td>
                    <td>{tx.particular}</td>
                    <td>{tx.description || '-'}</td>
                    <td className={tx.type === 'Revenue' ? 'rp-income-text' : 'rp-expense-text'}>{formatCurrency(tx.amount)}</td>
                    <td className={tx.type === 'Revenue' ? 'rp-income-text' : 'rp-expense-text'}>{formatCurrency(tx.vat_amount || 0)}</td>
                    <td className={tx.type === 'Revenue' ? 'rp-income-text' : 'rp-expense-text'}>{formatCurrency(gross)}</td>
                    <td>{tx.payment_mode}</td>
                  </tr>
                );
              })}
              {transactions.length === 0 && <tr><td colSpan="8" className="rp-empty-state">No transactions in this period</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}