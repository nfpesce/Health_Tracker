const STORAGE_KEY = "health-tracker-records-v1";
const SETTINGS_KEY = "health-tracker-settings-v1";
const METRIC_ORDER = ["pressure", "temperature", "oxygen"];
const DEFAULT_SETTINGS = {
  metrics: {
    pressure: true,
    temperature: true,
    oxygen: true,
  },
};
const DATE_FORMAT = new Intl.DateTimeFormat("es", {
  dateStyle: "medium",
  timeStyle: "short",
});
const CHART_AXIS_FONT =
  "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";

const form = document.querySelector("#healthForm");
const recordIdInput = document.querySelector("#recordId");
const recordDateInput = document.querySelector("#recordDate");
const systolicInput = document.querySelector("#systolic");
const diastolicInput = document.querySelector("#diastolic");
const temperatureInput = document.querySelector("#temperature");
const oxygenInput = document.querySelector("#oxygen");
const notesInput = document.querySelector("#notes");
const cancelEditBtn = document.querySelector("#cancelEditBtn");
const nowBtn = document.querySelector("#nowBtn");
const formMode = document.querySelector("#formMode");
const recordsBody = document.querySelector("#recordsBody");
const recordCards = document.querySelector("#recordCards");
const emptyState = document.querySelector("#emptyState");
const searchInput = document.querySelector("#searchInput");
const toast = document.querySelector("#toast");
const metricToggles = Array.from(document.querySelectorAll("[data-metric-toggle]"));

let settings = loadSettings();
let records = loadRecords();
let chartRange = "all";

init();

function init() {
  const decimalInputs = [systolicInput, diastolicInput, temperatureInput];
  recordDateInput.value = toInputDateTime(new Date());
  applyMetricSettings();
  form.addEventListener("submit", handleSubmit);
  cancelEditBtn.addEventListener("click", resetForm);
  nowBtn.addEventListener("click", () => {
    recordDateInput.value = toInputDateTime(new Date());
    recordDateInput.focus();
  });
  searchInput.addEventListener("input", render);
  decimalInputs.forEach((input) => {
    input.addEventListener("blur", () => normalizeDecimalInput(input));
  });
  metricToggles.forEach((input) => {
    input.addEventListener("change", () => handleMetricSettingChange(input));
  });
  document.querySelector("#exportCsvBtn").addEventListener("click", exportCsv);
  document.querySelector("#exportJsonBtn").addEventListener("click", exportJson);
  document.querySelectorAll("[data-range]").forEach((button) => {
    button.addEventListener("click", () => {
      chartRange = button.dataset.range;
      document.querySelectorAll("[data-range]").forEach((item) => item.classList.remove("is-active"));
      button.classList.add("is-active");
      renderCharts();
    });
  });
  render();
}

function handleMetricSettingChange(input) {
  const nextMetrics = { ...settings.metrics, [input.dataset.metricToggle]: input.checked };

  if (!hasActiveMetric(nextMetrics)) {
    input.checked = true;
    showToast("Selecciona al menos un dato.");
    return;
  }

  settings = { metrics: nextMetrics };
  saveSettings();
  applyMetricSettings();
  render();
  showToast("Configuracion guardada.");
}

function handleSubmit(event) {
  event.preventDefault();
  const existingRecord = records.find((item) => item.id === recordIdInput.value);
  const recordDate = new Date(recordDateInput.value);
  const preservedValues = getPreservedInactiveMetricValues(existingRecord, recordDate);
  const record = {
    id: recordIdInput.value || createId(),
    date: Number.isFinite(recordDate.getTime()) ? recordDate.toISOString() : "",
    systolic: isMetricActive("pressure") ? parseDecimal(systolicInput.value) : preservedValues.systolic,
    diastolic: isMetricActive("pressure") ? parseDecimal(diastolicInput.value) : preservedValues.diastolic,
    temperature: isMetricActive("temperature") ? parseDecimal(temperatureInput.value) : preservedValues.temperature,
    oxygen: isMetricActive("oxygen") ? Number(oxygenInput.value) : preservedValues.oxygen,
    notes: notesInput.value.trim(),
  };

  if (!isValidRecord(record)) {
    showToast("Revisa los valores ingresados.");
    return;
  }

  records = records.filter((item) => item.id !== record.id).concat(record);
  saveRecords();
  resetForm();
  render();
  showToast("Registro guardado.");
}

