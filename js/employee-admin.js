const employeeAdminFirebaseConfig = {
  apiKey: "AIzaSyAQYjOF9YuB5D9LowTyGDP4JbG8cdWBJ88",
  authDomain: "employeeapp-c948f.firebaseapp.com",
  databaseURL: "https://employeeapp-c948f-default-rtdb.firebaseio.com",
  projectId: "employeeapp-c948f",
  storageBucket: "employeeapp-c948f.appspot.com",
  messagingSenderId: "546940583535",
  appId: "1:546940583535:web:3b930ca9f7646d9fe2979a",
};

if (!firebase.apps.length) {
  firebase.initializeApp(employeeAdminFirebaseConfig);
}

const employeeAdminDb = firebase.database();

function adminDecrypt(value) {
  if (!value) return "";
  try {
    return decodeURIComponent(escape(atob(value)));
  } catch (error) {
    return value;
  }
}

$(document).ready(function () {
  let allEmployees = [];

  function getAdminSession() {
    return window.IndzoneAuth.getSession();
  }

  function requireAdminAccess() {
    const session = getAdminSession();
    if (window.IndzoneAuth.isAdminSession(session)) {
      $("#employeeAdminAuth").hide();
      $("#employeeAdminShell").show();
      return true;
    }

    $("#employeeAdminAuth").show();
    $("#employeeAdminShell").hide();
    return false;
  }

  function employeePinStatus(employee) {
    return employee.pinHash || employee.accessPin
      ? "Configured"
      : "Self-service available";
  }

  function getStoredPin(employee) {
    if (!employee) return "";
    if (employee.pinEncoded) {
      return window.IndzoneAuth.decodeStoredPin(employee.pinEncoded);
    }
    if (employee.accessPin) {
      return String(employee.accessPin).trim();
    }
    return "";
  }

  function decodeForDisplay(value) {
    return adminDecrypt(value || "");
  }

  function renderEmployees(filterText = "") {
    const term = String(filterText || "").trim().toLowerCase();
    const filtered = allEmployees.filter((employee) => {
      const haystack = [
        employee.id,
        employee.name,
        decodeForDisplay(employee.whatsapp),
        decodeForDisplay(employee.email),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });

    const $tbody = $("#employeeTable tbody");
    $tbody.empty();

    if (!filtered.length) {
      $tbody.append(
        '<tr><td colspan="6" style="text-align:center;color:#6b7b93;">No employees found</td></tr>'
      );
      $("#employeeCount").text("Total: 0");
      return;
    }

    filtered.forEach((employee) => {
      const whatsapp = decodeForDisplay(employee.whatsapp);
      const email = decodeForDisplay(employee.email);
      const pinBadgeClass = employee.pinHash || employee.accessPin ? "success-badge" : "warning-badge";
      const storedPin = getStoredPin(employee);
      const pinHtml = storedPin
        ? `
            <div class="pin-cell">
              <span class="${pinBadgeClass}">${employeePinStatus(employee)}</span>
              <button type="button" class="toggle-stored-pin secondary-button" data-id="${employee.id}">Show PIN</button>
              <div class="stored-pin-value" data-id="${employee.id}" style="display:none;">${storedPin}</div>
            </div>
          `
        : `<span class="${pinBadgeClass}">${employeePinStatus(employee)}</span>`;
      $tbody.append(`
        <tr data-id="${employee.id}">
          <td data-label="ID">${employee.id || "-"}</td>
          <td data-label="Name" class="col-name">${employee.name || "-"}</td>
          <td data-label="WhatsApp" class="col-whatsapp">${whatsapp || "-"}</td>
          <td data-label="Email" class="col-email">${email || "-"}</td>
          <td data-label="PIN Status" class="col-pin-status">${pinHtml}</td>
          <td data-label="Action" class="col-actions">
            <button type="button" class="edit-emp" data-id="${employee.id}">Edit</button>
            <button type="button" class="delete-emp" data-id="${employee.id}">Remove</button>
          </td>
        </tr>
      `);
    });

    $("#employeeCount").text(`Total: ${filtered.length}`);
  }

  function loadEmployees() {
    employeeAdminDb.ref("employees").on("value", (snapshot) => {
      const data = snapshot.val() || {};
      allEmployees = Object.values(data).sort((left, right) =>
        String(left.id || "").localeCompare(String(right.id || ""))
      );
      renderEmployees($("#employeeSearch").val());
    });
  }

  async function saveEmployeeRecord(employeeId, payload) {
    const existingEmployee = allEmployees.find((employee) => employee.id === employeeId) || {};
    const updates = {
      id: window.IndzoneAuth.normalizeEmployeeId(employeeId),
      name: String(payload.name || "").trim(),
      location: existingEmployee.location || payload.location || "",
      whatsapp: String(payload.whatsapp || "").trim(),
      email: String(payload.email || "").trim(),
    };

    const pin = String(payload.pin || "").trim();
    if (pin) {
      updates.pinHash = await window.IndzoneAuth.createPinHash(pin);
      updates.pinEncoded = window.IndzoneAuth.encodeStoredPin(pin);
      updates.pinUpdatedAt = new Date().toISOString();
    }

    return employeeAdminDb.ref(`employees/${updates.id}`).update(updates);
  }

  $("#employeeAdminLoginForm").on("submit", function (event) {
    event.preventDefault();
    const password = $("#employeeAdminPassword").val().trim();
    if (password !== window.IndzoneAuth.ADMIN_PASSWORD) {
      alert("Incorrect admin password.");
      return;
    }

    window.IndzoneAuth.setSession({
      role: "admin",
      employeeId: "ADMIN",
      name: "Admin",
    });
    $("#employeeAdminPassword").val("");
    requireAdminAccess();
    loadEmployees();
  });

  $("#employeeAdminLogout").on("click", function () {
    window.IndzoneAuth.clearSession();
    window.location.href = "index.html";
  });

  $("#employeeSearch").on("input", function () {
    renderEmployees($(this).val());
  });

  $("#addEmployeeForm").on("submit", async function (event) {
    event.preventDefault();
    const employeeId = window.IndzoneAuth.normalizeEmployeeId($("#newEmployeeId").val());
    const employeeName = $("#newEmployeeName").val().trim();
    const whatsapp = $("#employeeWhatsapp").val().trim();
    const email = $("#employeeEmail").val().trim();
    const pin = $("#newEmployeePin").val().trim();

    if (!employeeId || !employeeName) {
      alert("Employee ID and name are required.");
      return;
    }

    if (pin && pin.length < 4) {
      alert("If you set a PIN, it must be at least 4 characters long.");
      return;
    }

    const existing = allEmployees.find((employee) => employee.id === employeeId);
    if (existing) {
      alert("Employee ID already exists.");
      return;
    }

    await saveEmployeeRecord(employeeId, {
      name: employeeName,
      whatsapp,
      email,
      pin,
      location: "",
    });

    $("#addEmployeeForm")[0].reset();
    alert("Employee added successfully.");
  });

  $(document).on("click", ".edit-emp", function () {
    const employeeId = $(this).data("id");
    const employee = allEmployees.find((entry) => entry.id === employeeId);
    if (!employee) return;

    const $row = $(this).closest("tr");
    $row.find(".col-name").html(
      `<input type="text" name="name" value="${employee.name || ""}" class="inline-edit-input">`
    );
    $row.find(".col-whatsapp").html(
      `<input type="text" name="whatsapp" value="${decodeForDisplay(employee.whatsapp)}" class="inline-edit-input">`
    );
    $row.find(".col-email").html(
      `<input type="email" name="email" value="${decodeForDisplay(employee.email)}" class="inline-edit-input">`
    );
    $row
      .find(".col-pin-status")
      .html(
        `
          <div class="stack-form" style="gap:8px;">
            <div class="input-with-toggle compact-inline-toggle">
              <input type="password" name="pin" placeholder="Leave blank to keep current PIN" class="inline-edit-input">
              <button type="button" class="toggle-secret" data-target="closest-input">Show</button>
            </div>
            ${
              getStoredPin(employee)
                ? `<button type="button" class="toggle-stored-pin secondary-button" data-id="${employee.id}">Show saved PIN</button><div class="stored-pin-value" data-id="${employee.id}" style="display:none;">${getStoredPin(employee)}</div>`
                : `<span class="warning-badge">Saved PIN can be revealed after the next PIN update.</span>`
            }
          </div>
        `
      );
    $row.find(".col-actions").html(`
      <button type="button" class="save-emp" data-id="${employeeId}">Save</button>
      <button type="button" class="cancel-emp">Cancel</button>
    `);
  });

  $(document).on("click", ".cancel-emp", function () {
    renderEmployees($("#employeeSearch").val());
  });

  $(document).on("click", ".save-emp", async function () {
    const employeeId = $(this).data("id");
    const $row = $(this).closest("tr");
    const name = $row.find('input[name="name"]').val().trim();
    const whatsapp = $row.find('input[name="whatsapp"]').val().trim();
    const email = $row.find('input[name="email"]').val().trim();
    const pin = $row.find('input[name="pin"]').val().trim();

    if (!name) {
      alert("Employee name is required.");
      return;
    }

    if (pin && pin.length < 4) {
      alert("If you set a PIN, it must be at least 4 characters long.");
      return;
    }

    await saveEmployeeRecord(employeeId, {
      name,
      whatsapp,
      email,
      pin,
      location: "",
    });

    alert("Employee updated successfully.");
  });

  $(document).on("click", ".delete-emp", function () {
    const employeeId = $(this).data("id");
    const confirmed = confirm(
      "Remove this employee and all related attendance, leave, and pending punch-out records?"
    );

    if (!confirmed) return;

    employeeAdminDb.ref().once("value").then((rootSnapshot) => {
      const root = rootSnapshot.val() || {};
      const updates = {};

      Object.entries(root.attendance || {}).forEach(([key, record]) => {
        if (record && record.id === employeeId) updates[`attendance/${key}`] = null;
      });

      Object.entries(root.leaves || {}).forEach(([key, record]) => {
        if (record && record.employeeId === employeeId) updates[`leaves/${key}`] = null;
      });

      Object.entries(root.pending_punchout || {}).forEach(([key, record]) => {
        if (record && record.id === employeeId) {
          updates[`pending_punchout/${key}`] = null;
        }
      });

      updates[`employees/${employeeId}`] = null;

      employeeAdminDb.ref().update(updates).then(() => {
        alert("Employee and related data removed.");
      });
    });
  });

  $(document).on("click", ".toggle-stored-pin", function () {
    const employeeId = $(this).data("id");
    const $value = $(`.stored-pin-value[data-id="${employeeId}"]`).first();
    if (!$value.length) return;

    const shouldShow = $value.is(":hidden");
    $value.toggle(shouldShow);
    $(this).text(shouldShow ? "Hide PIN" : "Show PIN");
  });

  if (requireAdminAccess()) {
    loadEmployees();
  }
});
