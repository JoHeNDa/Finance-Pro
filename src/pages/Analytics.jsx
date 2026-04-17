import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../utils/formatting';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, PointElement, LineElement, ArcElement } from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import '../styles/analytics.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, PointElement, LineElement, ArcElement);

export default function Analytics() {
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState([]);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().setMonth(new Date().getMonth() - 3)).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [metrics, setMetrics] = useState({
    growthRate: 0,
    burnRate: 0,
    runway: 0,
    profitability: 0,
  });
  const [cumulativeData, setCumulativeData] = useState({ labels: [], net: [], revenue: [], expense: [] });
  const [dayOfWeekData, setDayOfWeekData] = useState({ labels: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], revenue: [0,0,0,0,0,0,0], expense: [0,0,0,0,0,0,0] });
  const [movingAverageData, setMovingAverageData] = useState({ labels: [], net: [], avg7: [] });
  const [categoryComparison, setCategoryComparison] = useState({ labels: [], revenue: [], expense: [] });
  const [insights, setInsights] = useState([]);

  useEffect(() => {
    if (!userProfile?.organization_id) return;
    fetchAnalyticsData();
  }, [userProfile, dateRange]);

  const fetchAnalyticsData = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('organization_id', userProfile.organization_id)
      .gte('date', dateRange.startDate)
      .lte('date', dateRange.endDate)
      .order('date', { ascending: true });

    if (error) {
      console.error('Error fetching analytics data:', error);
      setLoading(false);
      return;
    }

    setTransactions(data);
    computeMetrics(data);
    computeCumulative(data);
    computeDayOfWeek(data);
    computeMovingAverage(data);
    computeCategoryComparison(data);
    generateInsights(data);
    setLoading(false);
  };

  const handleDateRangeChange = (e) => {
    const { name, value } = e.target;
    setDateRange(prev => ({ ...prev, [name]: value }));
  };

  const handlePresetRange = (months) => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);
    setDateRange({
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    });
  };

  const computeMetrics = (data) => {
    const now = new Date();
    const oneMonthAgo = new Date(now); oneMonthAgo.setMonth(now.getMonth() - 1);
    const twoMonthsAgo = new Date(now); twoMonthsAgo.setMonth(now.getMonth() - 2);

    const revenueLastMonth = data.filter(tx => tx.type === 'Revenue' && new Date(tx.date) >= oneMonthAgo && new Date(tx.date) <= now)
      .reduce((sum, tx) => sum + tx.amount, 0);
    const revenuePrevMonth = data.filter(tx => tx.type === 'Revenue' && new Date(tx.date) >= twoMonthsAgo && new Date(tx.date) < oneMonthAgo)
      .reduce((sum, tx) => sum + tx.amount, 0);
    const growthRate = revenuePrevMonth === 0 ? 0 : ((revenueLastMonth - revenuePrevMonth) / revenuePrevMonth) * 100;

    const threeMonthsAgo = new Date(now); threeMonthsAgo.setMonth(now.getMonth() - 3);
    const expensesLast3Months = data.filter(tx => tx.type === 'Expense' && new Date(tx.date) >= threeMonthsAgo)
      .reduce((sum, tx) => sum + tx.amount, 0);
    const burnRate = expensesLast3Months / 3;

    const netIncome = data.filter(tx => tx.type === 'Revenue').reduce((sum, tx) => sum + tx.amount, 0)
      - data.filter(tx => tx.type === 'Expense').reduce((sum, tx) => sum + tx.amount, 0);
    const runway = burnRate > 0 && netIncome > 0 ? netIncome / burnRate : 0;

    const totalRevenue = data.filter(tx => tx.type === 'Revenue').reduce((sum, tx) => sum + tx.amount, 0);
    const profitability = totalRevenue > 0 ? (netIncome / totalRevenue) * 100 : 0;

    setMetrics({ growthRate, burnRate, runway, profitability });
  };

  const computeCumulative = (data) => {
    const monthlyNet = {};
    data.forEach(tx => {
      const date = new Date(tx.date);
      const monthKey = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
      const amount = tx.type === 'Revenue' ? tx.amount : -tx.amount;
      monthlyNet[monthKey] = (monthlyNet[monthKey] || 0) + amount;
    });
    const months = Object.keys(monthlyNet).sort((a,b) => new Date(a) - new Date(b));
    let cumulative = 0;
    const cumData = months.map(m => { cumulative += monthlyNet[m]; return cumulative; });
    const revenueByMonth = months.map(m => data.filter(tx => tx.type === 'Revenue' && new Date(tx.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short' }) === m)
      .reduce((sum, tx) => sum + tx.amount, 0));
    const expenseByMonth = months.map(m => data.filter(tx => tx.type === 'Expense' && new Date(tx.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short' }) === m)
      .reduce((sum, tx) => sum + tx.amount, 0));
    setCumulativeData({ labels: months, net: cumData, revenue: revenueByMonth, expense: expenseByMonth });
  };

  const computeDayOfWeek = (data) => {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const revenueByDay = new Array(7).fill(0);
    const expenseByDay = new Array(7).fill(0);
    data.forEach(tx => {
      const day = new Date(tx.date).getDay();
      if (tx.type === 'Revenue') revenueByDay[day] += tx.amount;
      else expenseByDay[day] += tx.amount;
    });
    setDayOfWeekData({ labels: dayNames, revenue: revenueByDay, expense: expenseByDay });
  };

  const computeMovingAverage = (data) => {
    const dailyNet = {};
    data.forEach(tx => {
      const dateKey = tx.date;
      const amount = tx.type === 'Revenue' ? tx.amount : -tx.amount;
      dailyNet[dateKey] = (dailyNet[dateKey] || 0) + amount;
    });
    const sortedDates = Object.keys(dailyNet).sort();
    const netArray = sortedDates.map(d => dailyNet[d]);
    const movingAvg7 = [];
    for (let i = 0; i < netArray.length; i++) {
      const start = Math.max(0, i - 6);
      const end = i + 1;
      const slice = netArray.slice(start, end);
      const avg = slice.reduce((a,b) => a + b, 0) / slice.length;
      movingAvg7.push(avg);
    }
    setMovingAverageData({
      labels: sortedDates.map(d => new Date(d).toLocaleDateString()),
      net: netArray,
      avg7: movingAvg7,
    });
  };

  const computeCategoryComparison = (data) => {
    const expenseCat = {};
    const revenueCat = {};
    data.forEach(tx => {
      if (tx.type === 'Expense') expenseCat[tx.particular] = (expenseCat[tx.particular] || 0) + tx.amount;
      else revenueCat[tx.particular] = (revenueCat[tx.particular] || 0) + tx.amount;
    });
    const topExpense = Object.entries(expenseCat).sort((a,b) => b[1] - a[1]).slice(0,5);
    const topRevenue = Object.entries(revenueCat).sort((a,b) => b[1] - a[1]).slice(0,5);
    const allLabels = [...new Set([...topExpense.map(e => e[0]), ...topRevenue.map(r => r[0])])];
    const revenueAmounts = allLabels.map(l => revenueCat[l] || 0);
    const expenseAmounts = allLabels.map(l => expenseCat[l] || 0);
    setCategoryComparison({ labels: allLabels, revenue: revenueAmounts, expense: expenseAmounts });
  };

 const generateInsights = (data) => {
  const insightsList = [];

  // 1️⃣ Compute day-of-week profit from raw data (no state dependency)
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const revenueByDay = new Array(7).fill(0);
  const expenseByDay = new Array(7).fill(0);

  data.forEach(tx => {
    const day = new Date(tx.date).getDay();
    if (tx.type === 'Revenue') revenueByDay[day] += tx.amount;
    else expenseByDay[day] += tx.amount;
  });

  const dayProfit = revenueByDay.map((rev, i) => rev - expenseByDay[i]);

  // Find best & worst days (ignore days with no activity)
  let bestDayIndex = -1, worstDayIndex = -1;
  let maxProfit = -Infinity, minProfit = Infinity;

  for (let i = 0; i < 7; i++) {
    const hasActivity = revenueByDay[i] > 0 || expenseByDay[i] > 0;
    if (hasActivity) {
      if (dayProfit[i] > maxProfit) {
        maxProfit = dayProfit[i];
        bestDayIndex = i;
      }
      if (dayProfit[i] < minProfit) {
        minProfit = dayProfit[i];
        worstDayIndex = i;
      }
    }
  }

  // Add insights only if there is genuine variety
  if (bestDayIndex !== -1 && worstDayIndex !== -1 && bestDayIndex !== worstDayIndex) {
    insightsList.push({
      icon: 'fa-calendar-check',
      title: 'Best Day for Business',
      description: `You make the most profit on ${dayNames[bestDayIndex]}s.`
    });
    insightsList.push({
      icon: 'fa-calendar-times',
      title: 'Worst Day for Business',
      description: `Performance is weakest on ${dayNames[worstDayIndex]}s.`
    });
  } else if (bestDayIndex !== -1) {
    // Only one day has activity – show a single neutral insight
    insightsList.push({
      icon: 'fa-calendar-day',
      title: 'Business Activity Day',
      description: `All your transactions occur on ${dayNames[bestDayIndex]}s.`
    });
  }

  // 2️⃣ Top expense category (unchanged, but keep it)
  const expenseCat = {};
  data.forEach(tx => { if (tx.type === 'Expense') expenseCat[tx.particular] = (expenseCat[tx.particular] || 0) + tx.amount; });
  const topExpense = Object.entries(expenseCat).sort((a,b) => b[1] - a[1])[0];
  if (topExpense) {
    const totalExpenses = Object.values(expenseCat).reduce((a,b) => a + b, 0);
    insightsList.push({
      icon: 'fa-tag',
      title: 'Top Expense Category',
      description: `"${topExpense[0]}" accounts for ${((topExpense[1] / totalExpenses) * 100).toFixed(1)}% of expenses.`
    });
  }

  // 3️⃣ Top revenue category (unchanged)
  const revenueCat = {};
  data.forEach(tx => { if (tx.type === 'Revenue') revenueCat[tx.particular] = (revenueCat[tx.particular] || 0) + tx.amount; });
  const topRevenue = Object.entries(revenueCat).sort((a,b) => b[1] - a[1])[0];
  if (topRevenue) {
    const totalRevenue = Object.values(revenueCat).reduce((a,b) => a + b, 0);
    insightsList.push({
      icon: 'fa-trophy',
      title: 'Top Revenue Category',
      description: `"${topRevenue[0]}" generates ${((topRevenue[1] / totalRevenue) * 100).toFixed(1)}% of revenue.`
    });
  }

  // 4️⃣ Revenue growth (unchanged – `metrics` is computed earlier, but you can also recompute here)
  if (metrics.growthRate !== 0) {
    insightsList.push({
      icon: metrics.growthRate > 0 ? 'fa-arrow-up' : 'fa-arrow-down',
      title: 'Revenue Trend',
      description: `Revenue has ${metrics.growthRate > 0 ? 'increased' : 'decreased'} by ${Math.abs(metrics.growthRate).toFixed(1)}% over last month.`
    });
  }

  setInsights(insightsList);
};

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          font: { size: 10 },
          usePointStyle: true,
          boxWidth: 8
        }
      },
      tooltip: {
        backgroundColor: '#1b5e20',
        titleColor: 'white',
        bodyColor: 'rgba(255,255,255,0.9)',
        padding: 8,
        cornerRadius: 6
      }
    }
  };

  if (loading) {
    return (
      <div className="an-page">
        <div className="an-loading">
          <div className="an-loading-spinner"></div>
          <p>Loading analytics data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="an-page">
      {/* Header */}
      <div className="an-header">
        
        <p>Deep insights into your financial performance</p>
      </div>

    

      {/* KPI Grid */}
      <div className="an-kpi-grid">
        <div className="an-kpi-card an-revenue-card">
          <div className="an-kpi-icon"><i className="fas fa-rocket"></i></div>
          <div className="an-kpi-content">
            <span className="an-kpi-label">Growth Rate</span>
            <span className="an-kpi-value">{metrics.growthRate > 0 ? '+' : ''}{metrics.growthRate.toFixed(1)}%</span>
            <span className="an-kpi-trend an-${metrics.growthRate >= 0 ? 'positive' : 'negative'}">
              <i className={`fas fa-${metrics.growthRate >= 0 ? 'arrow-up' : 'arrow-down'}`}></i>
              vs last month
            </span>
          </div>
        </div>
        <div className="an-kpi-card an-expenses-card">
          <div className="an-kpi-icon"><i className="fas fa-fire"></i></div>
          <div className="an-kpi-content">
            <span className="an-kpi-label">Burn Rate</span>
            <span className="an-kpi-value">{formatCurrency(metrics.burnRate)}</span>
            <span className="an-kpi-trend">monthly average</span>
          </div>
        </div>
        <div className="an-kpi-card an-profit-card">
          <div className="an-kpi-icon"><i className="fas fa-shield-alt"></i></div>
          <div className="an-kpi-content">
            <span className="an-kpi-label">Runway</span>
            <span className="an-kpi-value">{metrics.runway.toFixed(1)} mo</span>
            <span className="an-kpi-trend">at current burn rate</span>
          </div>
        </div>
        <div className="an-kpi-card an-margin-card">
          <div className="an-kpi-icon"><i className="fas fa-chart-line"></i></div>
          <div className="an-kpi-content">
            <span className="an-kpi-label">Profitability</span>
            <span className="an-kpi-value">{metrics.profitability.toFixed(1)}%</span>
            <span className="an-kpi-trend">profit margin</span>
          </div>
        </div>
      </div>

      {/* Charts Grid - 3 columns on desktop */}
      <div className="an-charts-grid">
        {/* Chart 1: Cumulative Cash Flow */}
        <div className="an-chart-card">
          <div className="an-chart-header">
            <h4><i className="fas fa-chart-area"></i> Cumulative Cash Flow</h4>
            
          </div>
          <div className="an-chart-container">
            {cumulativeData.labels.length > 0 ? (
              <Line
                data={{
                  labels: cumulativeData.labels,
                  datasets: [
                    { label: 'Cumulative Net', data: cumulativeData.net, borderColor: '#2e7d32', backgroundColor: 'rgba(46,125,50,0.1)', fill: true, tension: 0.4, pointRadius: 3, pointBackgroundColor: '#2e7d32' },
                    { label: 'Revenue', data: cumulativeData.revenue, borderColor: '#4caf50', backgroundColor: 'transparent', borderDash: [5, 5], pointRadius: 2 },
                    { label: 'Expenses', data: cumulativeData.expense, borderColor: '#c62828', backgroundColor: 'transparent', borderDash: [5, 5], pointRadius: 2 }
                  ]
                }}
                options={chartOptions}
              />
            ) : (
              <div className="an-empty"><i className="fas fa-chart-line"></i><p>No data available</p></div>
            )}
          </div>
        </div>

        {/* Chart 2: Category Comparison */}
        <div className="an-chart-card">
          <div className="an-chart-header">
            <h4><i className="fas fa-chart-bar"></i> Category Comparison</h4>
            
          </div>
          <div className="an-chart-container">
            {categoryComparison.labels.length > 0 ? (
              <Bar
                data={{
                  labels: categoryComparison.labels,
                  datasets: [
                    { label: 'Revenue', data: categoryComparison.revenue, backgroundColor: '#4caf50', borderRadius: 6, barPercentage: 0.7 },
                    { label: 'Expenses', data: categoryComparison.expense, backgroundColor: '#c62828', borderRadius: 6, barPercentage: 0.7 }
                  ]
                }}
                options={{ ...chartOptions, scales: { y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } } } }}
              />
            ) : (
              <div className="an-empty"><i className="fas fa-chart-bar"></i><p>No data available</p></div>
            )}
          </div>
        </div>

        {/* Chart 3: Day of Week Analysis */}
        <div className="an-chart-card">
          <div className="an-chart-header">
            <h4><i className="fas fa-calendar-week"></i> Day of Week Analysis</h4>
            
          </div>
          <div className="an-chart-container">
            <Bar
              data={{
                labels: dayOfWeekData.labels,
                datasets: [
                  { label: 'Revenue', data: dayOfWeekData.revenue, backgroundColor: '#4caf50', borderRadius: 6, barPercentage: 0.7 },
                  { label: 'Expenses', data: dayOfWeekData.expense, backgroundColor: '#c62828', borderRadius: 6, barPercentage: 0.7 }
                ]
              }}
              options={{ ...chartOptions, scales: { y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } } } }}
            />
          </div>
        </div>

        {/* Chart 4: Moving Averages */}
        <div className="an-chart-card">
          <div className="an-chart-header">
            <h4><i className="fas fa-trending-up"></i> Moving Averages (7-day)</h4>
            
          </div>
          <div className="an-chart-container">
            {movingAverageData.labels.length > 0 ? (
              <Line
                data={{
                  labels: movingAverageData.labels.slice(-30),
                  datasets: [
                    { label: 'Daily Net', data: movingAverageData.net.slice(-30), borderColor: '#9e9e9e', backgroundColor: 'transparent', pointRadius: 2, fill: false, tension: 0.3 },
                    { label: '7-day Average', data: movingAverageData.avg7.slice(-30), borderColor: '#ff9800', borderWidth: 3, backgroundColor: 'transparent', pointRadius: 0, fill: false, tension: 0.3 }
                  ]
                }}
                options={chartOptions}
              />
            ) : (
              <div className="an-empty"><i className="fas fa-chart-line"></i><p>No data available</p></div>
            )}
          </div>
        </div>
      </div>

      

      {/* Insights Panel */}
      <div className="an-insights-panel">
        <h3><i className="fas fa-lightbulb"></i> Key Business Insights</h3>
        <div className="an-insights-list">
          {insights.length > 0 ? (
            insights.map((ins, idx) => (
              <div className="an-insight-item" key={idx}>
                <div className="an-insight-icon"><i className={`fas ${ins.icon}`}></i></div>
                <div className="an-insight-content">
                  <div className="an-insight-title">{ins.title}</div>
                  <div className="an-insight-description">{ins.description}</div>
                </div>
              </div>
            ))
          ) : (
            <div className="an-empty">
              <i className="fas fa-chart-simple"></i>
              <p>Add more transactions to see insights</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}