// app.js

// Firebase CDN scripts should be included in HTML, but for clarity, config and init here:
// (Make sure these scripts are in your HTML head)
// <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js"></script>
// <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js"></script>

const firebaseConfig = {
  apiKey: "AIzaSyAQYjOF9YuB5D9LowTyGDP4JbG8cdWBJ88",
  authDomain: "employeeapp-c948f.firebaseapp.com",
  databaseURL: "https://employeeapp-c948f-default-rtdb.firebaseio.com",
  projectId: "employeeapp-c948f",
  storageBucket: "employeeapp-c948f.appspot.com",
  messagingSenderId: "546940583535",
  appId: "1:546940583535:web:3b930ca9f7646d9fe2979a"
};
if (!firebase.apps?.length) firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// --- Robust Inspect/Right Click Blocker (Global, runs ASAP) ---
(function() {
  // Enable block by default
  window.blockInspect = true;
  // Toast function
  function showToast(msg) {
    let toast = document.getElementById('inspectToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'inspectToast';
      toast.style.position = 'fixed';
      toast.style.bottom = '30px';
      toast.style.left = '50%';
      toast.style.transform = 'translateX(-50%)';
      toast.style.background = '#222';
      toast.style.color = '#fff';
      toast.style.padding = '10px 24px';
      toast.style.borderRadius = '8px';
      toast.style.fontSize = '16px';
      toast.style.zIndex = 99999;
      toast.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.display = 'block';
    setTimeout(() => { toast.style.display = 'none'; }, 1500);
  }
  // Blockers
  function blockContextMenu(e) { if (window.blockInspect) e.preventDefault(); }
  function blockKeydown(e) {
    if (!window.blockInspect) return;
    // F12, Ctrl+Shift+I/J/C/K, Ctrl+U, Ctrl+S, Ctrl+P, Ctrl+F
    if (
      e.keyCode === 123 || // F12
      (e.ctrlKey && e.shiftKey && (e.keyCode === 73 || e.keyCode === 74 || e.keyCode === 67 || e.keyCode === 75)) || // Ctrl+Shift+I/J/C/K
      (e.ctrlKey && (e.keyCode === 85 || e.keyCode === 83 || e.keyCode === 80 || e.keyCode === 70)) // Ctrl+U/S/P/F
    ) {
      e.preventDefault();
    }
  }
  // Attach listeners, and re-attach if removed
  function attachBlockers() {
    document.addEventListener('contextmenu', blockContextMenu, true);
    document.addEventListener('keydown', blockKeydown, true);
  }
  function detachBlockers() {
    document.removeEventListener('contextmenu', blockContextMenu, true);
    document.removeEventListener('keydown', blockKeydown, true);
  }
  attachBlockers();
  // Watch for removal and re-attach
  setInterval(() => {
    attachBlockers();
  }, 1000);
  // Only allow toggle with Ctrl+1 and a secret code
  let unlock = false;
  document.addEventListener('keydown', function(e) {
    if (e.ctrlKey && !e.shiftKey && e.key === '1') {
      if (!unlock) {
        const code = prompt('Enter admin code to toggle inspect block:');
        if (code === 'indzone@123') {
          unlock = true;
          showToast('Admin mode enabled');
        } else {
          showToast('Wrong code!');
          return;
        }
      }
      window.blockInspect = !window.blockInspect;
      if (window.blockInspect) {
        attachBlockers();
        showToast('Inspect Block: ON');
      } else {
        detachBlockers();
        showToast('Inspect Block: OFF');
      }
    }
  });
  // Block inspect on load
  window.addEventListener('DOMContentLoaded', function() {
    window.blockInspect = true;
    attachBlockers();
    showToast('Inspect Block: ON');
  });
  // Prevent tampering
  Object.defineProperty(window, 'blockInspect', {
    configurable: false,
    writable: true,
    enumerable: true
  });
  Object.defineProperty(window, 'toggleInspectBlock', {
    configurable: false,
    writable: false,
    enumerable: false,
    value: function(onOff) {
      // Only allow if unlocked
      if (!unlock) return;
      window.blockInspect = !!onOff;
      if (window.blockInspect) {
        attachBlockers();
        showToast('Inspect Block: ON');
      } else {
        detachBlockers();
        showToast('Inspect Block: OFF');
      }
    }
  });
})();

// Helper to get empid from URL
function getEmployeeIdFromURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get('empid');
}

