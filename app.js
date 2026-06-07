const API_URL = "/api/state";

const defaultState = {
  profile: {
    name: "",
    age: "",
    weight: ""
  },
  selectedDate: toDateInput(new Date()),
  appointments: [],
  settings: {
    notifications: {
      bottleEnabled: false,
      bottleMinutes: 180,
      diaperEnabled: false,
      diaperMinutes: 120,
      sentKeys: {}
    }
  },
  entries: []
};

const typeMeta = {
  bottle: { label: "Mamadera", color: "#6e3d80" },
  food: { label: "Comida", color: "#ff79bf" },
  diaper: { label: "Pa\u00f1al", color: "#bf53a0" },
  sleep: { label: "Siesta", color: "#353262" },
  care: { label: "Cuidado", color: "#ffaadb" }
};

const el = {
  syncStatus: document.querySelector("#syncStatus"),
  tabButtons: [...document.querySelectorAll(".tab-button")],
  viewPanels: [...document.querySelectorAll("[data-view-panel]")],
  profileForm: document.querySelector("#profileForm"),
  profileName: document.querySelector("#profileName"),
  profileAge: document.querySelector("#profileAge"),
  profileWeight: document.querySelector("#profileWeight"),
  profileAgeText: document.querySelector("#profileAgeText"),
  profileWeightText: document.querySelector("#profileWeightText"),
  todayLabel: document.querySelector("#todayLabel"),
  entryDate: document.querySelector("#entryDate"),
  entryTime: document.querySelector("#entryTime"),
  entryForm: document.querySelector("#entryForm"),
  editingId: document.querySelector("#editingId"),
  amountWrap: document.querySelector("#amountWrap"),
  amount: document.querySelector("#amount"),
  foodFields: document.querySelector("#foodFields"),
  foodName: document.querySelector("#foodName"),
  diaperFields: document.querySelector("#diaperFields"),
  diaperType: document.querySelector("#diaperType"),
  sleepFields: document.querySelector("#sleepFields"),
  sleepStart: document.querySelector("#sleepStart"),
  sleepEnd: document.querySelector("#sleepEnd"),
  careFields: document.querySelector("#careFields"),
  vitamin: document.querySelector("#vitamin"),
  bath: document.querySelector("#bath"),
  note: document.querySelector("#note"),
  saveButton: document.querySelector("#saveButton"),
  cancelEdit: document.querySelector("#cancelEdit"),
  timeline: document.querySelector("#timeline"),
  emptyState: document.querySelector("#emptyState"),
  bottleCount: document.querySelector("#bottleCount"),
  bottleTotal: document.querySelector("#bottleTotal"),
  foodCount: document.querySelector("#foodCount"),
  foodList: document.querySelector("#foodList"),
  diaperCount: document.querySelector("#diaperCount"),
  diaperMix: document.querySelector("#diaperMix"),
  sleepTotal: document.querySelector("#sleepTotal"),
  sleepCount: document.querySelector("#sleepCount"),
  careDone: document.querySelector("#careDone"),
  careList: document.querySelector("#careList"),
  prevDay: document.querySelector("#prevDay"),
  nextDay: document.querySelector("#nextDay"),
  todayButton: document.querySelector("#todayButton"),
  typeButtons: [...document.querySelectorAll(".type-button")],
  weekRange: document.querySelector("#weekRange"),
  weekStats: document.querySelector("#weekStats"),
  dayChart: document.querySelector("#dayChart"),
  weekChart: document.querySelector("#weekChart"),
  weekRows: document.querySelector("#weekRows"),
  monthRange: document.querySelector("#monthRange"),
  monthStats: document.querySelector("#monthStats"),
  monthChart: document.querySelector("#monthChart"),
  monthRows: document.querySelector("#monthRows"),
  appointmentForm: document.querySelector("#appointmentForm"),
  appointmentDate: document.querySelector("#appointmentDate"),
  appointmentTime: document.querySelector("#appointmentTime"),
  appointmentSpecialty: document.querySelector("#appointmentSpecialty"),
  prevAppointmentsMonth: document.querySelector("#prevAppointmentsMonth"),
  nextAppointmentsMonth: document.querySelector("#nextAppointmentsMonth"),
  appointmentsMonthLabel: document.querySelector("#appointmentsMonthLabel"),
  appointmentsCalendar: document.querySelector("#appointmentsCalendar"),
  appointmentsList: document.querySelector("#appointmentsList"),
  refreshData: document.querySelector("#refreshData"),
  exportData: document.querySelector("#exportData"),
  importData: document.querySelector("#importData"),
  alertsForm: document.querySelector("#alertsForm"),
  requestNotifications: document.querySelector("#requestNotifications"),
  bottleAlertEnabled: document.querySelector("#bottleAlertEnabled"),
  bottleAlertMinutes: document.querySelector("#bottleAlertMinutes"),
  nextBottleAt: document.querySelector("#nextBottleAt"),
  diaperAlertEnabled: document.querySelector("#diaperAlertEnabled"),
  diaperAlertMinutes: document.querySelector("#diaperAlertMinutes"),
  nextDiaperAt: document.querySelector("#nextDiaperAt"),
  notificationState: document.querySelector("#notificationState")
};

