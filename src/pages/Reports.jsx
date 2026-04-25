import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../context/AuthContext.jsx';
import { formatCurrency } from '../utils/formatting.js';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title, PointElement, LineElement } from 'chart.js';
import { Doughnut, Pie } from 'react-chartjs-2';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import '../styles/reports.css';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title, PointElement, LineElement);

export default function Reports() {
  const { userProfile } = useAuth();

  const getToday = () => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  };

  const [localStartDate, setLocalStartDate] = useState(getToday());
  const [localEndDate, setLocalEndDate] = useState(getToday());
  const [appliedStartDate, setAppliedStartDate] = useState(getToday());
  const [appliedEndDate, setAppliedEndDate] = useState(getToday());
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
  const [incomeCategories, setIncomeCategories] = useState({});
  const [categories, setCategories] = useState({});
  const [paymentModes, setPaymentModes] = useState({});
  const [transactions, setTransactions] = useState([]);
  const [incomeChartData, setIncomeChartData] = useState({ labels: [], datasets: [] });
  const [categoryChartData, setCategoryChartData] = useState({ labels: [], datasets: [] });
  const [paymentChartData, setPaymentChartData] = useState({ labels: [], datasets: [] });
  const [growthMetrics, setGrowthMetrics] = useState({
    revenueGrowth: null,
    expenseGrowth: null,
    profitGrowth: null,
  });

  const formatNumberWithCommas = (amount) => {
    const num = Number(amount);
    if (Math.abs(num) < 0.001) return '';
    return num.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const fmtExport = (val) => {
    const num = parseFloat(val) || 0;
    if (Math.abs(num) < 0.001) return '';
    return num.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const normalizeCategoryName = (name) => {
    if (!name) return 'Uncategorized';
    return name
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const getPreviousPeriodDates = () => {
    const start = new Date(appliedStartDate);
    const end = new Date(appliedEndDate);
    const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
    let prevStart, prevEnd;
    if (activePreset === 'today') {
      prevStart = new Date(start);
      prevStart.setDate(start.getDate() - 1);
      prevEnd = new Date(prevStart);
    } else if (activePreset === 'week') {
      prevStart = new Date(start);
      prevStart.setDate(start.getDate() - 7);
      prevEnd = new Date(end);
      prevEnd.setDate(end.getDate() - 7);
    } else if (activePreset === 'month') {
      prevStart = new Date(start);
      prevStart.setMonth(start.getMonth() - 1);
      prevEnd = new Date(end);
      prevEnd.setMonth(end.getMonth() - 1);
      if (prevEnd < prevStart) {
        prevEnd = new Date(prevStart);
        prevEnd.setMonth(prevStart.getMonth() + 1);
        prevEnd.setDate(prevEnd.getDate() - 1);
      }
    } else if (activePreset === 'year') {
      prevStart = new Date(start);
      prevStart.setFullYear(start.getFullYear() - 1);
      prevEnd = new Date(end);
      prevEnd.setFullYear(end.getFullYear() - 1);
    } else {
      const length = diffDays;
      prevEnd = new Date(start);
      prevEnd.setDate(start.getDate() - 1);
      prevStart = new Date(prevEnd);
      prevStart.setDate(prevEnd.getDate() - length + 1);
    }
    return { prevStart, prevEnd };
  };

  const fetchAggregatesForRange = async (startDate, endDate) => {
    if (!userProfile?.organization_id) return null;
    const start = startDate.toISOString().split('T')[0];
    const end = endDate.toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('transactions')
      .select('type, amount, vat_amount')
      .eq('organization_id', userProfile.organization_id)
      .gte('date', start)
      .lte('date', end);
    if (error) {
      console.error('Error fetching previous period data:', error);
      return null;
    }
    let grossRevenue = 0, netRevenue = 0, vat = 0, expenses = 0;
    data.forEach(tx => {
      if (tx.type === 'Revenue') {
        netRevenue += tx.amount;
        vat += tx.vat_amount || 0;
        grossRevenue += tx.amount + (tx.vat_amount || 0);
      } else {
        expenses += tx.amount;
      }
    });
    return { grossRevenue, netRevenue, vat, expenses, netIncome: netRevenue - expenses };
  };

  const updateGrowthMetrics = async () => {
    if (!userProfile?.organization_id) return;
    const { prevStart, prevEnd } = getPreviousPeriodDates();
    const prevData = await fetchAggregatesForRange(prevStart, prevEnd);
    if (!prevData) return;
    const currentNetRevenue = summary.totalNetRevenue;
    const currentExpenses = summary.totalExpenses;
    const currentNetIncome = summary.netIncome;
    const revenueGrowth = prevData.netRevenue !== 0
      ? ((currentNetRevenue - prevData.netRevenue) / Math.abs(prevData.netRevenue)) * 100
      : currentNetRevenue > 0 ? 100 : 0;
    const expenseGrowth = prevData.expenses !== 0
      ? ((currentExpenses - prevData.expenses) / Math.abs(prevData.expenses)) * 100
      : currentExpenses > 0 ? 100 : 0;
    const profitGrowth = prevData.netIncome !== 0
      ? ((currentNetIncome - prevData.netIncome) / Math.abs(prevData.netIncome)) * 100
      : currentNetIncome > 0 ? 100 : 0;
    setGrowthMetrics({
      revenueGrowth: isNaN(revenueGrowth) ? 0 : revenueGrowth,
      expenseGrowth: isNaN(expenseGrowth) ? 0 : expenseGrowth,
      profitGrowth: isNaN(profitGrowth) ? 0 : profitGrowth,
    });
  };

  useEffect(() => {
    if (!userProfile?.organization_id) return;
    fetchReportData();
  }, [userProfile, appliedStartDate, appliedEndDate]);

  useEffect(() => {
    if (summary.totalNetRevenue !== undefined && appliedStartDate && appliedEndDate) {
      updateGrowthMetrics();
    }
  }, [summary, appliedStartDate, appliedEndDate]);

  const setPresetDateRange = (range) => {
    const today = new Date();
    let start, end;
    switch (range) {
      case 'today': start = end = new Date(today.getFullYear(), today.getMonth(), today.getDate()); break;
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
      default: return;
    }
    setLocalStartDate(start);
    setLocalEndDate(end);
    setAppliedStartDate(start);
    setAppliedEndDate(end);
    setActivePreset(range);
  };

  const handleApply = () => {
    setAppliedStartDate(localStartDate);
    setAppliedEndDate(localEndDate);
    setActivePreset(null);
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
    const incomeCategoriesAgg = {};
    const expenseCategoriesAgg = {};
    const paymentModesAgg = {};
    txData.forEach(tx => {
      if (tx.type === 'Revenue') {
        totalNetRevenue += tx.amount;
        totalVAT += tx.vat_amount || 0;
        totalGrossRevenue += tx.amount + (tx.vat_amount || 0);
        const incCat = normalizeCategoryName(tx.particular);
        incomeCategoriesAgg[incCat] = (incomeCategoriesAgg[incCat] || 0) + tx.amount;
      } else {
        totalExpenses += tx.amount;
        const expCat = normalizeCategoryName(tx.particular);
        expenseCategoriesAgg[expCat] = (expenseCategoriesAgg[expCat] || 0) + tx.amount;
      }
      paymentModesAgg[tx.payment_mode] = (paymentModesAgg[tx.payment_mode] || 0) + tx.amount;
    });
    const netIncome = totalNetRevenue - totalExpenses;
    const profitMargin = totalNetRevenue > 0 ? (netIncome / totalNetRevenue) * 100 : 0;
    setSummary({ totalGrossRevenue, totalNetRevenue, totalVAT, totalExpenses, netIncome, profitMargin });
    setIncomeCategories(incomeCategoriesAgg);
    setCategories(expenseCategoriesAgg);
    setPaymentModes(paymentModesAgg);
    setTransactions(txData);
    const incLabels = Object.keys(incomeCategoriesAgg);
    const incValues = incLabels.map(l => incomeCategoriesAgg[l]);
    setIncomeChartData({
      labels: incLabels,
      datasets: [{ data: incValues, backgroundColor: ['#4caf50', '#2196f3', '#ff9800', '#9c27b0', '#00bcd4', '#e91e63', '#ffc107', '#8bc34a'] }]
    });
    const catLabels = Object.keys(expenseCategoriesAgg);
    const catValues = catLabels.map(l => expenseCategoriesAgg[l]);
    setCategoryChartData({
      labels: catLabels,
      datasets: [{ data: catValues, backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#FF6384', '#C9CBCF'] }]
    });
    const modeLabels = Object.keys(paymentModesAgg);
    const modeValues = modeLabels.map(l => paymentModesAgg[l]);
    setPaymentChartData({
      labels: modeLabels,
      datasets: [{ data: modeValues, backgroundColor: ['#0288d1', '#f9a825', '#388e3c', '#d32f2f', '#7b1fa2', '#00acc1'] }]
    });
    setLoading(false);
  };

  // ========== EXPORTS ==========
  const exportToCSV = () => {
    const sorted = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));
    const symbol = formatCurrency(0).replace(/[\d,\s\.]/g, '').trim() || '£';
    const headers = [
      'Date', 'Particular', 'Description',
      `Gross Revenue (${symbol})`, `VAT (${symbol})`, `Net Revenue (${symbol})`,
      `Expense (${symbol})`, `Balance (${symbol})`, 'Payment Mode'
    ];
    let runningBalance = 0;
    let totalGross = 0, totalVAT = 0, totalNet = 0, totalExpense = 0;
    const rows = sorted.map(tx => {
      const revenue = tx.type === 'Revenue' ? tx.amount : 0;
      const vat = tx.type === 'Revenue' ? (tx.vat_amount || 0) : 0;
      const gross = revenue + vat;
      const expense = tx.type === 'Expense' ? tx.amount : 0;
      runningBalance += (revenue - expense);
      totalGross += gross;
      totalVAT += vat;
      totalNet += revenue;
      totalExpense += expense;
      return [
        new Date(tx.date).toLocaleDateString(),
        tx.particular,
        tx.description || '',
        fmtExport(gross), fmtExport(vat), fmtExport(revenue),
        fmtExport(expense), fmtExport(runningBalance), tx.payment_mode
      ];
    });
    rows.push(['TOTAL', '', '', fmtExport(totalGross), fmtExport(totalVAT), fmtExport(totalNet), fmtExport(totalExpense), fmtExport(totalNet - totalExpense), '']);
    const csvContent = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
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
    const symbol = formatCurrency(0).replace(/[\d,\s\.]/g, '').trim() || '£';
    const wsData = [
      ['IUS Finances - Financial Statement'],
      [`Period: ${appliedStartDate.toLocaleDateString()} - ${appliedEndDate.toLocaleDateString()}`],
      [`Generated: ${new Date().toLocaleString()}`],
      [],
      ['TRANSACTION STATEMENT'],
      ['Date', 'Particular', 'Description', `Gross Revenue (${symbol})`, `VAT (${symbol})`, `Net Revenue (${symbol})`, `Expense (${symbol})`, `Balance (${symbol})`, 'Payment Mode']
    ];
    let runningBalance = 0;
    let totalGross = 0, totalVAT = 0, totalNet = 0, totalExpense = 0;
    sorted.forEach(tx => {
      const revenue = tx.type === 'Revenue' ? tx.amount : 0;
      const vat = tx.type === 'Revenue' ? (tx.vat_amount || 0) : 0;
      const gross = revenue + vat;
      const expense = tx.type === 'Expense' ? tx.amount : 0;
      runningBalance += (revenue - expense);
      totalGross += gross;
      totalVAT += vat;
      totalNet += revenue;
      totalExpense += expense;
      wsData.push([
        new Date(tx.date).toLocaleDateString(),
        tx.particular,
        tx.description || '',
        fmtExport(gross), fmtExport(vat), fmtExport(revenue),
        fmtExport(expense), fmtExport(runningBalance), tx.payment_mode
      ]);
    });
    wsData.push(['TOTAL', '', '', fmtExport(totalGross), fmtExport(totalVAT), fmtExport(totalNet), fmtExport(totalExpense), fmtExport(totalNet - totalExpense), '']);
    wsData.push([], ['SUMMARY'], ['Metric', 'Value']);
    wsData.push(['Gross Revenue', fmtExport(totalGross)]);
    wsData.push(['Net Revenue', fmtExport(totalNet)]);
    wsData.push(['Total VAT', fmtExport(totalVAT)]);
    wsData.push(['Total Expenses', fmtExport(totalExpense)]);
    wsData.push(['Net Income', fmtExport(totalNet - totalExpense)]);
    wsData.push(['Profit Margin', totalNet ? ((totalNet - totalExpense) / totalNet * 100).toFixed(1) + '%' : '0.0%']);
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Statement');
    XLSX.writeFile(wb, `statement_${appliedStartDate.toISOString().split('T')[0]}_to_${appliedEndDate.toISOString().split('T')[0]}.xlsx`);
  };

  // ========== PDF EXPORT (banded rows, fixed undefined margin) ==========
  const exportToPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const symbol = formatCurrency(0).replace(/[\d,\s\.]/g, '').trim() || '£';
    const fmtPDF = (val) => {
      const num = parseFloat(val) || 0;
      if (Math.abs(num) < 0.001) return '';
      return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };
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
    doc.setFontSize(12).setFont('helvetica','bold').text('Financial Summary', 10, y);
    y += 8;
    const summaryData = [
      ['Gross Revenue', formatCurrency(summary.totalGrossRevenue)],
      ['VAT', formatCurrency(summary.totalVAT)],
      ['Net Revenue', formatCurrency(summary.totalNetRevenue)],
      ['Expenses', formatCurrency(summary.totalExpenses)],
      ['Net Income', formatCurrency(summary.netIncome)],
      ['Profit Margin', summary.totalNetRevenue ? `${summary.profitMargin.toFixed(1)}%` : '0.0%'],
    ];
    autoTable(doc, {
      startY: y,
      head: [['Metric', 'Value']],
      body: summaryData,
      theme: 'striped',
      headStyles: { fillColor: [46,125,50], textColor: [255,255,255] },
      styles: { fontSize: 9, cellPadding: 3 },
      margin: { left: 10, right: 10 }
    });
    y = doc.lastAutoTable.finalY + 12;
    // Transaction Statement with banded rows
    doc.setFontSize(12).setFont('helvetica','bold').text('Transaction Statement', 10, y);
    y += 8;
    const sorted = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));
    let runningBalance = 0;
    let totalGross = 0, totalVAT = 0, totalNet = 0, totalExpense = 0;
    const statementRows = sorted.map(tx => {
      const revenue = tx.type === 'Revenue' ? tx.amount : 0;
      const vat = tx.type === 'Revenue' ? (tx.vat_amount || 0) : 0;
      const gross = revenue + vat;
      const expense = tx.type === 'Expense' ? tx.amount : 0;
      runningBalance += (revenue - expense);
      totalGross += gross;
      totalVAT += vat;
      totalNet += revenue;
      totalExpense += expense;
      return [
        new Date(tx.date).toLocaleDateString(),
        tx.particular,
        tx.description || '',
        fmtPDF(gross), fmtPDF(vat), fmtPDF(revenue), fmtPDF(expense), fmtPDF(runningBalance), tx.payment_mode
      ];
    });
    statementRows.push(['TOTAL', '', '', fmtPDF(totalGross), fmtPDF(totalVAT), fmtPDF(totalNet), fmtPDF(totalExpense), fmtPDF(totalNet - totalExpense), '']);
    autoTable(doc, {
      startY: y,
      head: [['Date', 'Particular', 'Description', `Gross Rev (${symbol})`, `VAT (${symbol})`, `Net Rev (${symbol})`, `Expense (${symbol})`, `Balance (${symbol})`, 'Payment']],
      body: statementRows,
      theme: 'striped',
      headStyles: { fillColor: [46,125,50], textColor: [255,255,255] },
      alternateRowStyles: { fillColor: [240,240,240] }, // banded rows
      styles: { fontSize: 8, cellPadding: 2 },
      margin: { left: 10, right: 10 },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 25 },
        2: { cellWidth: 30 },
        3: { cellWidth: 20 },
        4: { cellWidth: 18 },
        5: { cellWidth: 20 },
        6: { cellWidth: 20 },
        7: { cellWidth: 22 },
        8: { cellWidth: 25 }
      }
    });
    doc.save(`statement_${appliedStartDate.toISOString().split('T')[0]}_to_${appliedEndDate.toISOString().split('T')[0]}.pdf`);
  };

  // ========== PRINT REPORT (label above value, banded rows) ==========
 const printReport = () => {
  const printWindow = window.open('', '_blank');
  const sorted = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));
  const symbol = formatCurrency(0).replace(/[\d,\s\.]/g, '').trim() || '£';
  const fmtPrint = (val) => {
    const num = parseFloat(val) || 0;
    if (Math.abs(num) < 0.001) return '';
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  let runningBalance = 0;
  let totalGross = 0, totalVAT = 0, totalNet = 0, totalExpense = 0;
  const transactionRowsHtml = sorted.map(tx => {
    const revenue = tx.type === 'Revenue' ? tx.amount : 0;
    const vat = tx.type === 'Revenue' ? (tx.vat_amount || 0) : 0;
    const gross = revenue + vat;
    const expense = tx.type === 'Expense' ? tx.amount : 0;
    runningBalance += (revenue - expense);
    totalGross += gross;
    totalVAT += vat;
    totalNet += revenue;
    totalExpense += expense;
    return `
      <tr>
        <td>${new Date(tx.date).toLocaleDateString()}</td>
        <td>${tx.particular}</td>
        <td>${tx.description || '-'}</td>
        <td class="income" style="text-align: right;">${fmtPrint(gross)}</td>
        <td class="vat" style="text-align: right;">${fmtPrint(vat)}</td>
        <td class="income" style="text-align: right;">${fmtPrint(revenue)}</td>
        <td class="expense" style="text-align: right;">${fmtPrint(expense)}</td>
        <td style="text-align: right;">${fmtPrint(runningBalance)}</td>
        <td>${tx.payment_mode}</td>
      </tr>
    `;
  }).join('');
  const totalsRowHtml = `
    <tr style="font-weight: 700; background: #f1f8e9; border-top: 2px solid #2e7d32;">
      <td><strong>TOTAL</strong></td><td></td><td></td>
      <td class="income" style="text-align: right;">${fmtPrint(totalGross)}</td>
      <td class="vat" style="text-align: right;">${fmtPrint(totalVAT)}</td>
      <td class="income" style="text-align: right;">${fmtPrint(totalNet)}</td>
      <td class="expense" style="text-align: right;">${fmtPrint(totalExpense)}</td>
      <td style="text-align: right;">${fmtPrint(totalNet - totalExpense)}</td>
      <td></td>
    </tr>
  `;
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>IUS Finances - Financial Statement</title>
      <style>
        body { font-family: 'Inter', sans-serif; padding: 30px; color: #212529; }
        h1 { color: #2e7d32; border-bottom: 3px solid #ffd700; display: inline-block; padding-bottom: 5px; margin-bottom: 10px; }
        .period { color: #666; margin-bottom: 20px; font-size: 0.9rem; }
        .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 25px 0 30px; }
        .summary-item { background: #f8fafc; border-left: 5px solid #2e7d32; padding: 12px 15px; border-radius: 8px; }
        .summary-item .label { font-size: 0.75rem; color: #64748b; display: block; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
        .summary-item .value { font-size: 1.4rem; font-weight: 700; color: #1e293b; display: block; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 0.8rem; }
        th { background: #2e7d32; color: white; padding: 10px 6px; text-align: left; font-weight: 600; }
        td { padding: 8px 6px; border-bottom: 1px solid #e2e8f0; }
        tr:nth-child(even) { background-color: #f8fafc; }
        .income { color: #2e7d32; font-weight: 500; }
        .expense { color: #c62828; font-weight: 500; }
        .vat { color: #6c757d; font-weight: 400; }
        .footer { margin-top: 30px; text-align: center; color: #94a3b8; font-size: 0.7rem; border-top: 1px solid #e2e8f0; padding-top: 15px; }
        @media print { body { padding: 15px; } }
      </style>
    </head>
    <body>
      <h1>IUS Finances</h1>
      <div class="period">
        Period: ${appliedStartDate.toLocaleDateString()} - ${appliedEndDate.toLocaleDateString()}<br>
        Generated: ${new Date().toLocaleString()}
      </div>
      <h3 style="margin-bottom: 10px;">Financial Summary</h3>
      <div class="summary-grid">
        <div class="summary-item"><span class="label">Gross Revenue</span><span class="value">${formatCurrency(summary.totalGrossRevenue)}</span></div>
        <div class="summary-item"><span class="label">VAT</span><span class="value">${formatCurrency(summary.totalVAT)}</span></div>
        <div class="summary-item"><span class="label">Net Revenue</span><span class="value">${formatCurrency(summary.totalNetRevenue)}</span></div>
        <div class="summary-item"><span class="label">Expenses</span><span class="value">${formatCurrency(summary.totalExpenses)}</span></div>
        <div class="summary-item"><span class="label">Net Income</span><span class="value">${formatCurrency(summary.netIncome)}</span></div>
        <div class="summary-item"><span class="label">Profit Margin</span><span class="value">${summary.totalNetRevenue ? summary.profitMargin.toFixed(1) + '%' : '0.0%'}</span></div>
      </div>
      <h3 style="margin-bottom: 10px;">Transaction Statement</h3>
      <table>
        <thead>
          <tr>
            <th>Date</th><th>Particular</th><th>Description</th>
            <th>Gross Rev (${symbol})</th><th>VAT (${symbol})</th>
            <th>Net Rev (${symbol})</th><th>Expense (${symbol})</th>
            <th>Balance (${symbol})</th><th>Payment Mode</th>
          </tr>
        </thead>
        <tbody>
          ${transactionRowsHtml}
          ${totalsRowHtml}
        </tbody>
      </table>
      <div class="footer">IUS Finances • Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</div>
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

  const formatGrowth = (value) => {
    if (value === null) return 'N/A';
    const formatted = value.toFixed(1);
    return `${value >= 0 ? '+' : ''}${formatted}%`;
  };

  return (
    <div className="rp-page">
      <div className="rp-filter-card">
        <div className="rp-filter-header">
          <h3><i className="fas fa-calendar-alt"></i> Report Period</h3>
          <div className="rp-preset-buttons">
            <button className={`rp-preset-btn ${activePreset === 'today' ? 'active' : ''}`} onClick={() => setPresetDateRange('today')}>Today</button>
            <button className={`rp-preset-btn ${activePreset === 'week' ? 'active' : ''}`} onClick={() => setPresetDateRange('week')}>This Week</button>
            <button className={`rp-preset-btn ${activePreset === 'month' ? 'active' : ''}`} onClick={() => setPresetDateRange('month')}>This Month</button>
            <button className={`rp-preset-btn ${activePreset === 'year' ? 'active' : ''}`} onClick={() => setPresetDateRange('year')}>This Year</button>
            <button className={`rp-preset-btn ${activePreset === 'all' ? 'active' : ''}`} onClick={() => setPresetDateRange('all')}>All Time</button>
          </div>
        </div>
        <div className="rp-filter-body">
          <div className="rp-date-inputs">
            <div className="rp-date-group"><input type="date" className="rp-date-picker" value={localStartDate.toISOString().split('T')[0]} onChange={(e) => setLocalStartDate(new Date(e.target.value))} /></div>
            <div className="rp-date-group"><input type="date" className="rp-date-picker" value={localEndDate.toISOString().split('T')[0]} onChange={(e) => setLocalEndDate(new Date(e.target.value))} /></div>
          </div>
          <button className="rp-apply-btn" onClick={handleApply}><i className="fas fa-filter"></i> Filter</button>
        </div>
      </div>

      <div className="rp-kpi-grid-primary">
        <div className="rp-kpi-card rp-gross-card"><div className="rp-kpi-icon"><i className="fas fa-coins"></i></div><div className="rp-kpi-content"><span className="rp-kpi-label">Gross Revenue</span><span className="rp-kpi-value">{formatCurrency(summary.totalGrossRevenue)}</span><span className="rp-kpi-trend">including VAT</span></div></div>
        <div className="rp-kpi-card rp-vat-card"><div className="rp-kpi-icon"><i className="fas fa-calculator"></i></div><div className="rp-kpi-content"><span className="rp-kpi-label">Total VAT</span><span className="rp-kpi-value">{formatCurrency(summary.totalVAT)}</span><span className="rp-kpi-trend">collected on revenue</span></div></div>
        <div className="rp-kpi-card rp-income-card"><div className="rp-kpi-icon"><i className="fas fa-arrow-down"></i></div><div className="rp-kpi-content"><span className="rp-kpi-label">Net Revenue</span><span className="rp-kpi-value">{formatCurrency(summary.totalNetRevenue)}</span><span className="rp-kpi-trend"><i className="fas fa-arrow-up"></i> Minus VAT</span></div></div>
        <div className="rp-kpi-card rp-expense-card"><div className="rp-kpi-icon"><i className="fas fa-arrow-up"></i></div><div className="rp-kpi-content"><span className="rp-kpi-label">Expenses</span><span className="rp-kpi-value">{formatCurrency(summary.totalExpenses)}</span><span className="rp-kpi-trend"><i className="fas fa-arrow-down"></i> outflow</span></div></div>
        <div className="rp-kpi-card rp-profit-card"><div className="rp-kpi-icon"><i className="fas fa-chart-line"></i></div><div className="rp-kpi-content"><span className="rp-kpi-label">Net Income</span><span className="rp-kpi-value">{formatCurrency(summary.netIncome)}</span><span className="rp-kpi-trend">{summary.profitMargin.toFixed(1)}% margin</span></div></div>
        <div className="rp-kpi-card rp-margin-card"><div className="rp-kpi-icon"><i className="fas fa-percent"></i></div><div className="rp-kpi-content"><span className="rp-kpi-label">Profit Margin</span><span className="rp-kpi-value">{summary.profitMargin.toFixed(1)}%</span><span className="rp-kpi-trend">of net revenue</span></div></div>
      </div>

      <div className="rp-kpi-grid-secondary">
        <div className="rp-kpi-card"><div className="rp-kpi-icon" style={{ background: 'linear-gradient(145deg, #6a1b9a, #ab47bc)' }}><i className="fas fa-fire"></i></div><div className="rp-kpi-content"><span className="rp-kpi-label">Daily Burn Rate</span><span className="rp-kpi-value">{formatCurrency(summary.totalExpenses / 30)}</span><span className="rp-kpi-trend">avg daily expense</span></div></div>
        <div className="rp-kpi-card"><div className="rp-kpi-icon" style={{ background: 'linear-gradient(145deg, #00838f, #26c6da)' }}><i className="fas fa-balance-scale"></i></div><div className="rp-kpi-content"><span className="rp-kpi-label">Expense Ratio</span><span className="rp-kpi-value">{((summary.totalExpenses / summary.totalNetRevenue) * 100).toFixed(1)}%</span><span className="rp-kpi-trend">of revenue spent</span></div></div>
        <div className="rp-kpi-card"><div className="rp-kpi-icon" style={{ background: 'linear-gradient(145deg, #2e7d32, #66bb6a)' }}><i className="fas fa-chart-line"></i></div><div className="rp-kpi-content"><span className="rp-kpi-label">Revenue Growth</span><span className="rp-kpi-value">{formatGrowth(growthMetrics.revenueGrowth)}</span><span className="rp-kpi-trend">vs previous period</span></div></div>
        <div className="rp-kpi-card"><div className="rp-kpi-icon" style={{ background: 'linear-gradient(145deg, #c62828, #ef5350)' }}><i className="fas fa-chart-line"></i></div><div className="rp-kpi-content"><span className="rp-kpi-label">Expense Growth</span><span className="rp-kpi-value">{formatGrowth(growthMetrics.expenseGrowth)}</span><span className="rp-kpi-trend">vs previous period</span></div></div>
        <div className="rp-kpi-card"><div className="rp-kpi-icon" style={{ background: 'linear-gradient(145deg, #1565c0, #42a5f5)' }}><i className="fas fa-chart-line"></i></div><div className="rp-kpi-content"><span className="rp-kpi-label">Profit Growth</span><span className="rp-kpi-value">{formatGrowth(growthMetrics.profitGrowth)}</span><span className="rp-kpi-trend">vs previous period</span></div></div>
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
        <div className="rp-chart-card"><div className="rp-chart-header"><h4><i className="fas fa-chart-pie"></i> Income Categories</h4></div><div className="rp-chart-container">{incomeChartData.labels.length > 0 ? <Doughnut data={incomeChartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }} /> : <p className="rp-empty-state">No income data</p>}</div></div>
        <div className="rp-chart-card"><div className="rp-chart-header"><h4><i className="fas fa-chart-pie"></i> Expense Categories</h4></div><div className="rp-chart-container">{categoryChartData.labels.length > 0 ? <Doughnut data={categoryChartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }} /> : <p className="rp-empty-state">No expense data</p>}</div></div>
        <div className="rp-chart-card"><div className="rp-chart-header"><h4><i className="fas fa-credit-card"></i> Payment Methods</h4></div><div className="rp-chart-container">{paymentChartData.labels.length > 0 ? <Pie data={paymentChartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }} /> : <p className="rp-empty-state">No payment data</p>}</div></div>
      </div>

      <div className="rp-transactions-card">
        <div className="rp-card-header"><h4><i className="fas fa-list"></i> Transaction Details</h4><span className="rp-transaction-badge">{transactions.length} transactions</span></div>
        <div className="rp-table-responsive">
          <table className="rp-data-table">
            <thead>
              <tr>
                <th>Date</th><th>Type</th><th>Particular</th><th>Description</th>
                <th>Net ({formatCurrency(0).replace(/[\d,\s\.]/g, '').trim() || '£'})</th>
                <th>VAT ({formatCurrency(0).replace(/[\d,\s\.]/g, '').trim() || '£'})</th>
                <th>Gross ({formatCurrency(0).replace(/[\d,\s\.]/g, '').trim() || '£'})</th>
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
                    <td className={tx.type === 'Revenue' ? 'rp-income-text' : 'rp-expense-text'}>{formatNumberWithCommas(tx.amount)}</td>
                    <td className={tx.type === 'Revenue' ? 'rp-income-text' : 'rp-expense-text'}>{formatNumberWithCommas(tx.vat_amount || 0)}</td>
                    <td className={tx.type === 'Revenue' ? 'rp-income-text' : 'rp-expense-text'}>{formatNumberWithCommas(gross)}</td>
                    <td>{tx.payment_mode}</td>
                  </tr>
                );
              })}
              {transactions.length === 0 && (
                <tr><td colSpan="8" className="rp-empty-state">No transactions in this period</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}