$(document).ready(function() {
    // Initialize live timer if empid is already in URL (e.g., after redirect)
    try {
        const urlEmp = getEmployeeIdFromURL();
        if (urlEmp) initWorkTimerForSelectedEmployee(urlEmp);
    } catch(e) {}
    // Always request notification permission on page load if not already granted or denied
    if (window.Notification && Notification.permission !== "granted" && Notification.permission !== "denied") {
        Notification.requestPermission();
    }
    // Show WFH checkbox only when empid is present (selected or in URL)
    $('.wfh-row').hide();
    try {
        const urlEmp = (new URLSearchParams(window.location.search)).get('empid');
        if (urlEmp) { $('.wfh-row').show(); }
    } catch(e) {}

    // Today Holiday banner (from holidays.js)
    function updateTodayHolidayBanner() {
        $('#todayHolidayBanner').remove();
        if (typeof window.getHolidayByDate === 'function') {
            const today = new Date();
            const iso = today.toISOString().slice(0,10);
            const h = window.getHolidayByDate(iso);
            if (h) {
                const badgeColor = h.type === 'public' ? '#003F8C' : '#E70000';
                const text = h.type === 'public' ? `Today is Public Holiday: ${h.name}` : `Today is Festival: ${h.name}`;
                const banner = `<div id="todayHolidayBanner" style="margin:10px 0 12px; padding:10px 14px; background:#f0f4fa; border-left:6px solid ${badgeColor}; border-radius:8px; color:#003F8C; font-weight:600;">${text}</div>`;
                $('.container h1').after(banner);
            }
        }
    }
    // Call once on load
    updateTodayHolidayBanner();
    
    // Fetch employees from Firebase
    let employees = [];
    function fetchEmployees(callback) {
        db.ref('employees').on('value', (snapshot) => {
            const data = snapshot.val() || {};
            employees = Object.values(data);
            updateDropdown();
            if (callback) callback(employees);
        });
    }

    // Populate dropdown with employees
    function updateDropdown() {
        $('#employeeId').empty().append('<option value="">Select Employee</option>');
        employees.forEach(emp => {
            $('#employeeId').append(`<option value="${emp.id}">${emp.id} - ${emp.name}</option>`);
        });
    }

    // Auto-fill name on select
    $('#employeeId').change(function() {
        const selected = employees.find(e => e.id === $(this).val());
        $('#employeeName').val(selected ? selected.name : '');
    });

    // When employee is selected from dropdown, update URL, disable dropdown, and re-run notification logic
    $('#employeeId').on('change', function() {
        var empId = $(this).val();
        if (empId) {
            // Update URL with empid
            const url = new URL(window.location);
            url.searchParams.set('empid', empId);
            window.history.replaceState({}, '', url);
            // Disable dropdown
            $('#employeeId').prop('disabled', true);
            // Show WFH row when emp selected
            $('.wfh-row').show();
            // Re-run punchout notification logic for this employee
            if (typeof checkAllEmployeesPunchout === 'function') {
                checkAllEmployeesPunchout();
            }
            // Init live work timer for selected employee
            initWorkTimerForSelectedEmployee(empId);
        } else {
            // Hide WFH if cleared
            $('.wfh-row').hide();
            stopWorkTimer();
        }
    });

    // Fetch location and call callback with (location, locationName)
    function fetchLocation(callback) {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(function(position) {
                const loc = `Lat: ${position.coords.latitude}, Lon: ${position.coords.longitude}`;
                // Use OpenStreetMap Nominatim API for reverse geocoding
                $.get(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${position.coords.latitude}&lon=${position.coords.longitude}`, function(data) {
                    // Compose the most exact location string possible
                    const addr = data.address || {};
                    let parts = [];
                    if (addr.road) parts.push(addr.road);
                    if (addr.neighbourhood) parts.push(addr.neighbourhood);
                    if (addr.suburb) parts.push(addr.suburb);
                    if (addr.village) parts.push(addr.village);
                    if (addr.town) parts.push(addr.town);
                    if (addr.city) parts.push(addr.city);
                    if (addr.state) parts.push(addr.state);
                    if (addr.country) parts.push(addr.country);
                    let locName = parts.join(', ');
                    if (!locName && data.display_name) locName = data.display_name;
                    if (!locName) locName = 'Unknown';
                    callback(loc, locName);
                }).fail(function() {
                    callback(loc, 'Unknown');
                });
            }, function() {
                callback('Location unavailable', 'Unknown');
            });
        } else {
            callback('Geolocation not supported', 'Unknown');
        }
    }

    // Attendance (Punch In/Out) data in Firebase
    function addAttendance(record) {
        // Use push for unique key
        return db.ref('attendance').push(record);
    }

    // Fetch all attendance records
    function fetchAttendance(callback) {
        db.ref('attendance').on('value', (snapshot) => {
            const data = snapshot.val() || {};
            const records = Object.values(data);
            if (callback) callback(records);
        });
    }

    function setPunchButtons(enabled) {
        $('#punchInBtn, #punchOutBtn').prop('disabled', !enabled);
    }
    function showStatus(msg) {
        if ($('#punchStatus').length === 0) {
            $('<div id="punchStatus" style="margin:10px 0;color:#007bff;"></div>').insertBefore('#punchForm');
        }
        $('#punchStatus').text(msg);
    }
    function clearStatus() {
        $('#punchStatus').remove();
    }

    // --- Punch Out Notification Logic ---
    let punchOutTimer = null;
    let punchOutRepeatTimer = null;
    function schedulePunchOutNotification() {
        // 8 hours = 8 * 60 * 60 * 1000 ms = 28800000 ms
        if (punchOutTimer) clearTimeout(punchOutTimer);
        if (punchOutRepeatTimer) clearInterval(punchOutRepeatTimer);
        punchOutTimer = setTimeout(() => {
            showPunchOutNotification();
            // Repeat every 10 minutes until punch out
            punchOutRepeatTimer = setInterval(showPunchOutNotification, 10 * 60 * 1000);
            // Also show dashboard warning
            showPunchOutWarning();
        }, 8 * 60 * 60 * 1000); // 8 hours
    }
    function showPunchOutNotification() {
        if (Notification && Notification.permission === 'granted') {
            new Notification('Punch Out Reminder', {
                body: '8 hours complete! Please Punch Out now.',
                icon: 'ind_logo.png'
            });
        } else if (Notification && Notification.permission !== 'denied') {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    new Notification('Punch Out Reminder', {
                        body: '8 hours complete! Please Punch Out now.',
                        icon: 'ind_logo.png'
                    });
                }
            });
        }
    }
    function showPunchOutWarning() {
        if ($('#punchOutWarning').length === 0) {
            $('<div id="punchOutWarning" style="color:#E70000;font-weight:bold;text-align:center;margin:10px 0;">8 hours complete! Please Punch Out now.</div>').insertBefore('#punchForm');
        }
    }
    function clearPunchOutNotification() {
        if (punchOutTimer) {
            clearTimeout(punchOutTimer);
            punchOutTimer = null;
        }
        if (punchOutRepeatTimer) {
            clearInterval(punchOutRepeatTimer);
            punchOutRepeatTimer = null;
        }
        $('#punchOutWarning').remove();
    }

    // --- Live Work Timer (starts on Punch In, stops on Punch Out) ---
    let workTimerInterval = null;
    function formatHHMMSS(ms) {
        const totalSeconds = Math.floor(ms / 1000);
        const h = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
        const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
        const s = String(totalSeconds % 60).padStart(2, '0');
        return `${h}h ${m}m ${s}s`;
    }
    function startWorkTimer(fromISO) {
        const start = new Date(fromISO);
        $('#activeSessionTimer').show();
        updateTick();
        if (workTimerInterval) clearInterval(workTimerInterval);
        workTimerInterval = setInterval(updateTick, 1000);
        function updateTick() {
            const now = new Date();
            const diff = now - start;
            $('#workTimer').text(formatHHMMSS(diff));
        }
    }
    function stopWorkTimer() {
        if (workTimerInterval) {
            clearInterval(workTimerInterval);
            workTimerInterval = null;
        }
        $('#activeSessionTimer').hide();
        $('#workTimer').text('00:00:00');
    }

    // On load, if employee selected or via URL, show running timer from last Punch In not yet punched out
    function initWorkTimerForSelectedEmployee(empId) {
        if (!empId) { stopWorkTimer(); return; }
        fetchAttendance(function(records) {
            const userRecords = records.filter(r => r.id === empId).sort((a,b)=> new Date(a.time)-new Date(b.time));
            const lastIn = [...userRecords].reverse().find(r => r.action === 'Punch In');
            const lastOutAfterIn = [...userRecords].reverse().find(r => r.action === 'Punch Out' && lastIn && new Date(r.time) >= new Date(lastIn.time));
            if (lastIn && !lastOutAfterIn) {
                startWorkTimer(lastIn.time);
            } else {
                stopWorkTimer();
            }
        });
    }

    // --- VPN/Proxy Detection Logic ---
    function checkLocationWithIP(geoLat, geoLon, callback) {
        $.get('https://ipapi.co/json/', function(data) {
            const ipLat = data.latitude;
            const ipLon = data.longitude;
            // Calculate distance between two lat/lon points (Haversine formula)
            function getDistanceFromLatLonInKm(lat1,lon1,lat2,lon2) {
                var R = 6371; // Radius of the earth in km
                var dLat = (lat2-lat1) * Math.PI/180;
                var dLon = (lon2-lon1) * Math.PI/180;
                var a = 
                    Math.sin(dLat/2) * Math.sin(dLat/2) +
                    Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * 
                    Math.sin(dLon/2) * Math.sin(dLon/2)
                    ;
                var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                var d = R * c; // Distance in km
                return d;
            }
            const dist = getDistanceFromLatLonInKm(geoLat, geoLon, ipLat, ipLon);
            callback(dist);
        }).fail(function() {
            callback(null); // Could not get IP location
        });
    }

    // --- Simple Encryption/Decryption ---
    function encrypt(str) {
        if (!str) return '';
        try { return btoa(unescape(encodeURIComponent(str))); } catch (e) { return str; }
    }
    function decrypt(str) {
        if (!str) return '';
        try { return decodeURIComponent(escape(atob(str))); } catch (e) { return str; }
    }
    
    function isEncrypted(str) {
        if (!str) return false;
        // btoa output is base64, so only A-Za-z0-9+/= allowed, and usually longer than 8 chars
        return /^[A-Za-z0-9+/=]{8,}$/.test(str);
    }

    $('#punchInBtn').off('click').on('click', function() {
        const employeeId = $('#employeeId').val();
        const employeeName = $('#employeeName').val();
        const timestamp = new Date();
        if (employeeId && employeeName) {
            setPunchButtons(false);
            showStatus('Fetching location, please wait...');
            fetchLocation(function(location, locationName) {
                if (!location || location === 'Location unavailable' || location === 'Geolocation not supported') {
                    alert('Location not available. Please allow location access and try again.');
                    setPunchButtons(true);
                    clearStatus();
                    return;
                }
                // --- VPN/Proxy check: compare browser geolocation with IP geolocation ---
                const match = location.match(/Lat: ([\d.\-]+), Lon: ([\d.\-]+)/);
                if (match) {
                    const geoLat = parseFloat(match[1]);
                    const geoLon = parseFloat(match[2]);
                    checkLocationWithIP(geoLat, geoLon, function(dist) {
                        if (dist !== null && dist > 50) { // 50km+ difference is suspicious
                            alert('Location mismatch detected! Please turn off VPN/Proxy and try again.');
                            setPunchButtons(true);
                            clearStatus();
                            return;
                        }
                        // If location is OK, proceed
                        addAttendance({
                            id: employeeId,
                            name: employeeName,
                            action: 'Punch In',
                            time: timestamp.toISOString(),
                            location: location,
                            locationName: locationName,
                            wfh: !!$('#wfhFlag').prop('checked')
                        }).then(() => {
                            alert('Punched In Successfully!');
                            // Start live timer from this timestamp
                            startWorkTimer(timestamp.toISOString());
                            // After OK, redirect to index.html
                            window.location.href = 'index.html';
                            $('#employeeId').val('');
                            $('#employeeName').val('');
                            setPunchButtons(true);
                            clearStatus();
                            // Schedule Punch Out notification after 8 hours
                            schedulePunchOutNotification();
                        });
                    });
                } else {
                    alert('Could not parse location.');
                    setPunchButtons(true);
                    clearStatus();
                }
            });
        } else {
            alert('Please select Employee.');
        }
    });

    // Add modal HTML for punch out reason if not present
    if ($('#punchOutReasonModal').length === 0) {
        $('body').append(`
        <div id="punchOutReasonModal" style="display:none;position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.4);z-index:99999;align-items:center;justify-content:center;">
            <div style="background:#fff;padding:28px 32px;border-radius:10px;max-width:350px;margin:auto;box-shadow:0 2px 16px #0002;">
                <h3 style="margin-top:0;">Early Punch Out</h3>
                <p>8 hours not complete. Please enter reason for early Punch Out:</p>
                <textarea id="punchOutReasonInput" style="width:100%;height:60px;margin-bottom:12px;"></textarea>
                <div style="text-align:right;">
                    <button id="punchOutReasonCancel">Cancel</button>
                    <button id="punchOutReasonSubmit" style="background:#003F8C;color:#fff;padding:6px 18px;border:none;border-radius:5px;">Submit</button>
                </div>
            </div>
        </div>`);
    }

    $('#punchOutBtn').off('click').on('click', function() {
        const employeeId = $('#employeeId').val();
        const employeeName = $('#employeeName').val();
        const timestamp = new Date();
        if (employeeId && employeeName) {
            setPunchButtons(false);
            showStatus('Fetching location, please wait...');
            fetchLocation(function(location, locationName) {
                if (!location || location === 'Location unavailable' || location === 'Geolocation not supported') {
                    alert('Location not available. Please allow location access and try again.');
                    setPunchButtons(true);
                    clearStatus();
                    return;
                }
                fetchAttendance(function(records) {
                    const userRecords = records.filter(r => r.id === employeeId);
                    const lastPunchIn = userRecords.filter(r => r.action === 'Punch In').sort((a, b) => new Date(b.time) - new Date(a.time))[0];
                    let punchOutEarly = false;
                    let lessThanFourHours = false;
                    if (lastPunchIn) {
                        const inTime = new Date(lastPunchIn.time);
                        const now = new Date();
                        const diffMs = now - inTime;
                        const hours = diffMs / (1000 * 60 * 60);
                        if (hours < 8) {
                            punchOutEarly = true;
                        }
                        if (hours < 4) {
                            lessThanFourHours = true;
                        }
                    }
                    if (lessThanFourHours) {
                        // Mark leave in employee table
                        const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
                        db.ref('employees/' + employeeId + '/leaves/' + today).set({
                            date: today,
                            reason: 'Less than 4 hours present (auto-leave)',
                            type: 'Auto'
                        }).then(() => {
                            alert('Less than 4 hours present. Leave marked for today.');
                            // Proceed with punch out as usual
                            addAttendance({
                                id: employeeId,
                                name: employeeName,
                                action: 'Punch Out',
                                time: timestamp.toISOString(),
                                location: location,
                                locationName: locationName,
                                wfh: !!$('#wfhFlag').prop('checked')
                            }).then(() => {
                                alert('Punched Out Successfully!');
                                window.location.href = 'index.html';
                                $('#employeeId').val('');
                                $('#employeeName').val('');
                                setPunchButtons(true);
                                clearStatus();
                                clearPunchOutNotification();
                                // Stop live timer on successful Punch Out
                                stopWorkTimer();
                            });
                        });
                        return;
                    }
                    if (punchOutEarly) {
                        // Show modal for reason
                        $('#punchOutReasonInput').val('');
                        $('#punchOutReasonModal').fadeIn(200);
                        $('#punchOutReasonCancel').off('click').on('click', function() {
                            $('#punchOutReasonModal').fadeOut(200);
                            setPunchButtons(true);
                            clearStatus();
                        });
                        $('#punchOutReasonSubmit').off('click').on('click', function() {
                            const reason = $('#punchOutReasonInput').val().trim();
                            if (!reason) {
                                alert('Reason is required for early Punch Out.');
                                return;
                            }
                            $('#punchOutReasonModal').fadeOut(200);
                            db.ref('pending_punchout').push({
                                id: employeeId,
                                name: employeeName,
                                action: 'Punch Out',
                                time: timestamp.toISOString(),
                                location: location,
                                locationName: locationName,
                                reason: reason,
                                wfh: !!$('#wfhFlag').prop('checked'),
                                status: 'pending'
                            }).then(() => {
                                alert('Punch Out request sent for admin approval.');
                                setPunchButtons(true);
                                clearStatus();
                                // Do not stop timer here; it's pending until approved
                            });
                        });
                        return;
                    }
                    // Normal Punch Out (8+ hours or 4-8 hours with reason)
                    addAttendance({
                        id: employeeId,
                        name: employeeName,
                        action: 'Punch Out',
                        time: timestamp.toISOString(),
                        location: location,
                        locationName: locationName,
                        wfh: !!$('#wfhFlag').prop('checked')
                    }).then(() => {
                        alert('Punched Out Successfully!');
                        window.location.href = 'index.html';
                        $('#employeeId').val('');
                        $('#employeeName').val('');
                        setPunchButtons(true);
                        clearStatus();
                        clearPunchOutNotification();
                        // Stop live timer on successful Punch Out
                        stopWorkTimer();
                    });
                });
            });
        } else {
            alert('Please select Employee.');
        }
    });

    // Export Data button logic with filter (if present)
    $('#exportBtn').click(function() {
        const filterId = prompt('Enter Employee ID to export (leave blank for all):');
        const filterMonth = prompt('Enter Month (YYYY-MM) to export (leave blank for all):');
        const filterYear = prompt('Enter Year (YYYY) to export (leave blank for all):');

        fetchAttendance(function(employeeData) {
            // Filter data
            let filtered = employeeData.filter(record => {
                let match = true;
                if (filterId && record.id !== filterId) match = false;
                if (filterMonth) {
                    const recMonth = record.time.slice(0, 7);
                    if (recMonth !== filterMonth) match = false;
                }
                if (filterYear) {
                    const recYear = record.time.slice(0, 4);
                    if (recYear !== filterYear) match = false;
                }
                return match;
            });

            if (filtered.length === 0) {
                alert('No data to export!');
                return;
            }

            // Prepare rows for export
            let rows = [
                ['Employee ID', 'Employee Name', 'Action', 'Time', 'Location', 'Location Name', 'WFH']
            ];
            filtered.forEach(r => {
                rows.push([r.id, r.name, r.action, r.time, r.location, r.locationName, r.wfh ? 'Yes' : 'No']);
            });

            let worksheet = XLSX.utils.aoa_to_sheet(rows);
            let workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance');
            XLSX.writeFile(workbook, 'attendance_filtered.xlsx');
        });
    });

    // Add employee name and location name fields if not present
    if (!$('#employeeName').length) {
        $('<label for="employeeName">Employee Name:</label><input type="text" id="employeeName" required>')
            .insertAfter($('#employeeId'));
    }
    if (!$('#locationName').length) {
        $('<input type="hidden" id="locationName">').insertAfter($('#location'));
    }

    // Show Edit Profile section for selected employee
    function showEditProfileSection(employeeId) {
        if (!employeeId) {
            $('#editProfileSection').hide();
            return;
        }
        // Fetch employee details
        db.ref('employees/' + employeeId).once('value').then(snapshot => {
            const emp = snapshot.val();
            if (!emp) {
                $('#editProfileSection').hide();
                return;
            }
            
            // Always decrypt values for display
            let whatsappVal = emp.whatsapp || '';
            let emailVal = emp.email || '';
            
            // Always decrypt if encrypted
            if (isEncrypted(whatsappVal)) whatsappVal = decrypt(whatsappVal);
            if (isEncrypted(emailVal)) emailVal = decrypt(emailVal);
            
            // Set decrypted values in form fields
            $('#editWhatsapp').val(whatsappVal);
            $('#editEmail').val(emailVal);
            $('#editProfileSection').show();
        });
    }
    // When employee is selected, show profile edit
    $('#employeeId').change(function() {
        const empId = $(this).val();
        showEditProfileSection(empId);
    });
    // On page load, if employee is preselected, show profile edit
    setTimeout(function() {
        const empId = $('#employeeId').val();
        if (empId) showEditProfileSection(empId);
    }, 500);
    // Handle profile update
    $('#editProfileForm').submit(function(e) {
        e.preventDefault();
        const empId = $('#employeeId').val();
        if (!empId) return;
        
        // Get values from form
        let whatsappVal = $('#editWhatsapp').val().trim();
        let emailVal = $('#editEmail').val().trim();
        
        // Save as plain text (not encrypted)
        db.ref('employees/' + empId).update({ 
            whatsapp: whatsappVal, 
            email: emailVal 
        }).then(() => {
            alert('Profile updated!');
        });
    });

    // Initial fetch
    const empidFromURL = getEmployeeIdFromURL();
    if (empidFromURL) {
        fetchEmployees(function(employees) {
            const found = employees.find(e => e.id == empidFromURL);
            if (found) {
                $('#employeeId').val(found.id).trigger('change');
                $('#employeeId').prop('disabled', true);
            } else {
                alert('Employee ID not found: ' + empidFromURL);
            }
        });
    } else {
        fetchEmployees();
    }
    // Also clear timer on page unload
    window.addEventListener('beforeunload', clearPunchOutNotification);

    // Floating notification function (shows until user cancels)
    function showFloatingNotification(message) {
        // Remove old notification if present
        $('#floatingNotification').remove();
        // Add new notification
        $('body').append(`
            <div id="floatingNotification" style="
                position:fixed; bottom:30px; left:50%; transform:translateX(-50%);\n                background:#003F8C; color:#fff; padding:16px 32px; border-radius:8px;\n                box-shadow:0 2px 16px #0005; font-size:18px; z-index:99999; display:flex; align-items:center;">
                <svg style="margin-right:10px;" width="24" height="24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                <span>${message}</span>
                <button id="closeFloatingNotification" style="margin-left:20px; background:transparent; border:none; color:#fff; font-size:20px; cursor:pointer;">&times;</button>
            </div>
        `);
        $('#closeFloatingNotification').click(function() {
            $('#floatingNotification').fadeOut(200, function() { $(this).remove(); });
        });
        // No auto-hide, only close on cancel
    }

    // --- Global Punch Out Notification for Current Employee Only ---
    function checkAllEmployeesPunchout() {
        // Get current employee ID from URL or dropdown
        var currentEmployeeId = null;
        if (window.location.search.includes('empid=')) {
            const params = new URLSearchParams(window.location.search);
            currentEmployeeId = params.get('empid');
        } else {
            currentEmployeeId = $('#employeeId').val();
        }
        if (!currentEmployeeId) {
            document.getElementById('bell-badge').style.display = 'none';
            $('#floatingNotification').remove();
            return;
        }
        db.ref('attendance').once('value', (snapshot) => {
            const data = snapshot.val() || {};
            const records = Object.values(data);
            const now = new Date();
            let showNotification = false;
            let lastPunchIn = null, lastPunchOut = null;
            const empRecords = records.filter(r => r.id == currentEmployeeId).sort((a, b) => new Date(a.time) - new Date(b.time));
            for (let i = empRecords.length - 1; i >= 0; i--) {
                if (!lastPunchIn && empRecords[i].action === 'Punch In') lastPunchIn = empRecords[i];
                if (!lastPunchOut && empRecords[i].action === 'Punch Out') lastPunchOut = empRecords[i];
                if (lastPunchIn && lastPunchOut) break;
            }
            if (lastPunchIn && (!lastPunchOut || new Date(lastPunchIn.time) > new Date(lastPunchOut.time))) {
                const inTime = new Date(lastPunchIn.time);
                const hours = (now - inTime) / (1000 * 60 * 60);
                if (hours >= 8) {
                    showNotification = true;
                }
            }
            document.getElementById('bell-badge').style.display = showNotification ? 'block' : 'none';
            if (showNotification) {
                // Web notification with click action and blink
                if (Notification && Notification.permission === 'granted') {
                    const notification = new Notification('Punch Out Reminder', {
                        body: 'You have not punched out yet. Please punch out.',
                        icon: 'ind_logo.png'
                    });
                    notification.onclick = function() {
                        window.focus();
                        blinkPunchOutButton();
                    };
                } else if (Notification && Notification.permission !== 'denied') {
                    Notification.requestPermission().then(permission => {
                        if (permission === 'granted') {
                            const notification = new Notification('Punch Out Reminder', {
                                body: 'You have not punched out yet. Please punch out.',
                                icon: 'ind_logo.png'
                            });
                            notification.onclick = function() {
                                window.focus();
                                blinkPunchOutButton();
                            };
                        }
                    });
                }
                showFloatingNotification('You have not punched out yet. Please punch out.');
            } else {
                $('#floatingNotification').remove();
            }
        });
    }
    // Page load pe check karo
    checkAllEmployeesPunchout();
    // Har 5 minute me auto-refresh
    setInterval(checkAllEmployeesPunchout, 5 * 60 * 1000);

    // --- KPI Calculation (Monthly) ---
    function getCurrentYearMonth() {
        return new Date().toISOString().slice(0, 7); // YYYY-MM
    }
    function getMonthLabel(ym) {
        try {
            const d = new Date(ym + '-01T00:00:00');
            return d.toLocaleString(undefined, { month: 'long', year: 'numeric' });
        } catch (e) { return ym; }
    }
    function computeAttendanceStats(empId, ym) {
        return db.ref('attendance').once('value').then(snapshot => {
            const data = snapshot.val() || {};
            const records = Object.values(data).filter(r => r.id == empId && r.time && r.time.slice(0,7) === ym);
            // Group by date
            const byDate = {};
            records.sort((a,b) => new Date(a.time) - new Date(b.time));
            records.forEach(r => {
                const date = new Date(r.time).toISOString().slice(0,10);
                if (!byDate[date]) byDate[date] = { in: null, out: null };
                if (r.action === 'Punch In') {
                    if (!byDate[date].in) byDate[date].in = r.time;
                } else if (r.action === 'Punch Out') {
                    byDate[date].out = r.time; // keep last seen as latest due to sort
                }
            });
            let presentDays = 0;
            let halfDays = 0;
            let totalHours = 0;
            const attendanceDates = new Set();
            Object.entries(byDate).forEach(([dateStr, day]) => {
                if (day.in && day.out) {
                    const diff = new Date(day.out) - new Date(day.in);
                    if (diff > 0) {
                        const hours = diff / (1000*60*60);
                        totalHours += hours;
                        attendanceDates.add(dateStr);
                        if (hours >= 8) presentDays += 1;
                        else if (hours >= 4) halfDays += 1; // 4-8 hours
                    }
                }
            });
            return { presentDays, halfDays, totalHours, attendanceDates };
        });
    }
    function computeLeaveDates(empId, ym) {
        // Accepted leaves from central 'leaves'
        const p1 = db.ref('leaves').once('value').then(snapshot => {
            const data = snapshot.val() || {};
            const set = new Set();
            Object.values(data).forEach(l => {
                if (!l || l.status !== 'Accepted' || l.employeeId != empId) return;
                const from = new Date(l.fromDate + 'T00:00:00');
                const to = new Date(l.toDate + 'T00:00:00');
                if (isNaN(from) || isNaN(to)) return;
                for (let d = new Date(from); d <= to; d.setDate(d.getDate()+1)) {
                    const iso = d.toISOString().slice(0,10);
                    if (iso.startsWith(ym)) set.add(iso);
                }
            });
            return set;
        });
        // Auto leaves under employees/{id}/leaves/{YYYY-MM-DD}
        const p2 = db.ref('employees/' + empId + '/leaves').once('value').then(snapshot => {
            const data = snapshot.val() || {};
            const set = new Set();
            Object.keys(data).forEach(dateStr => {
                if (dateStr && dateStr.startsWith(ym)) set.add(dateStr);
            });
            return set;
        });
        // 3) Festival/Holiday calendar-based leaves from holidays.js
        const p3 = new Promise(resolve => {
            const set = new Set();
            if (typeof window.HOLIDAYS === 'object' && Array.isArray(window.HOLIDAYS)) {
                window.HOLIDAYS.forEach(h => {
                    if (h && typeof h.date === 'string' && h.date.startsWith(ym)) set.add(h.date);
                });
            }
            resolve(set);
        });
        return Promise.all([p1, p2, p3]).then(([set1, set2, set3]) => {
            const all = new Set([...(set1||[]), ...(set2||[]), ...(set3||[])]);
            return all;
        });
    }
    function updateKPIForSelected() {
        const empId = $('#employeeId').val();
        const $container = $('#kpiContainer');
        if (!empId) { $container.hide(); return; }
        const ym = getCurrentYearMonth();
        $('#kpiMonthLabel').text(getMonthLabel(ym));
        Promise.all([
            computeAttendanceStats(empId, ym),
            computeLeaveDates(empId, ym)
        ]).then(([att, leaveSet]) => {
            // Avoid double counting leave on days that already have attendance
            let leaveDays = 0;
            if (leaveSet && leaveSet.size) {
                leaveSet.forEach(d => { if (!att.attendanceDates || !att.attendanceDates.has(d)) leaveDays++; });
            }
            $('#kpiPresentDays').text(att.presentDays || 0);
            $('#kpiHalfDays').text(att.halfDays || 0);
            $('#kpiLeaveDays').text(leaveDays);
            $('#kpiHours').text((att.totalHours || 0).toFixed(1));
            $container.show();
        }).catch(() => {
            $('#kpiPresentDays').text('-');
            $('#kpiHalfDays').text('-');
            $('#kpiLeaveDays').text('-');
            $('#kpiHours').text('-');
            $container.show();
        });
    }
    // Update KPI when employee changes or data might have changed
    $('#employeeId').on('change.kpi', updateKPIForSelected);
    // Initial KPI attempt (will run after dropdown is populated and when trigger('change') fires)
    setTimeout(updateKPIForSelected, 1000);
});

// Employee name click: auto-select in dropdown, update URL, and re-run notification logic
$(document).on('click', '.clickable-employee', function() {
    var empId = $(this).data('employee-id');
    // Set dropdown value and trigger change
    $('#employeeId').val(empId).trigger('change');
    // Disable dropdown
    $('#employeeId').prop('disabled', true);
    // Update URL with empid
    const url = new URL(window.location);
    url.searchParams.set('empid', empId);
    window.history.replaceState({}, '', url);
    // Re-run punchout notification logic for this employee
    if (typeof checkAllEmployeesPunchout === 'function') {
        checkAllEmployeesPunchout();
    }
});

// Blink effect for punch out button
function blinkPunchOutButton() {
    const btn = document.getElementById('punchOutBtn');
    if (!btn) return;
    btn.classList.add('blink-punchout');
    setTimeout(() => {
        btn.classList.remove('blink-punchout');
    }, 3000); // Blink for 3 seconds
}

// Add blink CSS if not present
if (!document.getElementById('blink-punchout-style')) {
    const style = document.createElement('style');
    style.id = 'blink-punchout-style';
    style.innerHTML = `
    .blink-punchout {
        animation: blink-punchout-anim 0.5s linear 0s 6 alternate;
    }
    @keyframes blink-punchout-anim {
        0% { background: #003F8C; color: #fff; }
        100% { background: #fff200; color: #003F8C; }
    }
    `;
    document.head.appendChild(style);
}