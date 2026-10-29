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
const inferredTableBody = document.getElementById('inferred-table-body');
const inferredProgressText = document.getElementById('inferred-progress-text');
const inferredCountBadge = document.getElementById('inferred-count-badge');
const inferredProgressBar = document.getElementById('inferred-progress-bar');
const tabButtons = document.querySelectorAll('.tab-btn');
const tabPanes = document.querySelectorAll('.tab-pane');

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  loadData();
});

function initTabs() {
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-tab');
      tabButtons.forEach(b => b.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const targetPane = document.getElementById(targetId);
      if (targetPane) {
        targetPane.classList.add('active');
      }
    });
  });
}

async function loadData() {
  try {
    const cacheBuster = `?t=${Date.now()}`;
    const [latestRes, historyRes] = await Promise.all([
      fetch(`data/latest.json${cacheBuster}`).catch(() => null),
      fetch(`data/history.json${cacheBuster}`).catch(() => null)
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
  const prev = historyData.length >= 2 ? historyData[historyData.length - 2] : null;

  updateKPIs(current, prev);
  updateStatus(current);
  renderTable(historyData);
  renderInferredData(historyData);
  renderChart();
}

function formatStatWithDelta(value, prevValue) {
  const formattedVal = Number(value).toLocaleString();
  if (prevValue === undefined || prevValue === null) {
    return `${formattedVal} <span class="stat-delta delta-zero">(0)</span>`;
  }
  const diff = value - prevValue;
  if (diff === 0) {
    return `${formattedVal} <span class="stat-delta delta-zero">(0)</span>`;
  }
  const sign = diff > 0 ? `+${diff.toLocaleString()}` : `${diff.toLocaleString()}`;
  const cls = diff > 0 ? 'delta-pos' : 'delta-neg';
  return `${formattedVal} <span class="stat-delta ${cls}">(${sign})</span>`;
}

function updateKPIs(current, prev) {
  if (kpiPlates) {
    kpiPlates.innerHTML = formatStatWithDelta(current.plates_detected_30d, prev ? prev.plates_detected_30d : null);
  }
  if (kpiSearches) {
    kpiSearches.innerHTML = formatStatWithDelta(current.searches_30d, prev ? prev.searches_30d : null);
  }
  if (kpiHits) {
    kpiHits.innerHTML = formatStatWithDelta(current.hotlist_hits_30d, prev ? prev.hotlist_hits_30d : null);
  }
  if (kpiCameras) {
    kpiCameras.textContent = current.cameras || 10;
  }
  if (cameraBadge) {
    cameraBadge.textContent = `${current.cameras || 10} Cameras`;
  }
}

function updateStatus(current) {
  if (current && current.timestamp) {
    const d = new Date(current.timestamp);
    const dateFormatted = d.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
    lastUpdatedText.innerHTML = `<strong>Snapshot Time:</strong> ${dateFormatted}`;
  } else {
    lastUpdatedText.textContent = "Live data synced";
  }
}

function renderTable(history) {
  if (!tableBody) return;
  tableBody.innerHTML = '';

  const reversed = [...history].reverse();
  reversed.forEach((row, revIdx) => {
    const origIdx = history.length - 1 - revIdx;
    const priorRow = origIdx > 0 ? history[origIdx - 1] : null;

    let timeDisplay = row.date;
    if (row.timestamp) {
      const parts = row.timestamp.replace('Z', '').split('T');
      const dPart = parts[0];
      const tPart = parts[1] || '';
      timeDisplay = `
        <div class="table-time-primary">${tPart} UTC</div>
        <div class="table-date-secondary">${dPart}</div>
      `;
    }

    const platesCell = formatStatWithDelta(row.plates_detected_30d, priorRow ? priorRow.plates_detected_30d : null);
    const searchesCell = formatStatWithDelta(row.searches_30d, priorRow ? priorRow.searches_30d : null);
    const hitsCell = formatStatWithDelta(row.hotlist_hits_30d, priorRow ? priorRow.hotlist_hits_30d : null);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${timeDisplay}</td>
      <td>${platesCell}</td>
      <td>${searchesCell}</td>
      <td>${hitsCell}</td>
      <td>${row.cameras || 10}</td>
    `;
    tableBody.appendChild(tr);
  });
}

function formatDeltaVal(diff) {
  if (diff === 0) {
    return `<span class="stat-delta delta-zero">(0)</span>`;
  }
  const sign = diff > 0 ? `+${diff.toLocaleString()}` : `${diff.toLocaleString()}`;
  const cls = diff > 0 ? 'delta-pos' : 'delta-neg';
  return `<span class="stat-delta ${cls}">${sign}</span>`;
}

function renderInferredData(history) {
  if (!inferredTableBody) return;

  // Calculate distinct calendar dates recorded
  const distinctDates = new Set(history.map(h => h.date)).size;
  const count = Math.max(1, distinctDates);
  const percent = Math.min(100, Math.round((count / 30) * 100));

  if (inferredCountBadge) {
    inferredCountBadge.textContent = `${count} / 30 Days`;
  }
  if (inferredProgressBar) {
    inferredProgressBar.style.width = `${Math.max(5, percent)}%`;
  }
  if (inferredProgressText) {
    if (count < 30) {
      inferredProgressText.textContent = `Tracking baseline rolling sums (${count}/30 days). Net shifts are calculated via direct subtraction: R(today) - R(previous) = Added Activity - Dropped 30-Day Activity. Once 30 days are recorded, 30-day lookback differences will calculate via subtraction.`;
    } else {
      inferredProgressText.textContent = `Full 30-day baseline established. Reconstructing historical lookback activity and daily net shifts strictly via subtraction:`;
    }
  }

  inferredTableBody.innerHTML = '';
  const reversed = [...history].reverse();

  reversed.forEach((row, revIdx) => {
    const origIdx = history.length - 1 - revIdx;
    const priorRow = origIdx > 0 ? history[origIdx - 1] : null;

    // Calculate daily net difference via subtraction
    const pDiff = priorRow ? row.plates_detected_30d - priorRow.plates_detected_30d : 0;
    const sDiff = priorRow ? row.searches_30d - priorRow.searches_30d : 0;
    const hDiff = priorRow ? row.hotlist_hits_30d - priorRow.hotlist_hits_30d : 0;

    // Timestamp formatting
    let timeDisplay = row.date;
    if (row.timestamp) {
      const parts = row.timestamp.replace('Z', '').split('T');
      timeDisplay = `
        <div class="table-time-primary">${parts[1] || ''} UTC</div>
        <div class="table-date-secondary">${parts[0]}</div>
      `;
    }

    // Lookback subtraction: find entry from ~30 days prior
    let lookbackCell = `<span class="stat-delta delta-zero">Pending (Day ${count} of 30)</span>`;
    const rowDate = new Date(row.date);
    const thirtyDaysAgoRow = history.find(h => {
      const hDate = new Date(h.date);
      const diffDays = Math.round((rowDate - hDate) / (1000 * 60 * 60 * 24));
      return diffDays >= 30;
    });

    if (thirtyDaysAgoRow) {
      const lookbackPlatesDiff = row.plates_detected_30d - thirtyDaysAgoRow.plates_detected_30d;
      const lbSign = lookbackPlatesDiff >= 0 ? `+${lookbackPlatesDiff.toLocaleString()}` : `${lookbackPlatesDiff.toLocaleString()}`;
      const lbCls = lookbackPlatesDiff > 0 ? 'delta-pos' : (lookbackPlatesDiff < 0 ? 'delta-neg' : 'delta-zero');
      lookbackCell = `<span class="stat-delta ${lbCls}">${lbSign} plates (vs 30d ago)</span>`;
    }

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${timeDisplay}</td>
      <td><strong>${formatDeltaVal(pDiff)}</strong></td>
      <td><strong>${formatDeltaVal(sDiff)}</strong></td>
      <td><strong>${formatDeltaVal(hDiff)}</strong></td>
      <td>${lookbackCell}</td>
    `;
    inferredTableBody.appendChild(tr);
  });
}

function renderChart() {
  const ctx = document.getElementById('trendsChart');
  if (!ctx) return;

  const labels = historyData.map(d => {
    if (d.timestamp) {
      const t = d.timestamp.replace('Z', '').split('T');
      return `${t[0]} ${t[1] ? t[1].substring(0, 5) : ''}`.trim();
    }
    return d.date;
  });

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
