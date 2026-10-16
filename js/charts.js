/**
 * CanSat Ground Control Software - Streaming Chart Coordinator
 * Renders high-frequency scientific data streams using Chart.js
 */

import { CONFIG } from './config.js';

class ChartsBoard {
  constructor() {
    this.charts = {};
  }

  /**
   * Initialize all Chart.js instances with aerospace color standards
   */
  initialize() {
    const commonOptions = {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 200, // Smooth transition transitions
        easing: 'linear'
      },
      elements: {
        line: {
          borderWidth: 2.2,
          tension: CONFIG.CHARTS.LINE_TENSION,
          fill: false
        },
        point: {
          radius: CONFIG.CHARTS.POINT_RADIUS,
          hoverRadius: 4
        }
      },
      plugins: {
        legend: {
          display: false // We use our own custom HTML legends
        },
        tooltip: {
          enabled: true,
          mode: 'index',
          intersect: false,
          backgroundColor: '#131924',
          titleFont: { family: CONFIG.CHARTS.FONT_FAMILY, size: 9 },
          bodyFont: { family: CONFIG.CHARTS.FONT_FAMILY, size: 9 },
          borderColor: '#1e2633',
          borderWidth: 1
        }
      },
      scales: {
        x: {
          type: 'category',
          grid: {
            color: CONFIG.CHARTS.GRID_COLOR,
            drawTicks: false
          },
          ticks: {
            display: false // Hide x ticks to look clean and clinical
          }
        },
        y: {
          grid: {
            color: CONFIG.CHARTS.GRID_COLOR,
            drawTicks: false
          },
          ticks: {
            color: CONFIG.CHARTS.TICK_COLOR,
            font: {
              family: CONFIG.CHARTS.FONT_FAMILY,
              size: 9
            },
            maxTicksLimit: 4
          }
        }
      }
    };

    // Chart 1: Altitude
    this.charts.altitude = new Chart(document.getElementById('chart-altitude'), {
      type: 'line',
      data: {
        labels: [],
        datasets: [{
          borderColor: '#0ea5e9', // Accent Cyan
          backgroundColor: 'rgba(14, 165, 233, 0.1)',
          data: [],
          fill: true
        }]
      },
      options: {
        ...commonOptions,
        scales: {
          ...commonOptions.scales,
          y: {
            ...commonOptions.scales.y,
            suggestedMin: 0,
            suggestedMax: 1000
          }
        }
      }
    });

    // Chart 2: Barometric Pressure
    this.charts.pressure = new Chart(document.getElementById('chart-pressure'), {
      type: 'line',
      data: {
        labels: [],
        datasets: [{
          borderColor: '#a78bfa', // Muted Purple
          data: [],
          fill: false
        }]
      },
      options: {
        ...commonOptions,
        scales: {
          ...commonOptions.scales,
          y: {
            ...commonOptions.scales.y,
            suggestedMin: 100,
            suggestedMax: 1020
          }
        }
      }
    });

    // Chart 3: Temperature
    this.charts.temperature = new Chart(document.getElementById('chart-temperature'), {
      type: 'line',
      data: {
        labels: [],
        datasets: [{
          borderColor: '#f97316', // Muted Orange
          data: [],
          fill: false
        }]
      },
      options: {
        ...commonOptions,
        scales: {
          ...commonOptions.scales,
          y: {
            ...commonOptions.scales.y,
            suggestedMin: 15,
            suggestedMax: 35
          }
        }
      }
    });

