const attendanceFirebaseConfig = {
  apiKey: "AIzaSyAQYjOF9YuB5D9LowTyGDP4JbG8cdWBJ88",
  authDomain: "employeeapp-c948f.firebaseapp.com",
  databaseURL: "https://employeeapp-c948f-default-rtdb.firebaseio.com",
  projectId: "employeeapp-c948f",
  storageBucket: "employeeapp-c948f.appspot.com",
  messagingSenderId: "546940583535",
  appId: "1:546940583535:web:3b930ca9f7646d9fe2979a",
};

if (!firebase.apps.length) {
  firebase.initializeApp(attendanceFirebaseConfig);
}

const attendanceDb = firebase.database();

(function () {
  window.blockInspect = true;

  function showToast(message) {
    let toast = document.getElementById("inspectToast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "inspectToast";
      toast.style.position = "fixed";
      toast.style.bottom = "86px";
      toast.style.left = "50%";
      toast.style.transform = "translateX(-50%)";
      toast.style.background = "#1f2933";
      toast.style.color = "#fff";
      toast.style.padding = "10px 18px";
      toast.style.borderRadius = "12px";
      toast.style.fontSize = "14px";
      toast.style.zIndex = "99999";
      document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.style.display = "block";
    setTimeout(() => {
      toast.style.display = "none";
    }, 1500);
  }

  function blockContextMenu(event) {
    if (window.blockInspect) {
      event.preventDefault();
    }
  }

  function blockKeydown(event) {
    if (!window.blockInspect) return;

    if (
      event.keyCode === 123 ||
      (event.ctrlKey && event.shiftKey && [73, 74, 67, 75].includes(event.keyCode)) ||
      (event.ctrlKey && [85, 83, 80, 70].includes(event.keyCode))
    ) {
      event.preventDefault();
    }
  }

  document.addEventListener("contextmenu", blockContextMenu, true);
  document.addEventListener("keydown", blockKeydown, true);

  let unlock = false;
  document.addEventListener("keydown", function (event) {
    if (event.ctrlKey && !event.shiftKey && event.key === "1") {
      if (!unlock) {
        const code = prompt("Enter admin code to toggle inspect block:");
        if (code !== "indzone@123") {
          showToast("Wrong code");
          return;
        }
        unlock = true;
      }

      window.blockInspect = !window.blockInspect;
      showToast(window.blockInspect ? "Inspect Block: ON" : "Inspect Block: OFF");
    }
  });
})();

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatMonthKey(date) {
  return formatDateKey(date).slice(0, 7);
}

function formatClock(date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDateTime(dateValue) {
  const date = new Date(dateValue);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
}

function hoursBetween(start, end) {
  return (new Date(end) - new Date(start)) / (1000 * 60 * 60);
}

function formatDuration(milliseconds) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${hours}h ${minutes}m ${seconds}s`;
}

function getHolidayByLocalDate(dateKey) {
  if (typeof window.getHolidayByDate === "function") {
    return window.getHolidayByDate(dateKey);
  }
  return null;
}

$(document).ready(function () {
  const state = {
    attendance: [],
    employees: {},
    employeesLoaded: false,
    leaves: [],
    session: null,
    currentEmployee: null,
    workTimerInterval: null,
  };

  if (window.Notification && Notification.permission === "default") {
    Notification.requestPermission();
  }

  function setPunchStatus(message, tone = "info") {
    const colorMap = {
      info: "#003F8C",
      error: "#E70000",
      success: "#2f855a",
    };

    const $host = $("#punchStatusHost");
    $host.html(
      `<div class="info-banner" style="margin:0 0 14px; background:${tone === "info" ? "rgba(0,63,140,0.08)" : tone === "success" ? "rgba(47,133,90,0.12)" : "rgba(231,0,0,0.1)"}; color:${colorMap[tone]};">${message}</div>`
    );
  }

  function clearPunchStatus() {
    $("#punchStatusHost").empty();
  }

  function showAuthGate() {
    $("#authGate").show();
    $("#portalShell").hide();
  }

  function showPortal() {
    $("#authGate").hide();
    $("#portalShell").show();
  }

  function stopWorkTimer() {
    if (state.workTimerInterval) {
      clearInterval(state.workTimerInterval);
      state.workTimerInterval = null;
    }
    $("#activeSessionTimer").hide();
    $("#workTimer").text("00h 00m 00s");
  }

  function startWorkTimer(startTime) {
    stopWorkTimer();
    $("#activeSessionTimer").show();

    function render() {
      const diff = new Date() - new Date(startTime);
      $("#workTimer").text(formatDuration(diff));
    }

    render();
    state.workTimerInterval = setInterval(render, 1000);
  }

  function blinkPunchOutButton() {
    const button = document.getElementById("punchOutBtn");
    if (!button) return;
    button.classList.add("blink-punchout");
    setTimeout(() => button.classList.remove("blink-punchout"), 3200);
  }

  window.blinkPunchOutButton = blinkPunchOutButton;

  function getEmployeeRecords(employeeId) {
    return state.attendance
      .filter((record) => record.id === employeeId)
      .sort((left, right) => new Date(left.time) - new Date(right.time));
  }

  function getLastOpenShift(employeeId) {
    const records = getEmployeeRecords(employeeId);
    let lastPunchIn = null;
    let lastPunchOut = null;

    records.forEach((record) => {
      if (record.action === "Punch In") {
        lastPunchIn = record;
      }
      if (record.action === "Punch Out") {
        lastPunchOut = record;
      }
    });

    if (
      lastPunchIn &&
      (!lastPunchOut || new Date(lastPunchIn.time) > new Date(lastPunchOut.time))
    ) {
      return lastPunchIn;
    }

    return null;
  }

  function getTodayAttendanceStatus(employeeId) {
    const today = formatDateKey(new Date());
    const records = getEmployeeRecords(employeeId).filter(
      (record) => formatDateKey(new Date(record.time)) === today
    );

    const lastPunchIn = [...records].reverse().find((record) => record.action === "Punch In");
    const lastPunchOut = [...records].reverse().find((record) => record.action === "Punch Out");

    return { lastPunchIn, lastPunchOut };
  }

  function updatePunchButtons() {
    const employee = state.currentEmployee;
    if (!employee) {
      $("#punchInBtn, #punchOutBtn").prop("disabled", true);
      return;
    }

    const openShift = getLastOpenShift(employee.id);
    $("#punchInBtn").prop("disabled", !!openShift);
    $("#punchOutBtn").prop("disabled", !openShift);
  }

  function renderTodayBanner() {
    const holiday = getHolidayByLocalDate(formatDateKey(new Date()));
    const $host = $("#todayHolidayHost");

    if (!holiday) {
      $host.empty();
      return;
    }

    $host.html(`
      <div class="info-banner" style="margin-top:16px;">
        Today: ${holiday.name} (${holiday.type === "public" ? "Holiday" : "Festival"})
      </div>
    `);
  }

  function computeMonthlyStats(employeeId) {
    const monthKey = formatMonthKey(new Date());
    const grouped = {};

    getEmployeeRecords(employeeId).forEach((record) => {
      const recordMonth = formatMonthKey(new Date(record.time));
      if (recordMonth !== monthKey) return;

      const dayKey = formatDateKey(new Date(record.time));
      if (!grouped[dayKey]) {
        grouped[dayKey] = { punchIn: null, punchOut: null };
      }

      if (record.action === "Punch In" && !grouped[dayKey].punchIn) {
        grouped[dayKey].punchIn = record.time;
      }

      if (record.action === "Punch Out") {
        grouped[dayKey].punchOut = record.time;
      }
    });

    let presentDays = 0;
    let halfDays = 0;
    let hoursWorkedTotal = 0;
    const attendanceDates = new Set();

    Object.entries(grouped).forEach(([dayKey, dayRecord]) => {
      if (!dayRecord.punchIn || !dayRecord.punchOut) return;
      const workedHours = hoursBetween(dayRecord.punchIn, dayRecord.punchOut);
      if (workedHours <= 0) return;

      attendanceDates.add(dayKey);
      hoursWorkedTotal += workedHours;

      if (workedHours >= 8) {
        presentDays += 1;
      } else {
        halfDays += 1;
      }
    });

    const leaveDates = new Set();
    state.leaves
      .filter((leave) => leave.employeeId === employeeId && leave.status === "Accepted")
      .forEach((leave) => {
        const start = new Date(`${leave.fromDate}T00:00:00`);
        const end = new Date(`${leave.toDate}T00:00:00`);
        for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
          const key = formatDateKey(cursor);
          if (key.startsWith(monthKey)) {
            leaveDates.add(key);
          }
        }
      });

    if (Array.isArray(window.HOLIDAYS)) {
      window.HOLIDAYS.forEach((holiday) => {
        if (holiday.date && holiday.date.startsWith(monthKey)) {
          leaveDates.add(holiday.date);
        }
      });
    }

    let leaveDays = 0;
    leaveDates.forEach((dateKey) => {
      if (!attendanceDates.has(dateKey)) {
        leaveDays += 1;
      }
    });

    return {
      monthKey,
      presentDays,
      halfDays,
      leaveDays,
      hoursWorkedTotal: hoursWorkedTotal.toFixed(1),
    };
  }

  function updateDashboardState() {
    const employee = state.currentEmployee;
    if (!employee) {
      stopWorkTimer();
      return;
    }

    const monthly = computeMonthlyStats(employee.id);
    $("#kpiPresentDays").text(monthly.presentDays);
    $("#kpiHalfDays").text(monthly.halfDays);
    $("#kpiLeaveDays").text(monthly.leaveDays);
    $("#kpiHours").text(monthly.hoursWorkedTotal);
    $("#kpiMonthLabel").text(
      new Date(`${monthly.monthKey}-01T00:00:00`).toLocaleString([], {
        month: "long",
        year: "numeric",
      })
    );
    $("#kpiContainer").show();

    const { lastPunchIn, lastPunchOut } = getTodayAttendanceStatus(employee.id);
    const openShift = getLastOpenShift(employee.id);

    $("#todayStatusLabel").text(openShift ? "Currently punched in" : "Not punched in");
    $("#lastPunchInLabel").text(lastPunchIn ? formatDateTime(lastPunchIn.time) : "-");
    $("#lastPunchOutLabel").text(lastPunchOut ? formatDateTime(lastPunchOut.time) : "-");

    if (openShift) {
      startWorkTimer(openShift.time);
      const workedHours = hoursBetween(openShift.time, new Date().toISOString());
      const shouldAlert = workedHours >= 8;
      $("#bell-badge").css("display", shouldAlert ? "inline-block" : "none");

      if (shouldAlert) {
        if (window.Notification && Notification.permission === "granted") {
          new Notification("Punch Out Reminder", {
            body: "8 hours complete. Please punch out now.",
            icon: "ind_logo.png",
          });
        }
        blinkPunchOutButton();
      }
    } else {
      stopWorkTimer();
      $("#bell-badge").hide();
    }

    updatePunchButtons();
  }

  function setCurrentEmployee(employee) {
    state.currentEmployee = employee;

    if (!employee) {
      $("#employeeId").val("");
      $("#employeeCodeView").val("");
      $("#employeeName").val("");
      return;
    }

    $("#employeeId").val(employee.id);
    $("#employeeCodeView").val(employee.id);
    $("#employeeName").val(employee.name || "");
    $("#portalGreeting").text(`${employee.name || employee.id}`);
    $("#portalSubtitle").text(`Employee ID: ${employee.id}`);
    updateDashboardState();
  }

  function hydrateFromSession() {
    state.session = window.IndzoneAuth.getSession();

    if (window.IndzoneAuth.isAdminSession(state.session)) {
      window.location.href = "export.html";
      return;
    }

    if (!window.IndzoneAuth.isEmployeeSession(state.session)) {
      setCurrentEmployee(null);
      showAuthGate();
      return;
    }

    if (!state.employeesLoaded) {
      return;
    }

    const employee = state.employees[state.session.employeeId];
    if (!employee) {
      window.IndzoneAuth.clearSession();
      state.session = null;
      setCurrentEmployee(null);
      showAuthGate();
      return;
    }

    $("#sessionRoleBadge").text("Employee");
    showPortal();
    setCurrentEmployee(employee);
  }

  function fetchLocation() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation not supported"));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        function (position) {
          const latitude = position.coords.latitude;
          const longitude = position.coords.longitude;
          const location = `Lat: ${latitude}, Lon: ${longitude}`;

          $.get(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
            function (data) {
              const name = data.display_name || "Unknown";
              resolve({ location, locationName: name });
            }
          ).fail(function () {
            resolve({ location, locationName: "Unknown" });
          });
        },
        function () {
          reject(new Error("Location permission required"));
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    });
  }

  function pushAttendance(record) {
    return attendanceDb.ref("attendance").push(record);
  }

  function createPendingPunchOut(request) {
    return attendanceDb.ref("pending_punchout").push({
      ...request,
      status: "Pending",
      requestedAt: new Date().toISOString(),
    });
  }

  async function handleEmployeeLogin(event) {
    event.preventDefault();
    const employeeId = window.IndzoneAuth.normalizeEmployeeId($("#loginEmployeeId").val());
    const pin = $("#loginEmployeePin").val().trim();

    const employee = state.employees[employeeId];
    const verification = await window.IndzoneAuth.verifyEmployeePin(employee, pin);

    if (!verification.ok) {
      if (verification.reason === "pin_not_set") {
        alert("Admin has not configured your access PIN yet.");
      } else {
        alert("Invalid Employee ID or PIN.");
      }
      return;
    }

    window.IndzoneAuth.setSession({
      role: "employee",
      employeeId: employee.id,
      name: employee.name || employee.id,
    });
    $("#employeeLoginForm")[0].reset();
    hydrateFromSession();
  }

  function handleAdminLogin(event) {
    event.preventDefault();
    const password = $("#adminPassword").val().trim();
    if (password !== window.IndzoneAuth.ADMIN_PASSWORD) {
      alert("Incorrect admin password.");
      return;
    }

    window.IndzoneAuth.setSession({
      role: "admin",
      employeeId: "ADMIN",
      name: "Admin",
    });
    window.location.href = "export.html";
  }

  async function handlePunchIn() {
    const employee = state.currentEmployee;
    if (!employee) return;

    if (getLastOpenShift(employee.id)) {
      alert("You are already punched in.");
      return;
    }

    try {
      setPunchStatus("Fetching your location...", "info");
      const { location, locationName } = await fetchLocation();
      const now = new Date().toISOString();

      await pushAttendance({
        id: employee.id,
        name: employee.name || employee.id,
        action: "Punch In",
        time: now,
        location,
        locationName,
        wfh: $("#wfhFlag").is(":checked"),
      });

      clearPunchStatus();
      setPunchStatus("Punch in successful.", "success");
      $("#wfhFlag").prop("checked", false);
      updateDashboardState();
    } catch (error) {
      setPunchStatus(error.message || "Unable to fetch location.", "error");
    }
  }

  async function handlePunchOut() {
    const employee = state.currentEmployee;
    if (!employee) return;

    const openShift = getLastOpenShift(employee.id);
    if (!openShift) {
      alert("No active shift found.");
      return;
    }

    try {
      setPunchStatus("Fetching your location...", "info");
      const { location, locationName } = await fetchLocation();
      const now = new Date().toISOString();
      const workedHours = hoursBetween(openShift.time, now);

      if (workedHours < 8) {
        const reason = prompt("You are punching out before 8 hours. Please enter a reason:");

        if (!reason || !reason.trim()) {
          setPunchStatus("A reason is required for an early punch-out request.", "error");
          return;
        }

        await createPendingPunchOut({
          id: employee.id,
          name: employee.name || employee.id,
          action: "Punch Out",
          time: now,
          location,
          locationName,
          reason: reason.trim(),
          wfh: $("#wfhFlag").is(":checked"),
          hoursWorked: workedHours.toFixed(2),
        });

        clearPunchStatus();
        setPunchStatus(
          "Your early punch-out request has been sent for admin approval.",
          "success"
        );
        return;
      }

      await pushAttendance({
        id: employee.id,
        name: employee.name || employee.id,
        action: "Punch Out",
        time: now,
        location,
        locationName,
        wfh: $("#wfhFlag").is(":checked"),
      });

      clearPunchStatus();
      setPunchStatus("Punch out successful.", "success");
      $("#wfhFlag").prop("checked", false);
      updateDashboardState();
    } catch (error) {
      setPunchStatus(error.message || "Unable to fetch location.", "error");
    }
  }

  $("#employeeLoginForm").on("submit", handleEmployeeLogin);
  $("#adminLoginForm").on("submit", handleAdminLogin);

  $("#logoutBtn").on("click", function () {
    window.IndzoneAuth.clearSession();
    state.session = null;
    state.currentEmployee = null;
    stopWorkTimer();
    clearPunchStatus();
    showAuthGate();
  });

  $("#punchInBtn").on("click", handlePunchIn);
  $("#punchOutBtn").on("click", handlePunchOut);

  attendanceDb.ref("employees").on("value", (snapshot) => {
    state.employees = snapshot.val() || {};
    state.employeesLoaded = true;
    hydrateFromSession();
  });

  attendanceDb.ref("attendance").on("value", (snapshot) => {
    const raw = snapshot.val() || {};
    state.attendance = Object.values(raw);
    updateDashboardState();
  });

  attendanceDb.ref("leaves").on("value", (snapshot) => {
    const raw = snapshot.val() || {};
    state.leaves = Object.values(raw);
    updateDashboardState();
  });

  renderTodayBanner();
  hydrateFromSession();
  updatePunchButtons();

  window.addEventListener("beforeunload", stopWorkTimer);
});