let state = clone(defaultState);
let activeType = "bottle";
let activeView = "log";
let appointmentsMonth = toLocalDate(defaultState.selectedDate);
let apiAvailable = false;
let saveTimer = null;

init();

async function init() {
  el.entryDate.value = state.selectedDate;
  el.entryTime.value = toTimeInput(new Date());
  el.appointmentDate.value = state.selectedDate;
  el.appointmentTime.value = toTimeInput(new Date());
  setActiveType(activeType);
  bindEvents();
  await loadSharedState();
  render();
  setInterval(checkNotifications, 60000);
  unregisterServiceWorker();
}

function bindEvents() {
  el.tabButtons.forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.view));
  });

  el.profileForm.addEventListener("submit", (event) => event.preventDefault());

  [el.profileName, el.profileAge, el.profileWeight].forEach((input) => {
    input.addEventListener("input", () => {
      updateProfileFromForm();
      renderProfile();
      queueSave();
    });
  });

  el.entryDate.addEventListener("change", async () => {
    state.selectedDate = el.entryDate.value;
    await persistState();
    render();
  });

  el.typeButtons.forEach((button) => {
    button.addEventListener("click", () => setActiveType(button.dataset.type));
  });

  el.entryForm.addEventListener("submit", handleSubmit);
  el.cancelEdit.addEventListener("click", resetForm);

  el.prevDay.addEventListener("click", () => shiftDay(-1));
  el.nextDay.addEventListener("click", () => shiftDay(1));
  el.todayButton.addEventListener("click", async () => {
    el.entryDate.value = toDateInput(new Date());
    state.selectedDate = el.entryDate.value;
    await persistState();
    render();
  });

  el.refreshData.addEventListener("click", async () => {
    await loadSharedState();
    render();
  });
  el.exportData.addEventListener("click", exportData);
  el.importData.addEventListener("change", importData);

  el.requestNotifications.addEventListener("click", requestNotificationPermission);
  el.alertsForm.addEventListener("input", () => {
    updateNotificationSettingsFromForm();
    renderAlerts();
    queueSave();
  });

  el.appointmentForm.addEventListener("submit", handleAppointmentSubmit);
  el.prevAppointmentsMonth.addEventListener("click", () => shiftAppointmentsMonth(-1));
  el.nextAppointmentsMonth.addEventListener("click", () => shiftAppointmentsMonth(1));
}

function setView(view) {
  activeView = view;
  el.tabButtons.forEach((button) => button.classList.toggle("active", button.dataset.view === view));
  el.viewPanels.forEach((panel) => panel.classList.toggle("active", panel.dataset.viewPanel === view));
  render();
}

async function loadSharedState() {
  setStatus("Conectando");
  try {
    const response = await fetch(API_URL, { cache: "no-store" });
    if (!response.ok) throw new Error("No se pudo leer la DB");
    state = normalizeState(await response.json());
    appointmentsMonth = toLocalDate(state.selectedDate);
    apiAvailable = true;
    setStatus("DB conectada");
  } catch {
    state = normalizeState(defaultState);
    appointmentsMonth = toLocalDate(state.selectedDate);
    apiAvailable = false;
    setStatus("Sin DB");
  }
}

async function persistState() {
  state = normalizeState(state);

  try {
    const response = await fetch(API_URL, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state)
    });
    if (!response.ok) throw new Error("No se pudo guardar");
    state = normalizeState(await response.json());
    apiAvailable = true;
    setStatus("DB guardada");
  } catch {
    apiAvailable = false;
    setStatus("Sin DB");
  }
}

function queueSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    persistState();
  }, 350);
}

async function handleSubmit(event) {
  event.preventDefault();

  const entry = buildEntry();
  if (!entry) return;

  const editingId = el.editingId.value;
  if (editingId) {
    state.entries = state.entries.map((item) => item.id === editingId ? { ...entry, id: editingId } : item);
  } else {
    state.entries.push({ ...entry, id: makeId() });
  }

  state.selectedDate = el.entryDate.value;
  await persistState();
  resetForm();
  render();
  checkNotifications();
}

function buildEntry() {
  const date = el.entryDate.value;
  const note = el.note.value.trim();
  const time = activeType === "sleep" ? (el.sleepStart.value || el.entryTime.value) : el.entryTime.value;

  if (!date || !time) return null;

  const base = { type: activeType, date, time: normalizeTime(time), note };

  if (activeType === "bottle") {
    return { ...base, amount: Number(el.amount.value || 0) };
  }

  if (activeType === "food") {
    return { ...base, foodName: el.foodName.value.trim() };
  }

  if (activeType === "diaper") {
    return { ...base, diaperType: el.diaperType.value };
  }

  if (activeType === "sleep") {
    const start = normalizeTime(el.sleepStart.value || el.entryTime.value);
    const end = normalizeTime(el.sleepEnd.value);
    return { ...base, time: start, start, end, minutes: calculateSleepMinutes(start, end) };
  }

  return { ...base, vitamin: el.vitamin.checked, bath: el.bath.checked };
}

function setActiveType(type) {
  activeType = type;
  el.typeButtons.forEach((button) => {
    const active = button.dataset.type === type;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });

  el.amountWrap.classList.toggle("hidden", type !== "bottle");
  el.foodFields.classList.toggle("hidden", type !== "food");
  el.diaperFields.classList.toggle("hidden", type !== "diaper");
  el.sleepFields.classList.toggle("hidden", type !== "sleep");
  el.careFields.classList.toggle("hidden", type !== "care");
  el.entryTime.closest("label").classList.toggle("hidden", type === "sleep");
}

function render() {
  state.selectedDate = el.entryDate.value || state.selectedDate;
  el.entryDate.value = state.selectedDate;
  el.todayLabel.textContent = formatLongDate(el.entryDate.value);
  renderProfile();
  renderSummary();
  renderTimeline();
  renderWeekDashboard();
  renderMonthDashboard();
  renderAppointments();
  renderAlerts();
}

function renderProfile() {
  el.profileName.value = state.profile.name || "";
  el.profileAge.value = state.profile.age || "";
  el.profileWeight.value = state.profile.weight || "";
  el.profileAgeText.textContent = `Edad: ${state.profile.age || "-"}`;
  el.profileWeightText.textContent = `Peso: ${state.profile.weight || "-"}`;

}

function renderSummary() {
  const entries = entriesForSelectedDay();
  const summary = summarizeEntries(entries);
  el.bottleCount.textContent = summary.bottles;
  el.bottleTotal.textContent = `${summary.ml} ml`;
  el.foodCount.textContent = summary.foods;
  el.foodList.textContent = entries.filter((item) => item.type === "food").map((item) => item.foodName).filter(Boolean).slice(0, 3).join(", ") || "-";
  el.diaperCount.textContent = summary.diapers;
  el.diaperMix.textContent = diaperSummary(entries) || "-";
  el.sleepTotal.textContent = formatDuration(summary.sleep);
  el.sleepCount.textContent = `${summary.naps} siestas`;
  el.careDone.textContent = `${summary.careDone}/2`;
  el.careList.textContent = summary.careList || "-";
  el.dayChart.innerHTML = renderTypeChart(entries);
}