    // Chart 4: Combined Battery Voltage (Y1) & Descent Rate (Y2)
    this.charts.combined = new Chart(document.getElementById('chart-combined'), {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label: "VOLTAGE",
            borderColor: '#10b981', // Success Green
            yAxisID: 'yVoltage',
            data: [],
            borderWidth: 1.5
          },
          {
            label: "DESCENT RATE",
            borderColor: '#ef4444', // Warning Crimson Red
            yAxisID: 'yDescent',
            data: [],
            borderWidth: 1.2,
            borderDash: [4, 4]
          }
        ]
      },
      options: {
        ...commonOptions,
        scales: {
          x: commonOptions.scales.x,
          yVoltage: {
            position: 'left',
            grid: {
              color: CONFIG.CHARTS.GRID_COLOR,
              drawTicks: false
            },
            ticks: {
              color: '#10b981',
              font: { family: CONFIG.CHARTS.FONT_FAMILY, size: 9 },
              maxTicksLimit: 4
            },
            suggestedMin: 3.2,
            suggestedMax: 4.3
          },
          yDescent: {
            position: 'right',
            grid: {
              drawOnChartArea: false // Avoid grid line overlaps
            },
            ticks: {
              color: '#ef4444',
              font: { family: CONFIG.CHARTS.FONT_FAMILY, size: 9 },
              maxTicksLimit: 4
            },
            suggestedMin: 0,
            suggestedMax: 22
          }
        }
      }
    });
  }

  /**
   * Ingests a new telemetry data record, plotting it onto active streams
   * @param {Object} state - TelemetryManager state structure
   */
  update(state) {
    const timestampStr = new Date(state.timestamp || Date.now()).toLocaleTimeString();

    // Chart datasets update Helper
    const pushData = (chart, value, datasetIndex = 0) => {
      chart.data.labels.push(timestampStr);
      chart.data.datasets[datasetIndex].data.push(value);
      
      // Enforce history buffer limits to prevent memory leaks and slow browser paints
      if (chart.data.labels.length > CONFIG.MAX_HISTORY_LENGTH) {
        chart.data.labels.shift();
        chart.data.datasets[datasetIndex].data.shift();
      }
    };

    pushData(this.charts.altitude, state.altitude);
    pushData(this.charts.pressure, state.pressure);
    pushData(this.charts.temperature, state.temperature);
    pushData(this.charts.combined, state.voltage, 0);
    pushData(this.charts.combined, state.descentRate, 1);

    // Dynamic scale adjustments during apogee or flight transitions
    if (state.altitude > 1000) {
      this.charts.altitude.options.scales.y.suggestedMax = Math.round(state.altitude * 1.1);
    }

    // Update live digital value badges on chart headers
    const altEl = document.getElementById('chart-val-alt');
    if (altEl && typeof state.altitude === 'number') altEl.textContent = `${state.altitude.toFixed(1)} m`;

    const pressEl = document.getElementById('chart-val-pressure');
    if (pressEl && typeof state.pressure === 'number') pressEl.textContent = `${state.pressure.toFixed(1)} hPa`;

    const tempEl = document.getElementById('chart-val-temp');
    if (tempEl && typeof state.temperature === 'number') tempEl.textContent = `${state.temperature.toFixed(1)} °C`;

    const voltEl = document.getElementById('chart-val-voltage');
    if (voltEl && typeof state.voltage === 'number') voltEl.textContent = `${state.voltage.toFixed(2)}V`;

    const descEl = document.getElementById('chart-val-descent');
    if (descEl && typeof state.descentRate === 'number') descEl.textContent = `${state.descentRate.toFixed(1)}m/s`;

    // Execute charts re-paint
    Object.values(this.charts).forEach(chart => chart.update('none'));
  }

  /**
   * Resets all plotted data lists
   */
  reset() {
    Object.values(this.charts).forEach(chart => {
      chart.data.labels = [];
      chart.data.datasets.forEach(dataset => dataset.data = []);
      chart.update();
    });

    const altEl = document.getElementById('chart-val-alt');
    if (altEl) altEl.textContent = '0.0 m';
    const pressEl = document.getElementById('chart-val-pressure');
    if (pressEl) pressEl.textContent = '1013.25 hPa';
    const tempEl = document.getElementById('chart-val-temp');
    if (tempEl) tempEl.textContent = '25.0 °C';
    const voltEl = document.getElementById('chart-val-voltage');
    if (voltEl) voltEl.textContent = '4.20V';
    const descEl = document.getElementById('chart-val-descent');
    if (descEl) descEl.textContent = '0.0m/s';
  }

  /**
   * Captures each chart and merges them into a high-res operational review image download
   */
  exportGraphImages() {
    // Generate individual high-res chart download links
    Object.entries(this.charts).forEach(([key, chart]) => {
      const link = document.createElement('a');
      link.download = `CANSAT_CHART_${key.toUpperCase()}_${Date.now()}.png`;
      link.href = chart.toBase64Image();
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  }
}

export const chartsBoard = new ChartsBoard();
export default chartsBoard;
