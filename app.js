const STORAGE_KEY = "health-tracker-records-v1";
const DATE_FORMAT = new Intl.DateTimeFormat("es", {
  dateStyle: "medium",
  timeStyle: "short",
});

const form = document.querySelector("#healthForm");
const recordIdInput = document.querySelector("#recordId");
const recordDateInput = document.querySelector("#recordDate");
const systolicInput = document.querySelector("#systolic");
const diastolicInput = document.querySelector("#diastolic");
const temperatureInput = document.querySelector("#temperature");
const oxygenInput = document.querySelector("#oxygen");
const notesInput = document.querySelector("#notes");
const cancelEditBtn = document.querySelector("#cancelEditBtn");
const formMode = document.querySelector("#formMode");
const recordsBody = document.querySelector("#recordsBody");
const emptyState = document.querySelector("#emptyState");
const searchInput = document.querySelector("#searchInput");
const importFile = document.querySelector("#importFile");
const toast = document.querySelector("#toast");

let records = loadRecords();
let chartRange = "30";

init();

function init() {
  recordDateInput.value = toInputDateTime(new Date());
  form.addEventListener("submit", handleSubmit);
  cancelEditBtn.addEventListener("click", resetForm);
  searchInput.addEventListener("input", render);
  importFile.addEventListener("change", handleImport);
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
    systolic: Number(systolicInput.value),
    diastolic: Number(diastolicInput.value),
    temperature: Number(temperatureInput.value),
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
    record.systolic >= 40 &&
    record.systolic <= 260 &&
    record.diastolic >= 30 &&
    record.diastolic <= 180 &&
    record.temperature >= 30 &&
    record.temperature <= 45 &&
    record.oxygen >= 50 &&
    record.oxygen <= 100
  );
}

function loadRecords() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(stored) ? stored.filter(isValidRecord) : [];
  } catch {
    return [];
  }
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
  document.querySelector("#latestPressure").textContent = latest ? `${latest.systolic}/${latest.diastolic}` : "Sin datos";
  document.querySelector("#latestTemperature").textContent = latest ? `${formatNumber(latest.temperature)} C` : "Sin datos";
  document.querySelector("#latestOxygen").textContent = latest ? `${latest.oxygen}%` : "Sin datos";
}