function renderTimeline() {
  const entries = entriesForSelectedDay().sort((a, b) => a.time.localeCompare(b.time));
  el.timeline.innerHTML = "";
  el.emptyState.classList.toggle("hidden", entries.length > 0);

  entries.forEach((entry) => {
    const item = document.createElement("li");
    item.className = "timeline-item";
    item.innerHTML = `
      <span class="time-chip">${escapeHtml(formatTime(entry.time))}</span>
      <div>
        <div class="entry-title">${escapeHtml(entryTitle(entry))}</div>
        <div class="entry-detail">${escapeHtml(entryDetail(entry))}</div>
      </div>
      <div class="item-actions">
        <button type="button" data-action="edit" data-id="${escapeHtml(entry.id)}" aria-label="Editar">E</button>
        <button type="button" data-action="delete" data-id="${escapeHtml(entry.id)}" aria-label="Eliminar">X</button>
      </div>
    `;
    item.style.borderLeft = `5px solid ${typeMeta[entry.type]?.color || "#bf53a0"}`;
    el.timeline.appendChild(item);
  });

  el.timeline.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      const entry = state.entries.find((item) => item.id === button.dataset.id);
      if (!entry) return;
      if (button.dataset.action === "edit") editEntry(entry);
      if (button.dataset.action === "delete") deleteEntry(entry.id);
    });
  });
}

function renderWeekDashboard() {
  const selected = toLocalDate(el.entryDate.value);
  const start = startOfWeek(selected);
  const days = Array.from({ length: 7 }, (_, index) => addDays(start, index));
  const rows = days.map((date) => buildPeriodRow(toDateInput(date)));
  el.weekRange.textContent = `${formatShortDate(toDateInput(days[0]))} - ${formatShortDate(toDateInput(days[6]))}`;
  el.weekStats.innerHTML = renderAggregateCards(rows.flatMap((row) => row.entries));
  el.weekChart.innerHTML = renderPeriodChart(rows);
  el.weekRows.innerHTML = renderPeriodRows(rows);
  bindPeriodButtons(el.weekChart);
  bindPeriodButtons(el.weekRows);
}

function renderMonthDashboard() {
  const selected = toLocalDate(el.entryDate.value);
  const first = new Date(selected.getFullYear(), selected.getMonth(), 1);
  const last = new Date(selected.getFullYear(), selected.getMonth() + 1, 0);
  const days = [];
  for (let date = first; date <= last; date = addDays(date, 1)) {
    days.push(new Date(date));
  }
  const rows = days.map((date) => buildPeriodRow(toDateInput(date))).filter((row) => row.entries.length > 0);
  el.monthRange.textContent = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" }).format(selected);
  el.monthStats.innerHTML = renderAggregateCards(rows.flatMap((row) => row.entries));
  el.monthChart.innerHTML = rows.length ? renderPeriodChart(rows) : "";
  el.monthRows.innerHTML = rows.length ? renderPeriodRows(rows) : `<div class="empty-state"><strong>Sin registros</strong><span>No hay datos cargados en este mes.</span></div>`;
  bindPeriodButtons(el.monthChart);
  bindPeriodButtons(el.monthRows);
}

function buildPeriodRow(key) {
  const entries = state.entries.filter((item) => item.date === key);
  const summary = summarizeEntries(entries);
  return { key, entries, summary };
}

function renderAggregateCards(entries) {
  const summary = summarizeEntries(entries);
  return `
    <article class="stat-card"><span>Mamaderas</span><strong>${summary.bottles}</strong><small>${summary.ml} ml</small></article>
    <article class="stat-card"><span>Comidas</span><strong>${summary.foods}</strong><small>${summary.foods} registros</small></article>
    <article class="stat-card"><span>Pa&ntilde;ales</span><strong>${summary.diapers}</strong><small>${diaperSummary(entries) || "-"}</small></article>
    <article class="stat-card"><span>Sue&ntilde;o</span><strong>${formatDuration(summary.sleep)}</strong><small>${summary.naps} siestas</small></article>
    <article class="stat-card"><span>Cuidado</span><strong>${summary.careEvents}</strong><small>${summary.careEvents} registros</small></article>
  `;
}

function renderTypeChart(entries) {
  const summary = summarizeEntries(entries);
  const items = [
    { label: "Mamaderas", value: summary.bottles, detail: `${summary.ml} ml`, color: typeMeta.bottle.color },
    { label: "Comidas", value: summary.foods, detail: `${summary.foods} registros`, color: typeMeta.food.color },
    { label: "Panales", value: summary.diapers, detail: diaperSummary(entries) || "0 registros", color: typeMeta.diaper.color },
    { label: "Sue&ntilde;o", value: Math.round(summary.sleep / 60 * 10) / 10, detail: formatDuration(summary.sleep), color: typeMeta.sleep.color },
    { label: "Cuidado", value: summary.careEvents, detail: `${summary.careEvents} registros`, color: typeMeta.care.color }
  ];
  const max = Math.max(1, ...items.map((item) => Number(item.value) || 0));
  return `
    <h3>Gr&aacute;fico del d&iacute;a</h3>
    <div class="chart-bars">
      ${items.map((item) => `
        <div class="chart-row">
          <span>${item.label}</span>
          <div class="chart-track"><i style="--w: ${((Number(item.value) || 0) / max) * 100}%; --bar: ${item.color}"></i></div>
          <strong>${item.detail}</strong>
        </div>
      `).join("")}
    </div>
  `;
}

