// Application Logic for Creedmoor NC PD Flock Statistics

let historyData = [];
let latestData = null;
let currentChart = null;

// DOM Elements
const kpiPlates = document.getElementById('kpi-plates');
const kpiSearches = document.getElementById('kpi-searches');
const kpiHits = document.getElementById('kpi-hits');
const kpiCameras = document.getElementById('kpi-cameras');
const cameraBadge = document.getElementById('camera-badge');
const lastUpdatedText = document.getElementById('last-updated-text');
const tableBody = document.getElementById('history-table-body');

document.addEventListener('DOMContentLoaded', () => {
  loadData();
});

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
      historyData = await historyRes.json();
    }

    if (!latestData && historyData.length > 0) {
      latestData = historyData[historyData.length - 1];
    } else if (!latestData) {
      latestData = {
        date: new Date().toISOString().split('T')[0],
        timestamp: new Date().toISOString(),
        plates_detected_30d: 94218,
        searches_30d: 63,
        hotlist_hits_30d: 125,
        cameras: 10
      };
      historyData = [latestData];
    }

    renderAll();
  } catch (err) {
    console.error('Error loading data:', err);
    renderAll();
  }
}

function renderAll() {
  const current = historyData[historyData.length - 1] || latestData;

  updateKPIs(current);
  updateStatus(current);
  renderTable(historyData);
  renderChart();
}

function updateKPIs(current) {
  if (kpiPlates) kpiPlates.textContent = Number(current.plates_detected_30d).toLocaleString();
  if (kpiSearches) kpiSearches.textContent = Number(current.searches_30d).toLocaleString();
  if (kpiHits) kpiHits.textContent = Number(current.hotlist_hits_30d).toLocaleString();
  if (kpiCameras) kpiCameras.textContent = current.cameras || 10;
  if (cameraBadge) cameraBadge.textContent = `${current.cameras || 10} Cameras`;
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
    lastUpdatedText.innerHTML = `<strong>Latest Snapshot:</strong> ${dateFormatted}`;
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

  const labels = historyData.map(d => d.date);
  const platesData = historyData.map(d => d.plates_detected_30d);
  const searchesData = historyData.map(d => d.searches_30d);
  const hitsData = historyData.map(d => d.hotlist_hits_30d);

  if (currentChart) {
    currentChart.destroy();
  }

  currentChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Vehicles detected in the last 30 days',
          data: platesData,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderWidth: 2.5,
          pointRadius: historyData.length > 20 ? 3 : 5,
          pointHoverRadius: 7,
          pointBackgroundColor: '#3b82f6',
          tension: 0.25,
          yAxisID: 'yPlates'
        },
        {
          label: 'Number of Searches',
          data: searchesData,
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          borderWidth: 2.5,
          pointRadius: historyData.length > 20 ? 3 : 5,
          pointHoverRadius: 7,
          pointBackgroundColor: '#f59e0b',
          tension: 0.25,
          yAxisID: 'yActivity'
        },
        {
          label: 'Number of Hotlist Hits',
          data: hitsData,
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          borderWidth: 2.5,
          pointRadius: historyData.length > 20 ? 3 : 5,
          pointHoverRadius: 7,
          pointBackgroundColor: '#ef4444',
          tension: 0.25,
          yAxisID: 'yActivity'
        }
      ]
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
      scales: {
        x: {
          grid: { color: '#1f2937' },
          ticks: {
            color: '#9ca3af',
            font: { family: 'JetBrains Mono', size: 11 }
          }
        },
        yPlates: {
          type: 'linear',
          position: 'left',
          title: {
            display: true,
            text: 'Vehicles detected',
            color: '#60a5fa',
            font: { weight: 600 }
          },
          grid: { color: '#1f2937' },
          ticks: {
            color: '#60a5fa',
            callback: (val) => val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val
          }
        },
        yActivity: {
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
        }
      }
    }
  });
}