function renderTable() {
  const query = searchInput.value.trim().toLowerCase();
  const visibleRecords = records.filter((record) => {
    const haystack = `${DATE_FORMAT.format(new Date(record.date))} ${record.notes}`.toLowerCase();
    return haystack.includes(query);
  });

  recordsBody.innerHTML = "";
  emptyState.hidden = visibleRecords.length > 0;

  visibleRecords.forEach((record) => {
    const tr = document.createElement("tr");
    const status = getStatus(record);
    tr.innerHTML = `
      <td>
        ${escapeHtml(DATE_FORMAT.format(new Date(record.date)))}
        ${record.notes ? `<span class="notes">${escapeHtml(record.notes)}</span>` : ""}
      </td>
      <td>${record.systolic}/${record.diastolic} mmHg</td>
      <td>${formatNumber(record.temperature)} C</td>
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
  });

  recordsBody.querySelectorAll("button").forEach((button) => {
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
  systolicInput.value = record.systolic;
  diastolicInput.value = record.diastolic;
  temperatureInput.value = record.temperature;
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
  const hasAlert = record.oxygen < 92 || record.temperature >= 38 || record.systolic >= 180 || record.diastolic >= 120;
  const hasWatch =
    record.oxygen < 95 ||
    record.temperature >= 37.5 ||
    record.systolic >= 140 ||
    record.diastolic >= 90 ||
    record.systolic < 90 ||
    record.diastolic < 60;

  if (hasAlert) return { level: "alert", label: "Alerta" };
  if (hasWatch) return { level: "watch", label: "Revisar" };
  return { level: "ok", label: "Estable" };
}

function renderCharts() {
  const ascending = getChartRecords();
  renderLineChart(document.querySelector("#pressureChart"), ascending, [
    { key: "systolic", label: "Sistolica", color: "#0b7a75", min: 70, max: 190 },
    { key: "diastolic", label: "Diastolica", color: "#b65f00", min: 40, max: 130 },
  ]);
  renderLineChart(document.querySelector("#vitalsChart"), ascending, [
    { key: "temperature", label: "Temperatura", color: "#b3261e", min: 34, max: 41 },
    { key: "oxygen", label: "Oxigenacion", color: "#26734d", min: 85, max: 100 },
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
  if (data.length === 0) {
    container.innerHTML = `<div class="empty-state">Sin datos para graficar.</div>`;
    return;
  }

  const width = 640;
  const height = 240;
  const pad = { top: 16, right: 20, bottom: 28, left: 42 };
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  const allValues = series.flatMap((item) => data.map((record) => record[item.key]));
  const configuredMin = Math.min(...series.map((item) => item.min));
  const configuredMax = Math.max(...series.map((item) => item.max));
  const min = Math.min(configuredMin, Math.floor(Math.min(...allValues) - 4));
  const max = Math.max(configuredMax, Math.ceil(Math.max(...allValues) + 4));
  const xStep = data.length > 1 ? plotWidth / (data.length - 1) : 0;

  const yFor = (value) => pad.top + ((max - value) / (max - min)) * plotHeight;
  const xFor = (index) => pad.left + index * xStep;
  const grid = [0, 0.25, 0.5, 0.75, 1]
    .map((ratio) => {
      const y = pad.top + ratio * plotHeight;
      const label = Math.round(max - ratio * (max - min));
      return `<line x1="${pad.left}" y1="${y}" x2="${width - pad.right}" y2="${y}" stroke="#d8e2de" />
        <text x="8" y="${y + 4}" fill="#65736d" font-size="11">${label}</text>`;
    })
    .join("");

  const paths = series
    .map((item) => {
      const points = data.map((record, index) => `${xFor(index)},${yFor(record[item.key])}`).join(" ");
      const dots = data
        .map(
          (record, index) =>
            `<circle cx="${xFor(index)}" cy="${yFor(record[item.key])}" r="3" fill="${item.color}">
              <title>${item.label}: ${record[item.key]} - ${DATE_FORMAT.format(new Date(record.date))}</title>
            </circle>`,
        )
        .join("");
      return `<polyline points="${points}" fill="none" stroke="${item.color}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" />${dots}`;
    })
    .join("");

  const firstDate = DATE_FORMAT.format(new Date(data[0].date));
  const lastDate = DATE_FORMAT.format(new Date(data[data.length - 1].date));
  const legend = series.map((item) => `<span style="color:${item.color}">${item.label}</span>`).join("");

  container.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">
      ${grid}
      <line x1="${pad.left}" y1="${height - pad.bottom}" x2="${width - pad.right}" y2="${height - pad.bottom}" stroke="#9aa8a2" />
      ${paths}
      <text x="${pad.left}" y="${height - 8}" fill="#65736d" font-size="11">${escapeHtml(firstDate)}</text>
      <text x="${width - pad.right}" y="${height - 8}" text-anchor="end" fill="#65736d" font-size="11">${escapeHtml(lastDate)}</text>
    </svg>
    <div class="legend">${legend}</div>
  `;
}

function exportJson() {
  downloadFile(`registro-salud-${todayStamp()}.json`, "application/json", JSON.stringify(sortRecords(records), null, 2));
}

function exportCsv() {
  const headers = ["fecha", "sistolica", "diastolica", "temperatura", "oxigenacion", "notas"];
  const rows = sortRecords(records).map((record) => [
    record.date,
    record.systolic,
    record.diastolic,
    record.temperature,
    record.oxygen,
    record.notes || "",
  ]);
  const csv = [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
  downloadFile(`registro-salud-${todayStamp()}.csv`, "text/csv", csv);
}

async function handleImport(event) {
  const file = event.target.files[0];
  if (!file) return;
  const text = await file.text();
  const imported = file.name.toLowerCase().endsWith(".csv") ? parseCsv(text) : parseJson(text);
  if (!imported.length) {
    showToast("No se encontraron registros validos.");
    importFile.value = "";
    return;
  }

  const byId = new Map(records.map((record) => [record.id, record]));
  imported.forEach((record) => byId.set(record.id, record));
  records = sortRecords([...byId.values()]);
  saveRecords();
  render();
  importFile.value = "";
  showToast(`Importados ${imported.length} registros.`);
}

function parseJson(text) {
  try {
    const parsed = JSON.parse(text);
    return normalizeImportedRecords(Array.isArray(parsed) ? parsed : []);
  } catch {
    return [];
  }
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const rows = lines.slice(1).map(parseCsvLine);
  return normalizeImportedRecords(
    rows.map(([date, systolic, diastolic, temperature, oxygen, notes]) => ({
      date,
      systolic,
      diastolic,
      temperature,
      oxygen,
      notes,
    })),
  );
}

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current);
  return values;
}

function normalizeImportedRecords(items) {
  return items
    .map((item) => {
      const parsedDate = new Date(item.date || item.fecha);
      return {
        id: item.id || crypto.randomUUID(),
        date: Number.isFinite(parsedDate.getTime()) ? parsedDate.toISOString() : "",
        systolic: Number(item.systolic || item.sistolica),
        diastolic: Number(item.diastolic || item.diastolica),
        temperature: Number(item.temperature || item.temperatura),
        oxygen: Number(item.oxygen || item.oxigenacion),
        notes: String(item.notes || item.notas || "").trim(),
      };
    })
    .filter(isValidRecord);
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

function formatNumber(value) {
  return Number(value).toLocaleString("es", { maximumFractionDigits: 1 });
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
