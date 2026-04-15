const exportFirebaseConfig = {
  apiKey: "AIzaSyAQYjOF9YuB5D9LowTyGDP4JbG8cdWBJ88",
  authDomain: "employeeapp-c948f.firebaseapp.com",
  databaseURL: "https://employeeapp-c948f-default-rtdb.firebaseio.com",
  projectId: "employeeapp-c948f",
  storageBucket: "employeeapp-c948f.appspot.com",
  messagingSenderId: "546940583535",
  appId: "1:546940583535:web:3b930ca9f7646d9fe2979a",
};
if (!firebase.apps.length) firebase.initializeApp(exportFirebaseConfig);
const exportDb = firebase.database();

function decodeMaybe(v) { if (!v) return ""; try { return decodeURIComponent(escape(atob(v))); } catch (e) { return v; } }
function toDate(v) { const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d; }
function dateKey(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function monthKey(d) { return dateKey(d).slice(0, 7); }
function dateOnly(v) { const d = toDate(`${v}T00:00:00`); return d; }
function clock(v) { const d = toDate(v); return d ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""; }
function dateTime(v) { const d = toDate(v); return d ? d.toLocaleString() : "-"; }
function daysBetween(a, b) { const s = dateOnly(a), e = dateOnly(b); return s && e ? Math.floor((e - s) / 86400000) + 1 : 0; }
function workedHours(a, b) { return (new Date(b) - new Date(a)) / 3600000; }

function groupAttendance(records) {
  const map = {};
  records.forEach((r) => {
    if (!r || !r.id || !r.time) return;
    const d = toDate(r.time);
    if (!d) return;
    const key = `${r.id}|${dateKey(d)}`;
    if (!map[key]) {
      map[key] = { id: r.id, name: r.name || "", date: dateKey(d), punchIn: "", punchInRaw: "", punchInLocation: "", punchInLocationName: "", punchOut: "", punchOutRaw: "", punchOutLocation: "", punchOutLocationName: "", hoursWorked: "", wfh: false, reason: "", rowType: "attendance" };
    }
    const row = map[key];
    row.name = row.name || r.name || "";
    row.wfh = row.wfh || !!r.wfh;
    if (r.action === "Punch In" && (!row.punchInRaw || new Date(r.time) < new Date(row.punchInRaw))) {
      row.punchInRaw = r.time; row.punchIn = clock(r.time); row.punchInLocation = r.location || ""; row.punchInLocationName = r.locationName || "";
    }
    if (r.action === "Punch Out" && (!row.punchOutRaw || new Date(r.time) > new Date(row.punchOutRaw))) {
      row.punchOutRaw = r.time; row.punchOut = clock(r.time); row.punchOutLocation = r.location || ""; row.punchOutLocationName = r.locationName || ""; row.reason = r.reason || row.reason || "";
    }
  });
  return Object.values(map).map((row) => {
    if (row.punchInRaw && row.punchOutRaw) {
      const hrs = workedHours(row.punchInRaw, row.punchOutRaw);
      row.hoursWorked = hrs > 0 ? hrs.toFixed(2) : "";
    }
    return row;
  }).sort((a, b) => new Date(b.date) - new Date(a.date));
}

function rowStatus(row) {
  if (row.rowType === "leave") return "Leave";
  if (row.punchIn && row.punchOut) return parseFloat(row.hoursWorked || "0") >= 8 ? "Present" : "Half Day";
  if (row.punchIn) return "Active";
  return "Pending";
}

$(document).ready(function () {
  const state = { employees: {}, employeesLoaded: false, attendance: [], leaves: [], pending: [], session: null, showAll: false, filters: { employeeId: "", month: "" } };

  function isAdmin() { return window.IndzoneAuth.isAdminSession(state.session); }
  function employeeId() { return window.IndzoneAuth.isEmployeeSession(state.session) ? state.session.employeeId : ""; }
  function employee() { return state.employees[employeeId()] || null; }
  function showAuth() { $("#portalAuthGate").show(); $("#dashboardShell").hide(); }
  function showDash() { $("#portalAuthGate").hide(); $("#dashboardShell").show(); }
  function setMode(admin) {
    document.querySelectorAll(".admin-only").forEach((n) => { n.style.display = admin ? "" : "none"; });
    document.querySelectorAll(".employee-only").forEach((n) => { n.style.display = admin ? "none" : ""; });
    $("#leaveForm").css("display", admin ? "none" : "grid");
  }

  function visibleAttendance() {
    return state.attendance.filter((r) => {
      if (isAdmin()) {
        if (state.filters.employeeId && r.id !== state.filters.employeeId) return false;
        if (state.filters.month && String(r.time || "").slice(0, 7) !== state.filters.month) return false;
        return true;
      }
      return r.id === employeeId();
    });
  }

  function leaveRowsForEmployee() {
    return state.leaves.filter((l) => l.employeeId === employeeId() && l.status === "Accepted").flatMap((l) => {
      const rows = [];
      const start = dateOnly(l.fromDate), end = dateOnly(l.toDate);
      if (!start || !end) return rows;
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        rows.push({ id: employeeId(), name: employee()?.name || employeeId(), date: dateKey(d), punchIn: "", punchInLocation: "", punchInLocationName: "", punchOut: "", punchOutLocation: "", punchOutLocationName: "", hoursWorked: "", wfh: false, reason: l.reason || "", rowType: "leave" });
      }
      return rows;
    });
  }

  function visibleRows() {
    const rows = groupAttendance(visibleAttendance());
    if (isAdmin()) return rows;
    const existing = new Set(rows.map((r) => r.date));
    leaveRowsForEmployee().forEach((r) => { if (!existing.has(r.date)) rows.push(r); });
    return rows.sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  function graph($el, items) {
    const max = Math.max(...items.map((x) => x.value), 1);
    $el.html(items.map((x) => `<div class="graph-bar"><div class="graph-meta"><span>${x.label}</span><strong>${x.value}</strong></div><div class="graph-track"><div class="graph-fill ${x.color || ""}" style="width:${Math.max(x.value ? (x.value / max) * 100 : 0, x.value ? 10 : 0)}%"></div></div></div>`).join("") || "<p class='muted-text'>No data available.</p>");
  }

  function renderEmployeeSummary() {
    const mk = monthKey(new Date());
    const rows = groupAttendance(state.attendance.filter((r) => r.id === employeeId() && String(r.time || "").slice(0, 7) === mk));
    let present = 0, half = 0, hours = 0, leave = 0;
    rows.forEach((r) => { if (!r.hoursWorked) return; hours += parseFloat(r.hoursWorked); if (parseFloat(r.hoursWorked) >= 8) present += 1; else half += 1; });
    state.leaves.filter((l) => l.employeeId === employeeId() && l.status === "Accepted").forEach((l) => {
      const s = dateOnly(l.fromDate), e = dateOnly(l.toDate); if (!s || !e) return;
      for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) if (monthKey(d) === mk) leave += 1;
    });
    $("#employeeMetricPresent").text(present); $("#employeeMetricHalf").text(half); $("#employeeMetricLeave").text(leave); $("#employeeMetricHours").text(hours.toFixed(1));
    $("#employeeSummaryTitle").text(new Date(`${mk}-01T00:00:00`).toLocaleString([], { month: "long", year: "numeric" }));
    graph($("#employeeGraphBars"), [{ label: "Present days", value: present, color: "green" }, { label: "Half days", value: half, color: "amber" }, { label: "Leave days", value: leave, color: "red" }]);
  }

  function renderAdminSummary() {
    const today = dateKey(new Date());
    const todayRows = groupAttendance(state.attendance.filter((r) => dateKey(new Date(r.time)) === today));
    const present = todayRows.filter((r) => r.punchIn).length;
    const half = todayRows.filter((r) => r.punchIn && r.punchOut && parseFloat(r.hoursWorked || "0") < 8).length;
    const active = todayRows.filter((r) => r.punchIn && !r.punchOut).length;
    let leaveToday = 0;
    state.leaves.filter((l) => l.status === "Accepted").forEach((l) => { if (today >= l.fromDate && today <= l.toDate) leaveToday += 1; });
    $("#adminMetricEmployees").text(Object.keys(state.employees).length);
    $("#adminMetricPresent").text(present);
    $("#adminMetricPendingPunch").text(state.pending.filter((p) => p.status === "Pending").length);
    $("#adminMetricPendingLeaves").text(state.leaves.filter((l) => l.status === "Pending").length);
    graph($("#statusGraphBars"), [{ label: "Present today", value: present, color: "green" }, { label: "Half day today", value: half, color: "amber" }, { label: "Active shifts", value: active, color: "blue" }, { label: "On leave today", value: leaveToday, color: "red" }]);
    const insights = [
      `Pending punch-out approvals: ${state.pending.filter((p) => p.status === "Pending").length}`,
      `Pending leave requests: ${state.leaves.filter((l) => l.status === "Pending").length}`,
      state.filters.employeeId ? `Filtered employee: ${state.filters.employeeId}` : "Viewing all employees",
      `Current attendance rows: ${visibleRows().length}`,
    ];
    $("#adminInsightsList").html(insights.map((t) => `<div class="insight-item">${t}</div>`).join(""));
  }

  function renderAttendanceTable() {
    const rows = visibleRows();
    const $tbody = $("#attendanceRecords tbody"); $tbody.empty();
    $("#attendanceHeading").text(isAdmin() ? (state.filters.employeeId ? `Attendance records - ${state.filters.employeeId}` : "Attendance records - all employees") : "My attendance records");
    if (!rows.length) {
      $tbody.append('<tr><td colspan="12" style="text-align:center;color:#6b7b93;">No attendance records found.</td></tr>');
      $("#toggleAttendanceRows").hide(); return;
    }
    rows.forEach((r, i) => {
      const hidden = !state.showAll && i >= 10 ? ' style="display:none;"' : "";
      const wfh = r.wfh ? "<span class='success-badge'>WFH</span>" : "";
      $tbody.append(`<tr${hidden}><td data-label="Date">${r.date}</td><td data-label="Employee name">${r.name || r.id}</td><td data-label="Punch in time">${r.punchIn || ""}</td><td data-label="Punch in location">${r.rowType === "leave" ? "" : (r.punchInLocation || "")}</td><td data-label="Punch in location name">${r.rowType === "leave" ? "" : (r.punchInLocationName || "")}</td><td data-label="Punch out time">${r.punchOut || ""}</td><td data-label="Punch out location">${r.rowType === "leave" ? "" : (r.punchOutLocation || "")}</td><td data-label="Punch out location name">${r.rowType === "leave" ? "" : (r.punchOutLocationName || "")}</td><td data-label="Worked hours">${r.rowType === "leave" ? "" : (r.hoursWorked || "")}</td><td data-label="Status">${rowStatus(r)}</td><td data-label="WFH">${wfh}</td><td data-label="Reason">${r.reason || ""}</td></tr>`);
    });
    $("#toggleAttendanceRows").text(state.showAll ? "Show less" : "Show more").toggle(rows.length > 10);
  }

  function renderLeaveNotice() {
    if (isAdmin()) { $("#currentLeaveNotice").hide(); return; }
    const today = dateKey(new Date());
    const active = state.leaves.find((l) => l.employeeId === employeeId() && l.status === "Accepted" && today >= l.fromDate && today <= l.toDate);
    if (!active) { $("#currentLeaveNotice").hide(); return; }
    $("#currentLeaveNotice").text(`Approved leave: ${active.fromDate} to ${active.toDate} (${daysBetween(active.fromDate, active.toDate)} days)`).show();
  }

  function renderLeaveTable() {
    const leaves = (isAdmin() ? [...state.leaves] : state.leaves.filter((l) => l.employeeId === employeeId())).sort((a, b) => new Date(b.appliedAt || 0) - new Date(a.appliedAt || 0));
    const $tbody = $("#leaveRecords"); $tbody.empty();
    $("#leaveHeading").text(isAdmin() ? "Leave requests" : "My leave requests");
    if (!leaves.length) { $tbody.append('<tr><td colspan="8" style="text-align:center;color:#6b7b93;">No leave requests found.</td></tr>'); renderLeaveNotice(); return; }
    leaves.forEach((l) => {
      const action = isAdmin() ? `<select class="leave-status-dropdown" data-key="${l.key}"><option value="Pending"${l.status === "Pending" ? " selected" : ""}>Pending</option><option value="Accepted"${l.status === "Accepted" ? " selected" : ""}>Accepted</option><option value="Rejected"${l.status === "Rejected" ? " selected" : ""}>Rejected</option></select>` : `<span class="${l.status === "Accepted" ? "success-badge" : l.status === "Rejected" ? "warning-badge" : "info-pill"}">${l.status}</span>`;
      const proof = l.proofUrl ? `<a href="${l.proofUrl}" target="_blank" rel="noopener">View</a>` : "";
      $tbody.append(`<tr><td data-label="Employee ID">${l.employeeId}</td><td data-label="Employee name">${l.employeeName || state.employees[l.employeeId]?.name || l.employeeId}</td><td data-label="From">${l.fromDate || ""}</td><td data-label="To">${l.toDate || ""}</td><td data-label="Days">${daysBetween(l.fromDate, l.toDate)}</td><td data-label="Reason">${l.reason || ""}</td><td data-label="Document">${proof}</td><td data-label="Status / action">${action}</td></tr>`);
    });
    renderLeaveNotice();
  }

  function renderPendingPanels() {
    if (isAdmin()) {
      const pending = state.pending.filter((p) => p.status === "Pending");
      $("#myPunchOutPanel").hide();
      $("#pendingPunchOutPanel").show().html(pending.length ? `<div class="section-heading small"><span class="section-kicker">Approvals</span><h3>Pending early punch-out requests</h3></div><div class="table-responsive"><table><thead><tr><th>Employee ID</th><th>Name</th><th>Reason</th><th>Requested at</th><th>Action</th></tr></thead><tbody>${pending.map((p) => `<tr><td data-label="Employee ID">${p.id}</td><td data-label="Name">${p.name || p.id}</td><td data-label="Reason">${p.reason || ""}</td><td data-label="Requested at">${dateTime(p.time)}</td><td data-label="Action"><div class="btn-row"><button type="button" class="approve-btn" data-key="${p.key}">Approve</button><button type="button" class="reject-btn secondary-button" data-key="${p.key}">Reject</button></div></td></tr>`).join("")}</tbody></table></div>` : `<div class="section-heading small"><span class="section-kicker">Approvals</span><h3>Pending early punch-out requests</h3></div><p class="muted-text">No pending punch-out approvals right now.</p>`);
      return;
    }
    const mine = state.pending.filter((p) => p.id === employeeId()).sort((a, b) => new Date(b.requestedAt || b.time) - new Date(a.requestedAt || a.time));
    $("#pendingPunchOutPanel").hide();
    $("#myPunchOutPanel").show().html(mine.length ? `<div class="section-heading small"><span class="section-kicker">Requests</span><h3>My early punch-out requests</h3></div><div class="table-responsive"><table><thead><tr><th>Reason</th><th>Time</th><th>Status</th></tr></thead><tbody>${mine.map((p) => `<tr><td data-label="Reason">${p.reason || ""}</td><td data-label="Time">${dateTime(p.time)}</td><td data-label="Status">${p.status || "Pending"}</td></tr>`).join("")}</tbody></table></div>` : `<div class="section-heading small"><span class="section-kicker">Requests</span><h3>My early punch-out requests</h3></div><p class="muted-text">No early punch-out requests found.</p>`);
  }

  function renderProfile() {
    if (isAdmin() || !employee()) { $("#editProfileSection").hide(); return; }
    $("#editWhatsapp").val(decodeMaybe(employee().whatsapp || "")); $("#editEmail").val(decodeMaybe(employee().email || "")); $("#editProfileSection").show();
  }

  function renderFilters() {
    if (!isAdmin()) return;
    const selected = state.filters.employeeId;
    const options = ['<option value="">All employees</option>'].concat(Object.values(state.employees).sort((a, b) => String(a.id || "").localeCompare(String(b.id || ""))).map((e) => `<option value="${e.id}"${selected === e.id ? " selected" : ""}>${e.id} - ${e.name || e.id}</option>`)).join("");
    $("#adminEmployeeFilter").html(options); $("#adminMonthFilter").val(state.filters.month);
  }

  function render() {
    if (!state.session) { showAuth(); return; }
    if (!isAdmin() && !state.employeesLoaded) return;
    if (!isAdmin() && !employee()) { window.IndzoneAuth.clearSession(); state.session = null; showAuth(); return; }
    showDash(); setMode(isAdmin()); renderFilters();
    $("#dashboardRoleChip").text(isAdmin() ? "Admin" : "Employee");
    $("#dashboardTitle").text(isAdmin() ? "Attendance Admin Dashboard" : "My Attendance Dashboard");
    $("#dashboardSubtitle").text(isAdmin() ? "Use filters, approvals, exports, and leave actions from one place." : "Only your own attendance, leave requests, and profile are visible.");
    $("#userInfoBar").text(isAdmin() ? "Logged in as Admin" : `Employee ID: ${employee().id} | ${employee().name || employee().id}`).show();
    renderAttendanceTable(); renderLeaveTable(); renderPendingPanels(); renderProfile();
    if (isAdmin()) renderAdminSummary(); else renderEmployeeSummary();
  }

  async function saveMyPin() {
    if (!employee()) return;

    const newPin = String($("#changePinNew").val() || "").trim();
    const confirmPin = String($("#changePinConfirm").val() || "").trim();

    if (newPin.length < 4) {
      alert("PIN must be at least 4 characters long.");
      return false;
    }

    if (newPin !== confirmPin) {
      alert("PIN confirmation does not match.");
      return false;
    }

    const pinHash = await window.IndzoneAuth.createPinHash(newPin);
    const pinEncoded = window.IndzoneAuth.encodeStoredPin(newPin);

    await exportDb.ref(`employees/${employeeId()}`).update({
      pinHash,
      pinEncoded,
      pinUpdatedAt: new Date().toISOString(),
    });

    $("#pinUpdateSuccess").show();
    setTimeout(() => $("#pinUpdateSuccess").fadeOut(250), 1800);
    return true;
  }

  async function uploadProof(file) {
    const ref = firebase.storage().ref(`leaveProofs/${Date.now()}_${String(file.name).replace(/\s+/g, "_")}`);
    await ref.put(file); return ref.getDownloadURL();
  }

  function exportAttendance(rows, name) {
    const data = [["Date", "Employee ID", "Employee Name", "Punch In", "Punch In Location", "Punch In Location Name", "Punch Out", "Punch Out Location", "Punch Out Location Name", "Worked Hours", "Status", "WFH", "Reason"]].concat(rows.map((r) => [r.date, r.id || "", r.name || "", r.punchIn || "", r.punchInLocation || "", r.punchInLocationName || "", r.punchOut || "", r.punchOutLocation || "", r.punchOutLocationName || "", r.hoursWorked || "", rowStatus(r), r.wfh ? "Yes" : "No", r.reason || ""]));
    const ws = XLSX.utils.aoa_to_sheet(data), wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Attendance"); XLSX.writeFile(wb, name);
  }

  function exportLeave() {
    const data = [["Employee ID", "Employee Name", "From Date", "To Date", "Days", "Reason", "Document", "Status", "Applied At"]].concat(state.leaves.map((l) => [l.employeeId || "", l.employeeName || "", l.fromDate || "", l.toDate || "", daysBetween(l.fromDate, l.toDate), l.reason || "", l.proofUrl || "", l.status || "", l.appliedAt || ""]));
    const ws = XLSX.utils.aoa_to_sheet(data), wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Leave"); XLSX.writeFile(wb, "leave_data.xlsx");
  }

  $(".auth-tab").on("click", function () {
    const role = $(this).data("role"); $(".auth-tab").removeClass("active"); $(this).addClass("active");
    $("#employeePortalLoginForm").toggle(role === "employee"); $("#adminPortalLoginForm").toggle(role === "admin");
  });

  $("#employeePortalLoginForm").on("submit", async function (e) {
    e.preventDefault();
    const id = window.IndzoneAuth.normalizeEmployeeId($("#portalEmployeeId").val());
    const pin = $("#portalEmployeePin").val().trim();
    const result = await window.IndzoneAuth.verifyEmployeePin(state.employees[id], pin);
    if (!result.ok) { alert(result.reason === "pin_not_set" ? "Admin has not configured your access PIN yet." : "Invalid Employee ID or PIN."); return; }
    window.IndzoneAuth.setSession({ role: "employee", employeeId: id, name: state.employees[id].name || id }); $("#employeePortalLoginForm")[0].reset(); state.session = window.IndzoneAuth.getSession(); render();
  });

  $("#adminPortalLoginForm").on("submit", function (e) {
    e.preventDefault();
    if ($("#portalAdminPassword").val().trim() !== window.IndzoneAuth.ADMIN_PASSWORD) { alert("Incorrect admin password."); return; }
    window.IndzoneAuth.setSession({ role: "admin", employeeId: "ADMIN", name: "Admin" }); $("#adminPortalLoginForm")[0].reset(); state.session = window.IndzoneAuth.getSession(); render();
  });

  $("#logoutBtn").on("click", function () { window.IndzoneAuth.clearSession(); state.session = null; state.showAll = false; showAuth(); });
  $("#toggleAttendanceRows").on("click", function () { state.showAll = !state.showAll; renderAttendanceTable(); });
  $("#applyFiltersBtn").on("click", function () { state.filters.employeeId = $("#adminEmployeeFilter").val(); state.filters.month = $("#adminMonthFilter").val(); state.showAll = false; render(); });
  $("#clearFiltersBtn").on("click", function () { state.filters = { employeeId: "", month: "" }; state.showAll = false; render(); });
  $("#exportAllBtn").on("click", function () { if (isAdmin()) exportAttendance(groupAttendance(state.attendance), "attendance_all.xlsx"); });
  $("#exportFilterBtn").on("click", function () { exportAttendance(visibleRows(), "attendance_current_view.xlsx"); });
  $("#exportLeaveBtn").on("click", function () { if (isAdmin()) exportLeave(); });

  $("#leaveForm").on("submit", async function (e) {
    e.preventDefault();
    if (isAdmin() || !employee()) return;
    const fromDate = $("#leaveFrom").val(), toDate = $("#leaveTo").val(), reason = $("#leaveReason").val().trim(), file = $("#leaveProof")[0].files[0];
    if (!fromDate || !toDate || !reason) { alert("All leave fields are required."); return; }
    if (fromDate > toDate) { alert("From date must be before To date."); return; }
    const overlap = state.leaves.some((l) => l.employeeId === employeeId() && !(toDate < l.fromDate || fromDate > l.toDate));
    if (overlap) { alert("A leave request already exists for this date range."); return; }
    let proofUrl = ""; if (file) proofUrl = await uploadProof(file);
    await exportDb.ref("leaves").push({ employeeId: employeeId(), employeeName: employee().name || employeeId(), fromDate, toDate, reason, proofUrl, status: "Pending", appliedAt: new Date().toISOString() });
    $("#leaveForm")[0].reset(); alert("Leave request submitted.");
  });

  $("#editProfileForm").on("submit", async function (e) {
    e.preventDefault(); if (!employee()) return;
    await exportDb.ref(`employees/${employeeId()}`).update({ whatsapp: $("#editWhatsapp").val().trim(), email: $("#editEmail").val().trim() });
    $("#profileUpdateSuccess").show(); setTimeout(() => $("#profileUpdateSuccess").fadeOut(250), 1800);
  });
  $("#generateMyPinBtn").on("click", function () {
    const generatedPin = window.IndzoneAuth.generateNumericPin();
    $("#changePinNew").val(generatedPin);
    $("#changePinConfirm").val(generatedPin);
  });
  $("#changePinForm").on("submit", async function (e) {
    e.preventDefault();
    const ok = await saveMyPin();
    if (ok) this.reset();
  });

  $(document).on("change", ".leave-status-dropdown", function () { exportDb.ref(`leaves/${$(this).data("key")}/status`).set($(this).val()); });
  $(document).on("click", ".approve-btn", function () {
    const req = state.pending.find((p) => p.key === $(this).data("key")); if (!req) return;
    exportDb.ref("attendance").push({ id: req.id, name: req.name || req.id, action: "Punch Out", time: req.time, location: req.location || "", locationName: req.locationName || "", reason: req.reason || "", wfh: !!req.wfh, approvedBy: "admin", approvedAt: new Date().toISOString() }).then(() => exportDb.ref(`pending_punchout/${req.key}`).update({ status: "Approved", reviewedAt: new Date().toISOString() }));
  });
  $(document).on("click", ".reject-btn", function () { exportDb.ref(`pending_punchout/${$(this).data("key")}`).update({ status: "Rejected", reviewedAt: new Date().toISOString() }); });

  exportDb.ref("employees").on("value", (snap) => { state.employees = snap.val() || {}; state.employeesLoaded = true; state.session = window.IndzoneAuth.getSession(); render(); });
  exportDb.ref("attendance").on("value", (snap) => { state.attendance = Object.values(snap.val() || {}); render(); });
  exportDb.ref("leaves").on("value", (snap) => { state.leaves = Object.entries(snap.val() || {}).map(([key, value]) => ({ ...value, key })); render(); });
  exportDb.ref("pending_punchout").on("value", (snap) => { state.pending = Object.entries(snap.val() || {}).map(([key, value]) => ({ ...value, key, status: value.status || "Pending" })); render(); });

  state.session = window.IndzoneAuth.getSession();
  render();
});
