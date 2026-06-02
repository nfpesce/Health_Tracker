const STORAGE_KEY = "health-tracker-records-v1";
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

let records = loadRecords();
let chartRange = "all";

init();

function init() {
  const decimalInputs = [systolicInput, diastolicInput, temperatureInput];
  recordDateInput.value = toInputDateTime(new Date());
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

function handleSubmit(event) {
  event.preventDefault();
  const record = {
    id: recordIdInput.value || crypto.randomUUID(),
    date: new Date(recordDateInput.value).toISOString(),
    systolic: parseDecimal(systolicInput.value),
    diastolic: parseDecimal(diastolicInput.value),
    temperature: parseDecimal(temperatureInput.value),
    oxygen: Number(oxygenInput.value),
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
    record.systolic >= 4 &&
    record.systolic <= 26 &&
    record.diastolic >= 3 &&
    record.diastolic <= 18 &&
    record.temperature >= 30 &&
    record.temperature <= 45 &&
    record.oxygen >= 50 &&
    record.oxygen <= 100
  );
}

function loadRecords() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(stored) ? stored.map(normalizeRecord).filter(isValidRecord) : [];
  } catch {
    return [];
  }
}

function normalizeRecord(record) {
  const systolic = Number(record.systolic ?? record.sistolica);
  const diastolic = Number(record.diastolic ?? record.diastolica);
  return {
    ...record,
    systolic: systolic >= 40 ? roundOne(systolic / 10) : roundOne(systolic),
    diastolic: diastolic >= 30 ? roundOne(diastolic / 10) : roundOne(diastolic),
    temperature: Number(record.temperature ?? record.temperatura),
    oxygen: Number(record.oxygen ?? record.oxigenacion),
  };
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
  formMode.textContent = "Completa las mediciones del momento.";
}

function render() {
  records = sortRecords(records);
  renderSummary();
  renderTable();
  renderCharts();
}

function renderSummary() {
  const latest = records[0];
  document.querySelector("#recordCount").textContent = records.length.toString();
  document.querySelector("#latestPressure").textContent = latest ? formatPressure(latest) : "Sin datos";
  document.querySelector("#latestTemperature").textContent = latest ? `${formatDecimal(latest.temperature)} C` : "Sin datos";
  document.querySelector("#latestOxygen").textContent = latest ? `${latest.oxygen}%` : "Sin datos";
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
      <td>${formatPressure(record)}</td>
      <td>${formatDecimal(record.temperature)} C</td>
      <td>${record.oxygen}%</td>
      <td><span class="status ${status.level}">${status.label}</span></td>
      <td class="actions-cell">
        <div class="row-actions">
          <button type="button" data-action="edit" data-id="${record.id}">Editar</button>
          <button type="button" data-action="delete" data-id="${record.id}">Borrar</button>
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
        <div><span>Presion</span><strong>${formatPressure(record)}</strong></div>
        <div><span>Temp.</span><strong>${formatDecimal(record.temperature)} C</strong></div>
        <div><span>Oxig.</span><strong>${record.oxygen}%</strong></div>
      </div>
      <div class="record-card-actions">
        <button type="button" data-action="edit" data-id="${record.id}">Editar</button>
        <button type="button" data-action="delete" data-id="${record.id}">Borrar</button>
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

function editRecord(record) {
  recordIdInput.value = record.id;
  recordDateInput.value = toInputDateTime(new Date(record.date));
  systolicInput.value = formatDecimal(record.systolic);
  diastolicInput.value = formatDecimal(record.diastolic);
  temperatureInput.value = formatDecimal(record.temperature);
  oxygenInput.value = record.oxygen;
  notesInput.value = record.notes || "";
  cancelEditBtn.hidden = false;
  formMode.textContent = "Editando un registro existente.";
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
  const hasAlert = record.oxygen < 92 || record.temperature >= 38 || record.systolic >= 18 || record.diastolic >= 12;
  const hasWatch =
    record.oxygen < 95 ||
    record.temperature >= 37.5 ||
    record.systolic >= 14 ||
    record.diastolic >= 9 ||
    record.systolic < 9 ||
    record.diastolic < 6;

  if (hasAlert) return { level: "alert", label: "Alerta" };
  if (hasWatch) return { level: "watch", label: "Revisar" };
  return { level: "ok", label: "Estable" };
}

function renderCharts() {
  const ascending = getChartRecords();
  renderLineChart(document.querySelector("#pressureChart"), ascending, [
    { key: "systolic", label: "Sistolica", color: "#0b7a75", min: 8, max: 18 },
    { key: "diastolic", label: "Diastolica", color: "#b65f00", min: 8, max: 18 },
  ]);
  renderLineChart(document.querySelector("#temperatureChart"), ascending, [
    { key: "temperature", label: "Temperatura", color: "#b3261e", min: 34, max: 40 },
  ]);
  renderLineChart(document.querySelector("#oxygenChart"), ascending, [
    { key: "oxygen", label: "Oxigenacion", color: "#26734d", min: 95, max: 100 },
  ]);
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
  downloadFile(`registro-salud-${todayStamp()}.json`, "application/json", JSON.stringify(sortRecords(records), null, 2));
}

function exportCsv() {
  const headers = ["fecha", "sistolica", "diastolica", "temperatura", "oxigenacion", "notas"];
  const rows = sortRecords(records).map((record) => [
    record.date,
    formatExportDecimal(record.systolic),
    formatExportDecimal(record.diastolic),
    formatExportDecimal(record.temperature),
    record.oxygen,
    record.notes || "",
  ]);
  const csv = [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
  downloadFile(`registro-salud-${todayStamp()}.csv`, "text/csv", csv);
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

function toInputDateTime(date) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
}

function todayStamp() {
  return new Date().toISOString().slice(0, 10);
}

function parseDecimal(value) {
  return Number(String(value).trim().replace(",", "."));
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

function formatExportDecimal(value) {
  return Number(value).toFixed(1);
}

function formatPressure(record) {
  return `${formatDecimal(record.systolic)}/${formatDecimal(record.diastolic)}`;
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