function renderPeriodChart(rows) {
  const max = Math.max(1, ...rows.map((row) => row.entries.length));
  return `
    <h3>Registros por dia</h3>
    <div class="period-chart">
      ${rows.map((row) => `
        <button type="button" class="period-bar" data-date="${row.key}" title="${row.entries.length} registros">
          <i style="--h: ${(row.entries.length / max) * 100}%"></i>
          <span>${formatShortDate(row.key)}</span>
        </button>
      `).join("")}
    </div>
  `;
}

function renderPeriodRows(rows) {
  const maxEntries = Math.max(1, ...rows.map((row) => row.entries.length));
  return rows.map((row) => `
    <article class="history-row">
      <strong>${formatShortDate(row.key)}</strong>
      <div class="history-bars">
        <div class="history-bar"><span style="--w: ${(row.entries.length / maxEntries) * 100}%"></span></div>
        <small>${row.entries.length} registros | ${row.summary.ml} ml | ${row.summary.foods} comidas | ${formatDuration(row.summary.sleep)}</small>
      </div>
      <button class="small-button" type="button" data-date="${row.key}">Ver</button>
    </article>
  `).join("");
}

function bindPeriodButtons(container) {
  container.querySelectorAll("button[data-date]").forEach((button) => {
    button.addEventListener("click", async () => {
      el.entryDate.value = button.dataset.date;
      state.selectedDate = el.entryDate.value;
      await persistState();
      setView("day");
    });
  });
}

function summarizeEntries(entries) {
  const bottles = entries.filter((item) => item.type === "bottle");
  const foods = entries.filter((item) => item.type === "food");
  const diapers = entries.filter((item) => item.type === "diaper");
  const sleeps = entries.filter((item) => item.type === "sleep");
  const care = entries.filter((item) => item.type === "care");
  const vitamin = care.some((item) => item.vitamin);
  const bath = care.some((item) => item.bath);

  return {
    bottles: bottles.length,
    ml: bottles.reduce((sum, item) => sum + Number(item.amount || 0), 0),
    foods: foods.length,
    diapers: diapers.length,
    sleep: sleeps.reduce((sum, item) => sum + Number(item.minutes || 0), 0),
    naps: sleeps.length,
    careEvents: care.length,
    careDone: Number(vitamin) + Number(bath),
    careList: [vitamin && "vitamina", bath && "bano"].filter(Boolean).join(", ")
  };
}

function diaperSummary(entries) {
  const diaperGroups = groupCount(entries.filter((item) => item.type === "diaper"), "diaperType");
  return Object.entries(diaperGroups).map(([key, count]) => `${count} ${key}`).join(", ");
}

function renderAlerts() {
  const settings = state.settings.notifications;
  el.bottleAlertEnabled.checked = settings.bottleEnabled;
  el.bottleAlertMinutes.value = settings.bottleMinutes;
  el.diaperAlertEnabled.checked = settings.diaperEnabled;
  el.diaperAlertMinutes.value = settings.diaperMinutes;
  el.nextBottleAt.value = nextAlertLabel("bottle", settings.bottleMinutes);
  el.nextDiaperAt.value = nextAlertLabel("diaper", settings.diaperMinutes);
  updateNotificationState();
}

function updateNotificationSettingsFromForm() {
  const settings = state.settings.notifications;
  settings.bottleEnabled = el.bottleAlertEnabled.checked;
  settings.bottleMinutes = clampNumber(el.bottleAlertMinutes.value, 10, 600, 180);
  settings.diaperEnabled = el.diaperAlertEnabled.checked;
  settings.diaperMinutes = clampNumber(el.diaperAlertMinutes.value, 10, 600, 120);
}

