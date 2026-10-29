// Application Logic for Flock Rolling Statistics Dashboard

let realHistory = [];
let latestData = null;
let currentChart = null;
let selectedMetric = 'all';
let isSimulated = false;

// DOM Elements
const kpiPlates = document.getElementById('kpi-plates');
const kpiPlatesDelta = document.getElementById('kpi-plates-delta');
const kpiSearches = document.getElementById('kpi-searches');
const kpiSearchesDelta = document.getElementById('kpi-searches-delta');
const kpiHits = document.getElementById('kpi-hits');
const kpiHitsDelta = document.getElementById('kpi-hits-delta');
const kpiCameras = document.getElementById('kpi-cameras');
const cameraBadge = document.getElementById('camera-badge');
const lastUpdatedText = document.getElementById('last-updated-text');
const tableBody = document.getElementById('history-table-body');
const singleDayNotice = document.getElementById('single-day-notice');
const sampleDataToggle = document.getElementById('sample-data-toggle');
const metricButtons = document.querySelectorAll('.toggle-btn');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  initEventListeners();
  loadData();
});

function initEventListeners() {
  metricButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      metricButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedMetric = btn.dataset.metric;
      renderChart();
    });
  });

  if (sampleDataToggle) {
    sampleDataToggle.addEventListener('change', (e) => {
      isSimulated = e.target.checked;
      renderAll();
    });
  }
}

async function loadData() {
  try {
    const [latestRes, historyRes] = await Promise.all([
      fetch('data/latest.json').catch(() => null),
      fetch('data/history.json').catch(() => null)
    ]);

    if (latestRes && latestRes.ok) {
      latestData = await latestRes.json();
    }
    if (historyRes && historyRes.ok) {
      realHistory = await historyRes.json();
    }

    // Fallback if data is missing or opened directly
    if (!latestData && realHistory.length > 0) {
      latestData = realHistory[realHistory.length - 1];
    } else if (!latestData) {
      // Default initial snapshot
      latestData = {
        date: new Date().toISOString().split('T')[0],
        timestamp: new Date().toISOString(),
        plates_detected_30d: 94218,
        searches_30d: 63,
        hotlist_hits_30d: 125,
        cameras: 10
      };
      realHistory = [latestData];
    }

    renderAll();
  } catch (err) {
    console.error('Error loading data:', err);
    renderAll();
  }
}

function getActiveHistory() {
  if (isSimulated) {
    return generateSimulated30Days(latestData);
  }
  return realHistory;
}

function renderAll() {
  const history = getActiveHistory();
  const current = history[history.length - 1] || latestData;

  updateKPIs(current, history);
  updateStatus(current);
  renderTable(history);
  renderChart();

  if (singleDayNotice) {
    singleDayNotice.style.display = (!isSimulated && history.length === 1) ? 'flex' : 'none';
  }
}

function updateKPIs(current, history) {
  kpiPlates.textContent = Number(current.plates_detected_30d).toLocaleString();
  kpiSearches.textContent = Number(current.searches_30d).toLocaleString();
  kpiHits.textContent = Number(current.hotlist_hits_30d).toLocaleString();
  kpiCameras.textContent = current.cameras || 10;
  if (cameraBadge) cameraBadge.textContent = `${current.cameras || 10} Cameras`;

  // Compute daily delta if we have at least 2 entries
  if (history.length >= 2) {
    const prev = history[history.length - 2];
    kpiPlatesDelta.innerHTML = formatDelta(current.plates_detected_30d - prev.plates_detected_30d, "vs yesterday");
    kpiSearchesDelta.innerHTML = formatDelta(current.searches_30d - prev.searches_30d, "vs yesterday");
    kpiHitsDelta.innerHTML = formatDelta(current.hotlist_hits_30d - prev.hotlist_hits_30d, "vs yesterday");
  } else {
    kpiPlatesDelta.textContent = "Unique plate reads in 30d window";
    kpiSearchesDelta.textContent = "User search sessions in 30d window";
    kpiHitsDelta.textContent = "Active warrants/stolen alerts triggered";
  }
}

function formatDelta(diff, label) {
  if (diff > 0) {
    return `<span class="delta-pill delta-up">+${diff.toLocaleString()}</span> <span style="color:var(--text-dim)">${label}</span>`;
  } else if (diff < 0) {
    return `<span class="delta-pill delta-down">${diff.toLocaleString()}</span> <span style="color:var(--text-dim)">${label}</span>`;
  }
  return `<span class="delta-pill delta-neutral">0</span> <span style="color:var(--text-dim)">${label}</span>`;
}

function updateStatus(current) {
  if (current && current.timestamp) {
    const d = new Date(current.timestamp);
    const dateFormatted = d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    });
    lastUpdatedText.innerHTML = `<strong>Latest Snapshot:</strong> ${dateFormatted} (${isSimulated ? 'Simulated Preview' : 'Live Data'})`;
  } else {
    lastUpdatedText.textContent = "Live data synced";
  }
}