function isValidRecord(record) {
  return (
    Number.isFinite(new Date(record.date).getTime()) &&
    (!isMetricActive("pressure") || isPressureValid(record)) &&
    (!isMetricActive("temperature") || isTemperatureValid(record)) &&
    (!isMetricActive("oxygen") || isOxygenValid(record))
  );
}

function isStoredRecordValid(record) {
  return (
    Number.isFinite(new Date(record.date).getTime()) &&
    (isPressureValid(record) || isTemperatureValid(record) || isOxygenValid(record))
  );
}

function getPreservedInactiveMetricValues(existingRecord, recordDate) {
  const pressureSource =
    existingRecord && isPressureValid(existingRecord)
      ? existingRecord
      : getLatestRecordWithMetric("pressure", recordDate, existingRecord?.id);
  const temperatureSource =
    existingRecord && isTemperatureValid(existingRecord)
      ? existingRecord
      : getLatestRecordWithMetric("temperature", recordDate, existingRecord?.id);
  const oxygenSource =
    existingRecord && isOxygenValid(existingRecord)
      ? existingRecord
      : getLatestRecordWithMetric("oxygen", recordDate, existingRecord?.id);

  return {
    systolic: pressureSource?.systolic ?? null,
    diastolic: pressureSource?.diastolic ?? null,
    temperature: temperatureSource?.temperature ?? null,
    oxygen: oxygenSource?.oxygen ?? null,
  };
}

function getLatestRecordWithMetric(metric, recordDate, excludedId) {
  const validators = {
    pressure: isPressureValid,
    temperature: isTemperatureValid,
    oxygen: isOxygenValid,
  };
  const isValidMetricRecord = validators[metric];
  const validRecords = sortRecords(records).filter(
    (record) => record.id !== excludedId && isValidMetricRecord(record),
  );

  if (validRecords.length === 0) return null;

  const referenceTime = recordDate.getTime();
  if (!Number.isFinite(referenceTime)) return validRecords[0];

  return validRecords.find((record) => new Date(record.date).getTime() <= referenceTime) || validRecords[0];
}

function loadSettings() {
  try {
    const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    const metrics = { ...DEFAULT_SETTINGS.metrics, ...(stored.metrics || {}) };
    return { metrics: hasActiveMetric(metrics) ? metrics : { ...DEFAULT_SETTINGS.metrics } };
  } catch {
    return { ...DEFAULT_SETTINGS, metrics: { ...DEFAULT_SETTINGS.metrics } };
  }
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function loadRecords() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(stored) ? stored.map(normalizeRecord).filter(isStoredRecordValid) : [];
  } catch {
    return [];
  }
}

function normalizeRecord(record) {
  return {
    ...record,
    id: record.id || createId(),
    systolic: normalizePressureValue(record.systolic ?? record.sistolica),
    diastolic: normalizePressureValue(record.diastolic ?? record.diastolica),
    temperature: normalizeOptionalNumber(record.temperature ?? record.temperatura),
    oxygen: normalizeOptionalNumber(record.oxygen ?? record.oxigenacion),
    notes: String(record.notes || ""),
  };
}

function normalizePressureValue(value) {
  const number = normalizeOptionalNumber(value);
  if (!Number.isFinite(number)) return null;
  return number >= 30 ? roundOne(number / 10) : roundOne(number);
}

function normalizeOptionalNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function saveRecords() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sortRecords(records)));
}

function sortRecords(items) {
  return [...items].sort((a, b) => new Date(b.date) - new Date(a.date));
}

function resetForm() {
  form.reset();
  recordIdInput.value = "";
  recordDateInput.value = toInputDateTime(new Date());
  cancelEditBtn.hidden = true;
  formMode.textContent = "Completa las mediciones seleccionadas.";
  applyMetricSettings();
}