async function requestNotificationPermission() {
  if (!("Notification" in window)) {
    el.notificationState.textContent = "Este navegador no permite notificaciones.";
    return;
  }
  const permission = await Notification.requestPermission();
  updateNotificationState(permission);
}

function updateNotificationState(permission = notificationPermission()) {
  if (!("Notification" in window)) {
    el.notificationState.textContent = "Notificaciones no disponibles.";
    return;
  }
  if (permission === "granted") {
    el.notificationState.textContent = "Notificaciones activas.";
  } else if (permission === "denied") {
    el.notificationState.textContent = "Permiso bloqueado por el navegador.";
  } else {
    el.notificationState.textContent = "Permiso pendiente.";
  }
}

function checkNotifications() {
  if (!state.settings?.notifications) return;
  const settings = state.settings.notifications;
  if (settings.bottleEnabled) maybeNotify("bottle", settings.bottleMinutes, "Toca mamadera", "Ya se cumplio el tiempo configurado desde la ultima mamadera.");
  if (settings.diaperEnabled) maybeNotify("diaper", settings.diaperMinutes, "Revisar pa\u00f1al", "Ya se cumplio el tiempo configurado desde el ultimo pa\u00f1al.");
  renderAlerts();
}

function maybeNotify(type, minutes, title, body) {
  const latest = latestEntry(type);
  if (!latest) return;

  const nextAt = addMinutes(entryDateTime(latest), minutes);
  if (Date.now() < nextAt.getTime()) return;

  const key = `${type}-${latest.id}-${minutes}`;
  const sentKeys = state.settings.notifications.sentKeys;
  if (sentKeys[key]) return;

  sentKeys[key] = new Date().toISOString();
  persistState();

  if (notificationPermission() === "granted") {
    new Notification(title, { body });
  } else {
    el.notificationState.textContent = `${title}: ${body}`;
  }
}

function nextAlertLabel(type, minutes) {
  const latest = latestEntry(type);
  if (!latest) return "Sin registros";
  return formatDateTime(addMinutes(entryDateTime(latest), minutes));
}

function latestEntry(type) {
  return state.entries
    .filter((item) => item.type === type)
    .sort((a, b) => entryDateTime(b).getTime() - entryDateTime(a).getTime())[0];
}

async function handleAppointmentSubmit(event) {
  event.preventDefault();
  const appointment = {
    id: makeId(),
    date: el.appointmentDate.value,
    time: normalizeTime(el.appointmentTime.value),
    specialty: el.appointmentSpecialty.value.trim()
  };

  if (!appointment.date || !appointment.time || !appointment.specialty) return;

  state.appointments.push(appointment);
  appointmentsMonth = toLocalDate(appointment.date);
  await persistState();
  el.appointmentForm.reset();
  el.appointmentDate.value = appointment.date;
  el.appointmentTime.value = toTimeInput(new Date());
  renderAppointments();
}

function renderAppointments() {
  const selected = new Date(appointmentsMonth.getFullYear(), appointmentsMonth.getMonth(), 1);
  el.appointmentsMonthLabel.textContent = new Intl.DateTimeFormat("es-AR", {
    month: "long",
    year: "numeric"
  }).format(selected);

  el.appointmentsCalendar.innerHTML = renderAppointmentsCalendar(selected);
  el.appointmentsList.innerHTML = renderAppointmentsList();

  el.appointmentsCalendar.querySelectorAll("button[data-date]").forEach((button) => {
    button.addEventListener("click", () => {
      el.appointmentDate.value = button.dataset.date;
    });
  });

  el.appointmentsList.querySelectorAll("button[data-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      state.appointments = state.appointments.filter((appointment) => appointment.id !== button.dataset.id);
      await persistState();
      renderAppointments();
    });
  });
}

function renderAppointmentsCalendar(monthDate) {
  const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const last = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
  const startOffset = (first.getDay() + 6) % 7;
  const cells = [];

  for (let index = 0; index < startOffset; index += 1) {
    cells.push(`<div class="calendar-cell muted"></div>`);
  }

  for (let day = 1; day <= last.getDate(); day += 1) {
    const date = new Date(monthDate.getFullYear(), monthDate.getMonth(), day);
    const key = toDateInput(date);
    const appointments = appointmentsForDate(key);
    cells.push(`
      <button type="button" class="calendar-cell${appointments.length ? " has-appointments" : ""}" data-date="${key}">
        <strong>${day}</strong>
        <span>${appointments.length ? `${appointments.length} turno${appointments.length > 1 ? "s" : ""}` : ""}</span>
      </button>
    `);
  }

  return `
    <div class="calendar-weekdays">
      <span>Lun</span><span>Mar</span><span>Mi&eacute;</span><span>Jue</span><span>Vie</span><span>Sab</span><span>Dom</span>
    </div>
    <div class="calendar-days">${cells.join("")}</div>
  `;
}

