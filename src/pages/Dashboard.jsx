import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useOrganization } from '../context/OrganizationContext';
import Chart from 'chart.js/auto';
import '../styles/dashboard.css';

export default function Dashboard() {
  const { userProfile } = useAuth();
  const { organization } = useOrganization();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({
    totalGrossRevenue: 0,
    totalNetRevenue: 0,
    totalVAT: 0,
    totalExpenses: 0,
    netIncome: 0,
    profitMargin: 0,
  });
  const [stats, setStats] = useState({
    revenueCount: 0,
    expenseCount: 0,
    avgTransaction: 0,
  });
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [monthlyData, setMonthlyData] = useState({});
  const [categories, setCategories] = useState({});
  const [paymentModes, setPaymentModes] = useState({});

  const currencySymbol = organization?.currency_symbol || '£';
  const formatCurrency = (amount) =>
    `${currencySymbol} ${Number(amount).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;

  const trendChartRef = useRef(null);
  const categoryChartRef = useRef(null);
  const paymentChartRef = useRef(null);
  const chartInstances = useRef({});

  useEffect(() => {
    if (!userProfile?.organization_id) return;
    fetchDashboardData();
  }, [userProfile]);

  const fetchDashboardData = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('organization_id', userProfile.organization_id)
      .order('date', { ascending: false });

    if (error) {
      console.error('Error fetching dashboard data:', error);
      setLoading(false);
      return;
    }

    let totalGrossRevenue = 0, totalNetRevenue = 0, totalVAT = 0, totalExpenses = 0;
    let revenueCount = 0, expenseCount = 0;
    const categoryData = {};
    const paymentModeData = {};
    const monthlyAgg = {};

    data.forEach(tx => {
      const date = new Date(tx.date);
      const monthYear = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      if (tx.type === 'Revenue') {
        totalNetRevenue += tx.amount;
        totalVAT += tx.vat_amount || 0;
        totalGrossRevenue += tx.amount + (tx.vat_amount || 0);
        revenueCount++;
        if (!monthlyAgg[monthYear]) monthlyAgg[monthYear] = { Revenue: 0, Expense: 0 };
        monthlyAgg[monthYear].Revenue += tx.amount;
      } else {
        totalExpenses += tx.amount;
        expenseCount++;
        categoryData[tx.particular] = (categoryData[tx.particular] || 0) + tx.amount;
        if (!monthlyAgg[monthYear]) monthlyAgg[monthYear] = { Revenue: 0, Expense: 0 };
        monthlyAgg[monthYear].Expense += tx.amount;
      }
      paymentModeData[tx.payment_mode] = (paymentModeData[tx.payment_mode] || 0) + tx.amount;
    });

    const netIncome = totalNetRevenue - totalExpenses;
    const profitMargin = totalNetRevenue > 0 ? (netIncome / totalNetRevenue) * 100 : 0;
    const avgTransaction = (revenueCount + expenseCount) > 0
      ? (totalNetRevenue + totalExpenses) / (revenueCount + expenseCount)
      : 0;

    setSummary({
      totalGrossRevenue,
      totalNetRevenue,
      totalVAT,
      totalExpenses,
      netIncome,
      profitMargin,
    });
    setStats({ revenueCount, expenseCount, avgTransaction });
    setRecentTransactions(data.slice(0, 10));
    setMonthlyData(monthlyAgg);
    setCategories(categoryData);
    setPaymentModes(paymentModeData);
    setLoading(false);
  };

  useEffect(() => {
    if (loading) return;

    if (chartInstances.current.trend) chartInstances.current.trend.destroy();
    if (chartInstances.current.category) chartInstances.current.category.destroy();
    if (chartInstances.current.payment) chartInstances.current.payment.destroy();

    const months = Object.keys(monthlyData).sort((a, b) => new Date(a) - new Date(b));
    const revenueData = months.map(m => monthlyData[m]?.Revenue || 0);
    const expenseData = months.map(m => monthlyData[m]?.Expense || 0);

    if (trendChartRef.current && months.length) {
      chartInstances.current.trend = new Chart(trendChartRef.current, {
        type: 'line',
        data: {
          labels: months,
          datasets: [
            { label: 'Revenue', data: revenueData, borderColor: '#2e7d32', backgroundColor: 'rgba(46,125,50,0.1)', tension: 0.4, fill: true },
            { label: 'Expenses', data: expenseData, borderColor: '#c62828', backgroundColor: 'rgba(198,40,40,0.1)', tension: 0.4, fill: true }
          ]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } } }
      });
    }

    const catNames = Object.keys(categories);
    const catValues = catNames.map(c => categories[c]);
    if (categoryChartRef.current && catNames.length && catValues.some(v => v > 0)) {
      chartInstances.current.category = new Chart(categoryChartRef.current, {
        type: 'doughnut',
        data: { labels: catNames, datasets: [{ data: catValues, backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#FF6384', '#C9CBCF'] }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
      });
    }

    const modeNames = Object.keys(paymentModes).filter(m => paymentModes[m] > 0);
    const modeValues = modeNames.map(m => paymentModes[m]);
    if (paymentChartRef.current && modeNames.length) {
      chartInstances.current.payment = new Chart(paymentChartRef.current, {
        type: 'pie',
        data: { labels: modeNames, datasets: [{ data: modeValues, backgroundColor: ['#0288d1', '#f9a825', '#388e3c'] }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
      });
    }
  }, [loading, monthlyData, categories, paymentModes]);

  if (loading) {
    return (
      <div className="layout-loading-spinner">
        <div className="layout-spinner"></div>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="db-page">
      {/* Summary Cards */}
      <div className="db-summary-grid">
        <div className="db-summary-card db-gross-revenue">
          <div className="db-card-icon"><i className="fas fa-coins"></i></div>
          <div className="db-card-content">
            <span className="db-card-label">Total Gross Revenue</span>
            <span className="db-card-value">{formatCurrency(summary.totalGrossRevenue)}</span>
            <span className="db-card-trend db-positive"><i className="fas fa-arrow-up"></i> Before VAT</span>
          </div>
        </div>

        <div className="db-summary-card db-net-revenue">
          <div className="db-card-icon"><i className="fas fa-arrow-down"></i></div>
          <div className="db-card-content">
            <span className="db-card-label">Total Net Revenue</span>
            <span className="db-card-value">{formatCurrency(summary.totalNetRevenue)}</span>
            <span className="db-card-trend db-positive"><i className="fas fa-arrow-up"></i> After VAT(20%)</span>
          </div>
        </div>

        <div className="db-summary-card db-vat">
          <div className="db-card-icon"><i className="fas fa-calculator"></i></div>
          <div className="db-card-content">
            <span className="db-card-label">Total VAT</span>
            <span className="db-card-value">{formatCurrency(summary.totalVAT)}</span>
            <span className="db-card-trend">collected</span>
          </div>
        </div>

        <div className="db-summary-card db-expense">
          <div className="db-card-icon"><i className="fas fa-arrow-up"></i></div>
          <div className="db-card-content">
            <span className="db-card-label">Total Expenses</span>
            <span className="db-card-value">{formatCurrency(summary.totalExpenses)}</span>
            <span className="db-card-trend db-negative"><i className="fas fa-arrow-down"></i> outflow</span>
          </div>
        </div>

        <div className="db-summary-card db-profit">
          <div className="db-card-icon"><i className="fas fa-chart-line"></i></div>
          <div className="db-card-content">
            <span className="db-card-label">Net Income</span>
            <span className="db-card-value">{formatCurrency(summary.netIncome)}</span>
            <span className="db-card-trend">{summary.profitMargin.toFixed(1)}%</span>
          </div>
        </div>

        <div className="db-summary-card db-margin">
          <div className="db-card-icon"><i className="fas fa-percent"></i></div>
          <div className="db-card-content">
            <span className="db-card-label">Net Margin</span>
            <span className="db-card-value">{summary.profitMargin.toFixed(1)}%</span>
            <span className="db-card-trend">of net revenue</span>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="db-stats-row">
        <div className="db-stat-item">
          <i className="fas fa-receipt"></i>
          <div>
            <span className="db-stat-label">Revenue Transactions</span>
            <span className="db-stat-value">{stats.revenueCount}</span>
          </div>
        </div>
        <div className="db-stat-item">
          <i className="fas fa-file-invoice"></i>
          <div>
            <span className="db-stat-label">Expense Transactions</span>
            <span className="db-stat-value">{stats.expenseCount}</span>
          </div>
        </div>
        <div className="db-stat-item">
          <i className="fas fa-calculator"></i>
          <div>
            <span className="db-stat-label">Avg. Transaction</span>
            <span className="db-stat-value">{formatCurrency(stats.avgTransaction)}</span>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="db-charts-grid">
        <div className="db-chart-card">
          <div className="db-chart-header">
            <h3><i className="fas fa-chart-line"></i> Revenue vs Expenses Trend</h3>
            <div className="db-chart-legend">
              <span className="db-legend-income"><i className="fas fa-circle"></i> Revenue</span>
              <span className="db-legend-expense"><i className="fas fa-circle"></i> Expenses</span>
            </div>
          </div>
          <div className="db-chart-container">
            <canvas ref={trendChartRef}></canvas>
          </div>
        </div>

        <div className="db-chart-card">
          <div className="db-chart-header">
            <h3><i className="fas fa-chart-pie"></i> Expense Categories</h3>
          </div>
          <div className="db-chart-container">
            <canvas ref={categoryChartRef}></canvas>
          </div>
        </div>

        <div className="db-chart-card">
          <div className="db-chart-header">
            <h3><i className="fas fa-credit-card"></i> Payment Methods</h3>
          </div>
          <div className="db-chart-container">
            <canvas ref={paymentChartRef}></canvas>
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="db-recent-card">
        <div className="db-card-header">
          <h3><i className="fas fa-clock"></i> Recent Transactions</h3>
          <Link to="/records" className="db-view-all-link">
            View All <i className="fas fa-arrow-right"></i>
          </Link>
        </div>
        <div className="db-table-responsive">
          <table className="db-transactions-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Particular</th>
                <th>Amount</th>
               </tr>
            </thead>
            <tbody>
              {recentTransactions.map(tx => (
                <tr key={tx.id}>
                  <td>{new Date(tx.date).toLocaleDateString()}</td>
                  <td>
                    <span className={`db-badge ${tx.type === 'Revenue' ? 'db-badge-income' : 'db-badge-expense'}`}>
                      {tx.type}
                    </span>
                  </td>
                  <td>{tx.particular}</td>
                  <td className={tx.type === 'Revenue' ? 'db-income-text' : 'db-expense-text'}>
                    {formatCurrency(tx.amount)}
                  </td>
                </tr>
              ))}
              {recentTransactions.length === 0 && (
                <tr><td colSpan="4" className="db-empty-state">No recent transactions</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}