function render() {
  records = sortRecords(records);
  renderSummary();
  renderTable();
  renderCharts();
}

function renderSummary() {
  const latestPressure = records.find(isPressureValid);
  const latestTemperature = records.find(isTemperatureValid);
  const latestOxygen = records.find(isOxygenValid);

  document.querySelector("#recordCount").textContent = records.length.toString();
  document.querySelector("#latestPressure").textContent = latestPressure ? formatPressure(latestPressure) : "Sin datos";
  document.querySelector("#latestTemperature").textContent = latestTemperature
    ? `${formatDecimal(latestTemperature.temperature)} C`
    : "Sin datos";
  document.querySelector("#latestOxygen").textContent = latestOxygen ? `${latestOxygen.oxygen}%` : "Sin datos";
}

function renderTable() {
  const query = searchInput.value.trim().toLowerCase();
  const visibleRecords = records.filter((record) => {
    const haystack = `${DATE_FORMAT.format(new Date(record.date))} ${record.notes}`.toLowerCase();
    return haystack.includes(query);
  });

  recordsBody.innerHTML = "";
  recordCards.innerHTML = "";
  emptyState.hidden = visibleRecords.length > 0;

  visibleRecords.forEach((record) => {
    const status = getStatus(record);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        ${escapeHtml(DATE_FORMAT.format(new Date(record.date)))}
        ${record.notes ? `<span class="notes">${escapeHtml(record.notes)}</span>` : ""}
      </td>
      ${renderTableMetricCells(record)}
      <td><span class="status ${status.level}">${status.label}</span></td>
      <td class="actions-cell">
        <div class="row-actions">
          <button type="button" data-action="edit" data-id="${escapeHtml(record.id)}">Editar</button>
          <button type="button" data-action="delete" data-id="${escapeHtml(record.id)}">Borrar</button>
        </div>
      </td>
    `;
    recordsBody.appendChild(tr);

    const card = document.createElement("article");
    card.className = "record-card";
    card.innerHTML = `
      <div class="record-card-header">
        <div>
          <div class="record-card-date">${escapeHtml(DATE_FORMAT.format(new Date(record.date)))}</div>
          ${record.notes ? `<span class="notes">${escapeHtml(record.notes)}</span>` : ""}
        </div>
        <span class="status ${status.level}">${status.label}</span>
      </div>
      <div class="record-card-grid">
        ${renderCardMetricCells(record)}
      </div>
      <div class="record-card-actions">
        <button type="button" data-action="edit" data-id="${escapeHtml(record.id)}">Editar</button>
        <button type="button" data-action="delete" data-id="${escapeHtml(record.id)}">Borrar</button>
      </div>
    `;
    recordCards.appendChild(card);
  });

  document.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const record = records.find((item) => item.id === button.dataset.id);
      if (!record) return;
      if (button.dataset.action === "edit") editRecord(record);
      if (button.dataset.action === "delete") deleteRecord(record.id);
    });
  });
}

function renderTableMetricCells(record) {
  return getActiveMetrics()
    .map((metric) => `<td>${formatMetricValue(metric, record)}</td>`)
    .join("");
}

function renderCardMetricCells(record) {
  return getActiveMetrics()
    .map(
      (metric) => `
        <div>
          <span>${getMetricShortLabel(metric)}</span>
          <strong>${formatMetricValue(metric, record)}</strong>
        </div>
      `,
    )
    .join("");
}

function editRecord(record) {
  recordIdInput.value = record.id;
  recordDateInput.value = toInputDateTime(new Date(record.date));
  systolicInput.value = formatInputDecimal(record.systolic);
  diastolicInput.value = formatInputDecimal(record.diastolic);
  temperatureInput.value = formatInputDecimal(record.temperature);
  oxygenInput.value = Number.isFinite(Number(record.oxygen)) ? record.oxygen : "";
  notesInput.value = record.notes || "";
  cancelEditBtn.hidden = false;
  formMode.textContent = "Editando un registro existente.";
  applyMetricSettings();
  recordDateInput.focus();
}

function deleteRecord(id) {
  if (!confirm("Borrar este registro?")) return;
  records = records.filter((record) => record.id !== id);
  saveRecords();
  render();
  showToast("Registro borrado.");
}

function getStatus(record) {
  const hasActiveValue =
    (isMetricActive("pressure") && isPressureValid(record)) ||
    (isMetricActive("temperature") && isTemperatureValid(record)) ||
    (isMetricActive("oxygen") && isOxygenValid(record));

  if (!hasActiveValue) return { level: "neutral", label: "Sin datos" };

  const hasAlert =
    (isMetricActive("oxygen") && isOxygenValid(record) && record.oxygen < 92) ||
    (isMetricActive("temperature") && isTemperatureValid(record) && record.temperature >= 38) ||
    (isMetricActive("pressure") &&
      isPressureValid(record) &&
      (record.systolic >= 18 || record.diastolic >= 12));
  const hasWatch =
    (isMetricActive("oxygen") && isOxygenValid(record) && record.oxygen < 95) ||
    (isMetricActive("temperature") && isTemperatureValid(record) && record.temperature >= 37.5) ||
    (isMetricActive("pressure") &&
      isPressureValid(record) &&
      (record.systolic >= 14 || record.diastolic >= 9 || record.systolic < 9 || record.diastolic < 6));

  if (hasAlert) return { level: "alert", label: "Alerta" };
  if (hasWatch) return { level: "watch", label: "Revisar" };
  return { level: "ok", label: "Estable" };
}

function renderCharts() {
  const ascending = getChartRecords();

  if (isMetricActive("pressure")) {
    renderLineChart(document.querySelector("#pressureChart"), ascending, [
      { key: "systolic", label: "Sistolica", color: "#0b7a75", min: 8, max: 18 },
      { key: "diastolic", label: "Diastolica", color: "#b65f00", min: 8, max: 18 },
    ]);
  } else {
    document.querySelector("#pressureChart").innerHTML = "";
  }

  if (isMetricActive("temperature")) {
    renderLineChart(document.querySelector("#temperatureChart"), ascending, [
      { key: "temperature", label: "Temperatura", color: "#b3261e", min: 34, max: 40 },
    ]);
  } else {
    document.querySelector("#temperatureChart").innerHTML = "";
  }

  if (isMetricActive("oxygen")) {
    renderLineChart(document.querySelector("#oxygenChart"), ascending, [
      { key: "oxygen", label: "Oxigenacion", color: "#26734d", min: 95, max: 100 },
    ]);
  } else {
    document.querySelector("#oxygenChart").innerHTML = "";
  }
}

function getChartRecords() {
  const now = Date.now();
  return records
    .filter((record) => {
      if (chartRange === "all") return true;
      const days = Number(chartRange);
      return now - new Date(record.date).getTime() <= days * 24 * 60 * 60 * 1000;
    })
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

function renderLineChart(container, data, series) {
  const drawableSeries = series
    .map((item) => ({ ...item, points: getSeriesPoints(data, item.key) }))
    .filter((item) => item.points.length > 0);

  if (drawableSeries.length === 0) {
    container.innerHTML = `<div class="empty-state">Sin datos para graficar.</div>`;
    return;
  }

  const width = 560;
  const height = 250;
  const pad = { top: 18, right: 22, bottom: 38, left: 52 };
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  const { min, max } = getAxisRange(drawableSeries);
  const xStep = data.length > 1 ? plotWidth / (data.length - 1) : 0;

  const yFor = (value) => pad.top + ((max - value) / (max - min)) * plotHeight;
  const xFor = (index) => pad.left + index * xStep;
  const grid = [0, 0.25, 0.5, 0.75, 1]
    .map((ratio) => {
      const y = pad.top + ratio * plotHeight;
      const label = formatAxisLabel(max - ratio * (max - min));
      return `<line x1="${pad.left}" y1="${y}" x2="${width - pad.right}" y2="${y}" stroke="#d8e2de" />
        <text x="10" y="${y + 5}" fill="#46524d" font-size="14" font-weight="700" font-family="${CHART_AXIS_FONT}">${label}</text>`;
    })
    .join("");

  const paths = drawableSeries
    .map((item) => {
      const points = item.points.map(({ index, value }) => `${xFor(index)},${yFor(value)}`).join(" ");
      const dots = item.points
        .map(
          ({ index, record, value }) =>
            `<circle cx="${xFor(index)}" cy="${yFor(value)}" r="3" fill="${item.color}">
              <title>${item.label}: ${formatDecimal(value)} - ${DATE_FORMAT.format(new Date(record.date))}</title>
            </circle>`,
        )
        .join("");
      return `<polyline points="${points}" fill="none" stroke="${item.color}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" />${dots}`;
    })
    .join("");

  const firstDate = DATE_FORMAT.format(new Date(data[0].date));
  const lastDate = DATE_FORMAT.format(new Date(data[data.length - 1].date));
  const legend = drawableSeries.map((item) => `<span style="color:${item.color}">${item.label}</span>`).join("");

  container.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">
      ${grid}
      <line x1="${pad.left}" y1="${height - pad.bottom}" x2="${width - pad.right}" y2="${height - pad.bottom}" stroke="#9aa8a2" />
      ${paths}
      <text x="${pad.left}" y="${height - 10}" fill="#46524d" font-size="13" font-weight="700" font-family="${CHART_AXIS_FONT}">${escapeHtml(firstDate)}</text>
      <text x="${width - pad.right}" y="${height - 10}" text-anchor="end" fill="#46524d" font-size="13" font-weight="700" font-family="${CHART_AXIS_FONT}">${escapeHtml(lastDate)}</text>
    </svg>
    <div class="legend">${legend}</div>
  `;
}

function getSeriesPoints(data, key) {
  return data
    .map((record, index) => ({ record, index, value: Number(record[key]) }))
    .filter((point) => Number.isFinite(point.value));
}

function getAxisRange(series) {
  const allValues = series.flatMap((item) => item.points.map((point) => point.value));
  const configuredMin = Math.min(...series.map((item) => item.min));
  const configuredMax = Math.max(...series.map((item) => item.max));
  const valueMin = Math.min(...allValues);
  const valueMax = Math.max(...allValues);
  const span = configuredMax - configuredMin || 1;
  const padding = span * 0.06;

  return {
    min: valueMin < configuredMin ? Math.floor((valueMin - padding) * 10) / 10 : configuredMin,
    max: valueMax > configuredMax ? Math.ceil((valueMax + padding) * 10) / 10 : configuredMax,
  };
}

function formatAxisLabel(value) {
  return Number.isInteger(value) ? value.toString() : value.toFixed(1);
}

function exportJson() {
  downloadFile(
    `registro-salud-${todayStamp()}.json`,
    "application/json",
    JSON.stringify(sortRecords(records).map(getExportRecord), null, 2),
  );
}

function exportCsv() {
  const headers = ["fecha", ...getCsvMetricHeaders(), "notas"];
  const rows = sortRecords(records).map((record) => [
    record.date,
    ...getCsvMetricValues(record),
    record.notes || "",
  ]);
  const csv = [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
  downloadFile(`registro-salud-${todayStamp()}.csv`, "text/csv", csv);
}

function getExportRecord(record) {
  const exported = {
    id: record.id,
    date: record.date,
  };

  if (isMetricActive("pressure")) {
    exported.systolic = isPressureValid(record) ? record.systolic : null;
    exported.diastolic = isPressureValid(record) ? record.diastolic : null;
  }
  if (isMetricActive("temperature")) exported.temperature = isTemperatureValid(record) ? record.temperature : null;
  if (isMetricActive("oxygen")) exported.oxygen = isOxygenValid(record) ? record.oxygen : null;
  exported.notes = record.notes || "";

  return exported;
}

function getCsvMetricHeaders() {
  return getActiveMetrics().flatMap((metric) => {
    if (metric === "pressure") return ["sistolica", "diastolica"];
    if (metric === "temperature") return ["temperatura"];
    return ["oxigenacion"];
  });
}

function getCsvMetricValues(record) {
  return getActiveMetrics().flatMap((metric) => {
    if (metric === "pressure") {
      return [
        isPressureValid(record) ? formatExportDecimal(record.systolic) : "",
        isPressureValid(record) ? formatExportDecimal(record.diastolic) : "",
      ];
    }
    if (metric === "temperature") {
      return [isTemperatureValid(record) ? formatExportDecimal(record.temperature) : ""];
    }
    return [isOxygenValid(record) ? record.oxygen : ""];
  });
}

function downloadFile(filename, type, content) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function applyMetricSettings() {
  metricToggles.forEach((input) => {
    input.checked = isMetricActive(input.dataset.metricToggle);
  });

  document.querySelectorAll("[data-metric-field]").forEach((element) => {
    setElementVisible(element, isMetricActive(element.dataset.metricField));
  });
  document.querySelectorAll("[data-summary-metric]").forEach((element) => {
    setElementVisible(element, isMetricActive(element.dataset.summaryMetric));
  });
  document.querySelectorAll("[data-chart-metric]").forEach((element) => {
    setElementVisible(element, isMetricActive(element.dataset.chartMetric));
  });
  document.querySelectorAll("[data-table-metric]").forEach((element) => {
    setElementVisible(element, isMetricActive(element.dataset.tableMetric));
  });

  const pressureActive = isMetricActive("pressure");
  const temperatureActive = isMetricActive("temperature");
  const oxygenActive = isMetricActive("oxygen");

  systolicInput.required = pressureActive;
  systolicInput.disabled = !pressureActive;
  diastolicInput.required = pressureActive;
  diastolicInput.disabled = !pressureActive;
  temperatureInput.required = temperatureActive;
  temperatureInput.disabled = !temperatureActive;
  oxygenInput.required = oxygenActive;
  oxygenInput.disabled = !oxygenActive;
}

function setElementVisible(element, isVisible) {
  element.hidden = !isVisible;
  element.style.display = isVisible ? "" : "none";
}

function getActiveMetrics() {
  return METRIC_ORDER.filter(isMetricActive);
}

function isMetricActive(metric) {
  return settings.metrics[metric] !== false;
}

function hasActiveMetric(metrics) {
  return METRIC_ORDER.some((metric) => metrics[metric] !== false);
}

function getMetricShortLabel(metric) {
  if (metric === "pressure") return "Presion";
  if (metric === "temperature") return "Temp.";
  return "Oxig.";
}

function formatMetricValue(metric, record) {
  if (metric === "pressure") return formatPressure(record);
  if (metric === "temperature") return isTemperatureValid(record) ? `${formatDecimal(record.temperature)} C` : "Sin datos";
  return isOxygenValid(record) ? `${record.oxygen}%` : "Sin datos";
}

function isPressureValid(record) {
  return isInRange(record.systolic, 4, 26) && isInRange(record.diastolic, 3, 18);
}

function isTemperatureValid(record) {
  return isInRange(record.temperature, 30, 45);
}

function isOxygenValid(record) {
  return isInRange(record.oxygen, 50, 100);
}

function isInRange(value, min, max) {
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max;
}

function toInputDateTime(date) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
}

function todayStamp() {
  return new Date().toISOString().slice(0, 10);
}

function parseDecimal(value) {
  const text = String(value).trim().replace(",", ".");
  return text ? Number(text) : NaN;
}

function normalizeDecimalInput(input) {
  const parsed = parseDecimal(input.value);
  if (Number.isFinite(parsed)) {
    input.value = formatDecimal(parsed);
  }
}

function roundOne(value) {
  return Math.round(Number(value) * 10) / 10;
}

function formatDecimal(value) {
  return Number(value).toFixed(1);
}

function formatInputDecimal(value) {
  return Number.isFinite(Number(value)) ? formatDecimal(value) : "";
}

function formatExportDecimal(value) {
  return Number.isFinite(Number(value)) ? Number(value).toFixed(1) : "";
}

function formatPressure(record) {
  return isPressureValid(record) ? `${formatDecimal(record.systolic)}/${formatDecimal(record.diastolic)}` : "Sin datos";
}

function createId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(showToast.timeoutId);
  showToast.timeoutId = window.setTimeout(() => {
    toast.classList.remove("is-visible");
  }, 2400);
}