function renderAppointmentsList() {
  const now = new Date();
  const upcoming = state.appointments
    .filter((appointment) => appointmentDateTime(appointment).getTime() >= startOfDay(now).getTime())
    .sort((a, b) => appointmentDateTime(a).getTime() - appointmentDateTime(b).getTime());

  if (!upcoming.length) {
    return `<div class="empty-state"><strong>Sin turnos</strong><span>No hay turnos proximos cargados.</span></div>`;
  }

  return upcoming.map((appointment) => `
    <article class="appointment-item">
      <div>
        <strong>${escapeHtml(formatShortDate(appointment.date))} ${escapeHtml(formatTime(appointment.time))}</strong>
        <span>${escapeHtml(appointment.specialty)}</span>
      </div>
      <button type="button" class="small-button" data-id="${escapeHtml(appointment.id)}">Eliminar</button>
    </article>
  `).join("");
}

function shiftAppointmentsMonth(amount) {
  appointmentsMonth = new Date(appointmentsMonth.getFullYear(), appointmentsMonth.getMonth() + amount, 1);
  renderAppointments();
}

function appointmentsForDate(date) {
  return state.appointments.filter((appointment) => appointment.date === date);
}

function editEntry(entry) {
  setView("log");
  setActiveType(entry.type);
  el.editingId.value = entry.id;
  el.entryDate.value = entry.date;
  el.entryTime.value = entry.time;
  el.amount.value = entry.amount || "";
  el.foodName.value = entry.foodName || "";
  el.diaperType.value = entry.diaperType || "pis";
  el.sleepStart.value = entry.start || entry.time || "";
  el.sleepEnd.value = entry.end || "";
  el.vitamin.checked = Boolean(entry.vitamin);
  el.bath.checked = Boolean(entry.bath);
  el.note.value = entry.note || "";
  el.saveButton.textContent = "Actualizar";
  el.cancelEdit.classList.remove("hidden");
}

async function deleteEntry(id) {
  state.entries = state.entries.filter((item) => item.id !== id);
  await persistState();
  render();
}

function resetForm() {
  el.editingId.value = "";
  el.entryForm.reset();
  el.entryDate.value = state.selectedDate || toDateInput(new Date());
  el.entryTime.value = toTimeInput(new Date());
  el.saveButton.textContent = "Guardar";
  el.cancelEdit.classList.add("hidden");
  setActiveType(activeType);
}

function updateProfileFromForm() {
  state.profile.name = el.profileName.value.trim();
  state.profile.age = el.profileAge.value.trim();
  state.profile.weight = el.profileWeight.value.trim();
}

function entriesForSelectedDay() {
  return state.entries.filter((item) => item.date === el.entryDate.value);
}

function groupCount(items, key) {
  return items.reduce((groups, item) => {
    const group = item[key] || "-";
    groups[group] = (groups[group] || 0) + 1;
    return groups;
  }, {});
}

function calculateSleepMinutes(start, end) {
  if (!start || !end) return 0;
  const [startHour, startMinute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);
  let startTotal = startHour * 60 + startMinute;
  let endTotal = endHour * 60 + endMinute;
  if (endTotal < startTotal) endTotal += 24 * 60;
  return Math.max(0, endTotal - startTotal);
}

function entryTitle(entry) {
  if (entry.type === "bottle") return `Mamadera ${entry.amount || 0} ml`;
  if (entry.type === "food") return `Comida${entry.foodName ? `: ${entry.foodName}` : ""}`;
  if (entry.type === "diaper") return `Pa\u00f1al ${entry.diaperType || ""}`;
  if (entry.type === "sleep") return `Siesta ${formatDuration(entry.minutes || 0)}`;
  return [entry.vitamin && "Vitamina", entry.bath && "Bano"].filter(Boolean).join(" + ") || "Cuidado";
}

