(function (window) {
  const SESSION_KEY = "indzoneAttendanceSession";
  const ADMIN_PASSWORD = "admininz@123";

  function normalizeEmployeeId(value) {
    return String(value || "").trim().toUpperCase();
  }

  function normalizeName(value) {
    return String(value || "")
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();
  }

  function normalizeDigits(value) {
    return String(value || "").replace(/\D/g, "");
  }

  async function hashValue(value) {
    const normalized = String(value || "").trim();
    if (!normalized) return "";

    if (window.crypto && window.crypto.subtle && window.TextEncoder) {
      const buffer = new TextEncoder().encode(normalized);
      const digest = await window.crypto.subtle.digest("SHA-256", buffer);
      return Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
    }

    try {
      return btoa(unescape(encodeURIComponent(normalized)));
    } catch (error) {
      return normalized;
    }
  }

  async function createPinHash(pin) {
    return hashValue(pin);
  }

  function encodeStoredPin(pin) {
    const normalized = String(pin || "").trim();
    if (!normalized) return "";

    try {
      return btoa(unescape(encodeURIComponent(normalized)));
    } catch (error) {
      return normalized;
    }
  }

  function decodeStoredPin(value) {
    if (!value) return "";

    try {
      return decodeURIComponent(escape(atob(value)));
    } catch (error) {
      return value;
    }
  }

  function generateNumericPin(length = 6) {
    const size = Math.max(4, Number(length) || 6);
    let pin = "";
    for (let index = 0; index < size; index += 1) {
      pin += Math.floor(Math.random() * 10);
    }
    return pin;
  }

  async function verifyEmployeePin(employee, pin) {
    if (!employee) {
      return { ok: false, reason: "employee_not_found" };
    }

    const enteredPin = String(pin || "").trim();
    if (!enteredPin) {
      return { ok: false, reason: "missing_pin" };
    }

    if (employee.pinHash) {
      const candidate = await hashValue(enteredPin);
      return {
        ok: candidate === employee.pinHash,
        reason: candidate === employee.pinHash ? "ok" : "invalid_pin",
      };
    }

    if (employee.accessPin) {
      const ok = String(employee.accessPin).trim() === enteredPin;
      return { ok, reason: ok ? "ok" : "invalid_pin" };
    }

    return { ok: false, reason: "pin_not_set" };
  }

  function verifyEmployeeIdentity(employee, identity = {}) {
    if (!employee) {
      return { ok: false, reason: "employee_not_found" };
    }

    const employeeName = normalizeName(employee.name);
    const providedName = normalizeName(identity.name);
    const employeeEmail = String(employee.email || "").trim().toLowerCase();
    const providedEmail = String(identity.email || "").trim().toLowerCase();
    const employeePhone = normalizeDigits(employee.whatsapp);
    const providedPhone = normalizeDigits(identity.whatsapp);

    const hasVerifier = !!(providedName || providedEmail || providedPhone);
    if (!hasVerifier) {
      return { ok: false, reason: "identity_missing" };
    }

    if (providedName && employeeName && providedName === employeeName) {
      return { ok: true, reason: "ok" };
    }

    if (providedEmail && employeeEmail && providedEmail === employeeEmail) {
      return { ok: true, reason: "ok" };
    }

    if (providedPhone && employeePhone && providedPhone === employeePhone) {
      return { ok: true, reason: "ok" };
    }

    return { ok: false, reason: "identity_mismatch" };
  }

  function getSession() {
    try {
      return JSON.parse(window.localStorage.getItem(SESSION_KEY) || "null");
    } catch (error) {
      return null;
    }
  }

  function setSession(session) {
    const payload = {
      role: session.role,
      employeeId: normalizeEmployeeId(session.employeeId),
      name: String(session.name || ""),
      loginAt: new Date().toISOString(),
    };
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(payload));
    return payload;
  }

  function clearSession() {
    window.localStorage.removeItem(SESSION_KEY);
  }

  function isAdminSession(session) {
    return !!session && session.role === "admin";
  }

  function isEmployeeSession(session) {
    return !!session && session.role === "employee" && !!session.employeeId;
  }

  function maskPhone(value) {
    const digits = String(value || "").replace(/\D/g, "");
    if (!digits) return "";
    if (digits.length <= 4) return digits;
    return `${"*".repeat(Math.max(digits.length - 4, 2))}${digits.slice(-4)}`;
  }

  function maskEmail(value) {
    const email = String(value || "").trim();
    if (!email.includes("@")) return email;
    const [name, domain] = email.split("@");
    if (name.length <= 2) return `${name[0] || "*"}*@${domain}`;
    return `${name.slice(0, 2)}${"*".repeat(Math.max(name.length - 2, 1))}@${domain}`;
  }

  document.addEventListener("click", function (event) {
    const toggle = event.target.closest(".toggle-secret");
    if (!toggle) return;

    const rawTarget = toggle.getAttribute("data-target");
    let input = null;

    if (rawTarget === "closest-input") {
      const container = toggle.closest(".input-with-toggle");
      input = container ? container.querySelector("input") : null;
    } else if (rawTarget) {
      input = document.querySelector(rawTarget);
    }

    if (!input) return;

    const shouldShow = input.type === "password";
    input.type = shouldShow ? "text" : "password";
    toggle.textContent = shouldShow ? "Hide" : "Show";
  });

  window.IndzoneAuth = {
    ADMIN_PASSWORD,
    SESSION_KEY,
    clearSession,
    createPinHash,
    decodeStoredPin,
    encodeStoredPin,
    generateNumericPin,
    getSession,
    isAdminSession,
    isEmployeeSession,
    maskEmail,
    maskPhone,
    normalizeEmployeeId,
    normalizeName,
    setSession,
    verifyEmployeeIdentity,
    verifyEmployeePin,
  };
})(window);