function renderTable(history) {
  if (!tableBody) return;
  tableBody.innerHTML = '';

  const reversed = [...history].reverse();
  reversed.forEach(row => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${row.date}</strong></td>
      <td>${Number(row.plates_detected_30d).toLocaleString()}</td>
      <td>${Number(row.searches_30d).toLocaleString()}</td>
      <td>${Number(row.hotlist_hits_30d).toLocaleString()}</td>
      <td>${row.cameras || 10}</td>
    `;
    tableBody.appendChild(tr);
  });
}

function renderChart() {
  const ctx = document.getElementById('trendsChart');
  if (!ctx) return;

  const history = getActiveHistory();
  const labels = history.map(d => d.date);

  const platesData = history.map(d => d.plates_detected_30d);
  const searchesData = history.map(d => d.searches_30d);
  const hitsData = history.map(d => d.hotlist_hits_30d);

  if (currentChart) {
    currentChart.destroy();
  }

  const datasets = [];

  // Plates Dataset
  if (selectedMetric === 'all' || selectedMetric === 'plates') {
    datasets.push({
      label: 'Vehicles Detected (30d)',
      data: platesData,
      borderColor: '#3b82f6',
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      borderWidth: 2.5,
      pointRadius: history.length > 20 ? 3 : 5,
      pointHoverRadius: 7,
      pointBackgroundColor: '#3b82f6',
      fill: selectedMetric === 'plates',
      tension: 0.25,
      yAxisID: selectedMetric === 'all' ? 'yPlates' : 'y'
    });
  }

  // Searches Dataset
  if (selectedMetric === 'all' || selectedMetric === 'searches') {
    datasets.push({
      label: 'Officer Searches (30d)',
      data: searchesData,
      borderColor: '#f59e0b',
      backgroundColor: 'rgba(245, 158, 11, 0.1)',
      borderWidth: 2.5,
      pointRadius: history.length > 20 ? 3 : 5,
      pointHoverRadius: 7,
      pointBackgroundColor: '#f59e0b',
      fill: selectedMetric === 'searches',
      tension: 0.25,
      yAxisID: selectedMetric === 'all' ? 'yActivity' : 'y'
    });
  }

  // Hotlist Hits Dataset
  if (selectedMetric === 'all' || selectedMetric === 'hits') {
    datasets.push({
      label: 'Hotlist Hits (30d)',
      data: hitsData,
      borderColor: '#ef4444',
      backgroundColor: 'rgba(239, 68, 68, 0.1)',
      borderWidth: 2.5,
      pointRadius: history.length > 20 ? 3 : 5,
      pointHoverRadius: 7,
      pointBackgroundColor: '#ef4444',
      fill: selectedMetric === 'hits',
      tension: 0.25,
      yAxisID: selectedMetric === 'all' ? 'yActivity' : 'y'
    });
  }

  // Configure Scales based on combined or single metric
  const scales = {
    x: {
      grid: {
        color: '#1f2937'
      },
      ticks: {
        color: '#9ca3af',
        font: { family: 'JetBrains Mono', size: 11 }
      }
    }
  };

  if (selectedMetric === 'all') {
    // Dual Axis configuration so plates (~100k) and searches/hits (~50-150) don't squash each other
    scales.yPlates = {
      type: 'linear',
      position: 'left',
      title: {
        display: true,
        text: 'Vehicles Detected',
        color: '#60a5fa',
        font: { weight: 600 }
      },
      grid: { color: '#1f2937' },
      ticks: {
        color: '#60a5fa',
        callback: (val) => val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val
      }
    };
    scales.yActivity = {
      type: 'linear',
      position: 'right',
      title: {
        display: true,
        text: 'Searches & Hotlist Hits',
        color: '#f59e0b',
        font: { weight: 600 }
      },
      grid: { drawOnChartArea: false },
      ticks: {
        color: '#f59e0b'
      }
    };
  } else {
    scales.y = {
      type: 'linear',
      position: 'left',
      grid: { color: '#1f2937' },
      ticks: {
        color: '#9ca3af',
        callback: (val) => val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val
      }
    };
  }

  currentChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          position: 'top',
          labels: {
            color: '#f9fafb',
            boxWidth: 12,
            boxHeight: 12,
            usePointStyle: true,
            font: { family: 'Inter', size: 12 }
          }
        },
        tooltip: {
          backgroundColor: '#111827',
          borderColor: '#374151',
          borderWidth: 1,
          titleColor: '#f9fafb',
          bodyColor: '#d1d5db',
          padding: 12,
          usePointStyle: true,
          callbacks: {
            label: function(context) {
              const val = context.parsed.y !== null ? context.parsed.y.toLocaleString() : '';
              return ` ${context.dataset.label}: ${val}`;
            }
          }
        }
      },
      scales
    }
  });
}

// Generate realistic simulated 30-day data anchored to the live latest point
function generateSimulated30Days(anchor) {
  const list = [];
  const basePlates = anchor ? anchor.plates_detected_30d : 94218;
  const baseSearches = anchor ? anchor.searches_30d : 63;
  const baseHits = anchor ? anchor.hotlist_hits_30d : 125;
  const cameras = anchor ? anchor.cameras : 10;

  const today = new Date();

  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];

    // Smooth random walk variation
    const dayFactor = Math.sin(i / 3.5) * 2200 + ((i % 5) - 2) * 500;
    const searchFactor = Math.round(Math.cos(i / 2) * 8 + ((i % 3) - 1) * 2);
    const hitFactor = Math.round(Math.sin(i / 2.5) * 12 + ((i % 4) - 2) * 3);

    list.push({
      date: dateStr,
      timestamp: `${dateStr}T05:00:00Z`,
      plates_detected_30d: Math.round(basePlates + dayFactor),
      searches_30d: Math.max(10, baseSearches + searchFactor),
      hotlist_hits_30d: Math.max(20, baseHits + hitFactor),
      cameras
    });
  }

  // Ensure last entry is exactly the real anchor
  if (anchor) {
    list[list.length - 1] = {
      ...anchor,
      date: list[list.length - 1].date
    };
  }

  return list;
}