function entryDetail(entry) {
  const details = [];
  if (entry.type === "sleep" && entry.end) details.push(`${formatTime(entry.start)} a ${formatTime(entry.end)}`);
  details.push(typeMeta[entry.type]?.label || "Registro");
  if (entry.note) details.push(entry.note);
  return details.join(" | ");
}

async function shiftDay(amount) {
  const next = addDays(toLocalDate(el.entryDate.value), amount);
  el.entryDate.value = toDateInput(next);
  state.selectedDate = el.entryDate.value;
  await persistState();
  render();
}

function exportData() {
  const payload = JSON.stringify(state, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `dia-bebe-${toDateInput(new Date())}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function importData(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.addEventListener("load", async () => {
    try {
      state = normalizeState(JSON.parse(reader.result));
      el.entryDate.value = state.selectedDate;
      await persistState();
      render();
    } catch {
      alert("No se pudo importar el archivo.");
    } finally {
      event.target.value = "";
    }
  });
  reader.readAsText(file);
}

function normalizeState(value) {
  const profile = value?.profile || {};
  return {
    profile: {
      name: String(profile.name || value?.babyName || ""),
      age: String(profile.age || ""),
      weight: String(profile.weight || "")
    },
    selectedDate: String(value?.selectedDate || toDateInput(new Date())),
    appointments: Array.isArray(value?.appointments) ? value.appointments.map(normalizeAppointment) : [],
    settings: normalizeSettings(value?.settings),
    entries: Array.isArray(value?.entries) ? value.entries.map(normalizeEntry) : []
  };
}

function normalizeSettings(settings = {}) {
  const notifications = settings.notifications || {};
  return {
    notifications: {
      bottleEnabled: Boolean(notifications.bottleEnabled),
      bottleMinutes: clampNumber(notifications.bottleMinutes, 10, 600, 180),
      diaperEnabled: Boolean(notifications.diaperEnabled),
      diaperMinutes: clampNumber(notifications.diaperMinutes, 10, 600, 120),
      sentKeys: notifications.sentKeys && typeof notifications.sentKeys === "object" ? notifications.sentKeys : {}
    }
  };
}

function normalizeEntry(entry) {
  const type = entry.type || "bottle";
  return {
    ...entry,
    id: entry.id || makeId(),
    type,
    date: entry.date || toDateInput(new Date()),
    time: normalizeTime(entry.time || entry.start || toTimeInput(new Date()))
  };
}

function normalizeAppointment(appointment) {
  return {
    id: String(appointment.id || makeId()),
    date: String(appointment.date || toDateInput(new Date())),
    time: normalizeTime(appointment.time || "09:00"),
    specialty: String(appointment.specialty || "")
  };
}

function setStatus(text) {
  el.syncStatus.textContent = text;
  el.syncStatus.dataset.state = text;
}

function makeId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function notificationPermission() {
  return "Notification" in window ? Notification.permission : "denied";
}

function entryDateTime(entry) {
  const [year, month, day] = entry.date.split("-").map(Number);
  const [hour, minute] = normalizeTime(entry.time).split(":").map(Number);
  return new Date(year, month - 1, day, hour, minute);
}

function appointmentDateTime(appointment) {
  const [year, month, day] = appointment.date.split("-").map(Number);
  const [hour, minute] = normalizeTime(appointment.time).split(":").map(Number);
  return new Date(year, month - 1, day, hour, minute);
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60000);
}

function startOfWeek(date) {
  const start = new Date(date);
  const day = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - day);
  return start;
}

function toLocalDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function toDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toTimeInput(date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function normalizeTime(value) {
  if (!value) return "";
  const [hour = "00", minute = "00"] = String(value).split(":");
  return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
}

function formatTime(value) {
  return normalizeTime(value);
}

function formatDateTime(date) {
  return `${formatShortDate(toDateInput(date))} ${toTimeInput(date)}`;
}

function formatLongDate(value) {
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long"
  }).format(toLocalDate(value));
}

function formatShortDate(value) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit"
  }).format(toLocalDate(value));
}

function formatDuration(minutes) {
  if (!minutes) return "0 h";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (!hours) return `${mins} min`;
  if (!mins) return `${hours} h`;
  return `${hours} h ${mins} min`;
}

function unregisterServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.getRegistrations()
    .then((registrations) => registrations.forEach((registration) => registration.unregister()))
    .catch(() => {});
}
