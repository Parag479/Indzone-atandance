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

function getAttendanceData(callback) {
    db.ref('attendance').once('value').then(snapshot => {
        const data = snapshot.val() || {};
        callback(Object.values(data));
    });
}

// Group data by Employee ID + Date
function groupData(data) {
    const grouped = {};
    data.forEach(r => {
        const dt = new Date(r.time);
        const date = dt.toISOString().slice(0, 10); // YYYY-MM-DD
        const time = dt.toLocaleTimeString(); // Only time
        const key = `${r.id}|${date}`;
        if (!grouped[key]) {
            grouped[key] = {
                id: r.id,
                name: r.name,
                date: date,
                punchIn: '',
                punchInRaw: '',
                punchInLocation: '',
                punchInLocationName: '',
                punchOut: '',
                punchOutRaw: '',
                punchOutLocation: '',
                punchOutLocationName: '',
                hoursWorked: ''
            };
        }
        if (r.action === 'Punch In') {
            grouped[key].punchIn = time;
            grouped[key].punchInRaw = r.time;
            grouped[key].punchInLocation = r.location || '';
            grouped[key].punchInLocationName = r.locationName || '';
        }
        if (r.action === 'Punch Out') {
            grouped[key].punchOut = time;
            grouped[key].punchOutRaw = r.time;
            grouped[key].punchOutLocation = r.location || '';
            grouped[key].punchOutLocationName = r.locationName || '';
            // Add reason if present (for old/accepted data)
            if (r.reason) grouped[key].reason = r.reason;
            // If reason is auto-leave for less than 4 hours, mark as leave
            if (r.reason && r.reason.toLowerCase().includes('less than 4 hours')) {
                grouped[key].isLeave = true;
                grouped[key].status = 'Leave';
            }
        }
    });
    // Calculate hours worked
    Object.values(grouped).forEach(r => {
        if (r.punchInRaw && r.punchOutRaw) {
            const inTime = new Date(r.punchInRaw);
            const outTime = new Date(r.punchOutRaw);
            const diffMs = outTime - inTime;
            if (diffMs > 0) {
                const hours = diffMs / (1000 * 60 * 60);
                r.hoursWorked = hours.toFixed(2);
                // If less than 4 hours, mark as leave (for old data without reason)
                if (hours < 4) {
                    r.isLeave = true;
                    r.status = 'Leave';
                }
            } else {
                r.hoursWorked = '';
            }
        } else {
            r.hoursWorked = '';
        }
    });
    return Object.values(grouped);
}

function getDayStatus(dateStr, hoursWorked, punchIn, punchOut) {
    const dateObj = new Date(dateStr);
    const isSunday = dateObj.getDay() === 0;
    if (isSunday) return 'Holiday';
    if (punchIn && punchOut && parseFloat(hoursWorked) >= 8) return 'Present';
    if (punchIn && punchOut && parseFloat(hoursWorked) < 8) return 'Half Day';
    return '';
}

// --- Leave System ---
function getLeaveDays(fromDate, toDate) {
    if (!fromDate || !toDate) return '';
    const from = new Date(fromDate);
    const to = new Date(toDate);
    if (isNaN(from) || isNaN(to)) return '';
    // +1 to include both start and end date
    return Math.floor((to - from) / (1000 * 60 * 60 * 24)) + 1;
}

function renderLeaveTable(leaves, isAdmin) {
    const $tbody = $('#leaveRecords');
    if ($tbody.length === 0) {
        alert('Leave table not found on page! Please check export.html markup.');
        console.error('Leave table not found: #leaveRecords');
        return;
    }
    $tbody.empty();
    console.log('Rendering leaves:', leaves.length, 'isAdmin:', isAdmin);
    if (leaves.length === 0) {
        $tbody.append('<tr><td colspan="8" style="text-align:center;color:#888;">No leave requests found.</td></tr>');
    }
    function renderRow(l, name) {
        let actionHtml = '';
        let statusBadge = '';
        if (l.status === 'Pending') statusBadge = '<span style="color:#fff;background:#E70000;padding:2px 8px;border-radius:8px;font-weight:bold;">Pending</span>';
        else if (l.status === 'Accepted') statusBadge = '<span style="color:#fff;background:#28a745;padding:2px 8px;border-radius:8px;font-weight:bold;">Accepted</span>';
        else if (l.status === 'Rejected') statusBadge = '<span style="color:#fff;background:#003F8C;padding:2px 8px;border-radius:8px;font-weight:bold;">Rejected</span>';
        if (isAdmin) {
            actionHtml = `<select class="leave-status-dropdown" data-key="${l.key}" style="padding:4px 8px;border-radius:5px;">
                <option value="Pending"${l.status==='Pending'?' selected':''}>Pending</option>
                <option value="Accepted"${l.status==='Accepted'?' selected':''}>Accepted</option>
                <option value="Rejected"${l.status==='Rejected'?' selected':''}>Rejected</option>
            </select>`;
        } else {
            actionHtml = statusBadge;
        }
        let proofHtml = l.proofUrl ? `<a href="${l.proofUrl}" target="_blank">View</a>` : '';
        let days = getLeaveDays(l.fromDate, l.toDate);
        $tbody.append(`<tr>
            <td>${l.employeeId}</td>
            <td>${name || ''}</td>
            <td>${l.fromDate || ''}</td>
            <td>${l.toDate || ''}</td>
            <td>${days}</td>
            <td>${l.reason}</td>
            <td>${proofHtml}</td>
            <td>${actionHtml}</td>
        </tr>`);
    }
    // Show real contact on button click for employee
    if (!isAdmin) {
        $tbody.off('click', '.show-contact-btn').on('click', '.show-contact-btn', function(e) {
            e.preventDefault();
            const $span = $(this).closest('.masked-contact');
            const realPhone = $span.data('phone');
            const realEmail = $span.data('email');
            const empId = $(this).closest('tr').find('td:first').text();
            const entered = prompt('Enter your Employee ID to view your contact info:');
            if (entered && entered.trim() === empId.trim()) {
                $span.html(`<span style='display:inline-block;min-width:120px;'>${realPhone}</span> <span style='display:inline-block;min-width:150px;'>${realEmail}</span> <span style='color:green;font-size:1.2em;vertical-align:middle;'>✔️</span>`);
            } else {
                alert('Incorrect Employee ID!');
            }
        });
    }
    // Admin summary table of all employee contacts
    if (isAdmin) {
        db.ref('employees').once('value').then(snapshot => {
            const data = snapshot.val() || {};
            const employees = Object.values(data);
            let html = `<div id='adminContactTable' style='margin-top:30px;'><h2>Employee Contact Info</h2><div class='table-responsive'><table class='table'><thead><tr><th>Employee ID</th><th>Name</th><th>WhatsApp</th><th>Email</th></tr></thead><tbody>`;
            employees.forEach(emp => {
            // Always decrypt and display full contact information for admin
            let whatsappVal = emp.whatsapp || '';
            let emailVal = emp.email || '';
            
            // Always decrypt if encrypted
            if (isEncrypted(whatsappVal)) whatsappVal = decrypt(whatsappVal);
            if (isEncrypted(emailVal)) emailVal = decrypt(emailVal);
            
            // For admin, show full values without any masking or encryption symbols
            html += `<tr><td>${emp.id}</td><td>${emp.name || ''}</td><td>${whatsappVal}</td><td>${emailVal}</td></tr>`;
        });
            html += '</tbody></table></div></div>';
            if ($('#adminContactTable').length) $('#adminContactTable').remove();
            $('#leaveSection').after(html);
        });
    } else {
        $('#adminContactTable').remove();
    }
    // Render all leaves, fetching name if missing
    leaves.forEach(l => {
        if (l.employeeName && l.employeeName.trim() !== '') {
            renderRow(l, l.employeeName);
        } else if (l.employeeId) {
            fetchEmployeeName(l.employeeId, function(name) {
                renderRow(l, name);
            });
        } else {
            renderRow(l, '');
        }
    });
    // Heading update
    if (isAdmin) {
        $('#leaveSection h2').last().text('All Leave Requests (Admin)');
    } else {
        $('#leaveSection h2').last().text('My Leave Requests');
    }
    // Update leave table header to remove WhatsApp, Email, and Contact columns
    $('#leaveRecords').closest('table').find('thead tr').html(`
        <th>Employee ID</th>
        <th>Name</th>
        <th>From Date</th>
        <th>To Date</th>
        <th>Days</th>
        <th>Reason</th>
        <th>Document</th>
        <th>Status/Action</th>
    `);
    // Remove contact update logic for admin
}

function fetchLeaves(callback) {
    db.ref('leaves').once('value').then(snapshot => {
        const data = snapshot.val() || {};
        // Add key for updating
        const leaves = Object.entries(data).map(([key, val]) => ({...val, key}));
        callback(leaves);
    });
}

function applyLeave(leaveObj, callback) {
    db.ref('leaves').push(leaveObj).then(callback);
}

function updateLeaveStatus(key, status, callback) {
    db.ref('leaves/' + key + '/status').set(status).then(callback);
}

function renderTable(data) {
    const grouped = groupData(data);
    const $tbody = $('#attendanceRecords tbody');
    $tbody.empty();
    // Get all unique dates in the data
    let allDates = grouped.map(r => r.date);
    // Show leave rows only for the current employee (not admin)
    if (typeof fetchLeaves === 'function' && !isAdmin) {
        let leavesCache = window._leavesCache || [];
        if (leavesCache.length === 0) {
            fetchLeaves(function(leaves) {
                window._leavesCache = leaves;
                renderTable(data); // recall with cache
            });
            return;
        }
        const user = JSON.parse(localStorage.getItem('user') || 'null');
        let leaveRows = user ? leavesCache.filter(l => l.employeeId === user.id && l.status === 'Accepted') : [];
        leaveRows.forEach(lv => {
            const from = new Date(lv.fromDate);
            const to = new Date(lv.toDate);
            for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
                const iso = d.toISOString().slice(0, 10);
                if (!allDates.includes(iso)) {
                    grouped.push({
                        date: iso,
                        name: lv.employeeName || '',
                        punchIn: '',
                        punchInRaw: '',
                        punchInLocation: '',
                        punchInLocationName: '',
                        punchOut: '',
                        punchOutRaw: '',
                        punchOutLocation: '',
                        punchOutLocationName: '',
                        hoursWorked: '',
                        status: 'Leave',
                        isLeave: true,
                        employeeId: lv.employeeId
                    });
                    allDates.push(iso);
                }
            }
        });
    }
    // If viewing as employee, fill missing Sundays for the month
    if (allDates.length > 0) {
        const minDate = new Date(Math.min(...allDates.map(d => new Date(d))));
        const maxDate = new Date(Math.max(...allDates.map(d => new Date(d))));
        let date = new Date(minDate);
        while (date <= maxDate) {
            const iso = date.toISOString().slice(0, 10);
            if (!allDates.includes(iso) && date.getDay() === 0) {
                // Insert a Sunday holiday row
                grouped.push({
                    date: iso,
                    name: '',
                    punchIn: '',
                    punchInRaw: '',
                    punchInLocation: '',
                    punchInLocationName: '',
                    punchOut: '',
                    punchOutRaw: '',
                    punchOutLocation: '',
                    punchOutLocationName: '',
                    hoursWorked: '',
                    status: 'Holiday',
                    isHoliday: true
                });
                allDates.push(iso);
            }
            date.setDate(date.getDate() + 1);
        }
    }
    // Sort by date ascending
    grouped.sort((a, b) => new Date(a.date) - new Date(b.date));
    grouped.forEach(r => {
        const isSunday = new Date(r.date).getDay() === 0;
        const status = r.isHoliday ? 'Holiday' : (r.isLeave ? 'Leave' : getDayStatus(r.date, r.hoursWorked, r.punchIn, r.punchOut));
        // Make employee name clickable for admin
        let employeeNameCell = r.name || '';
        if (isAdmin && r.id) {
            employeeNameCell = `<span class="clickable-employee" data-employee-id="${r.id}" style="cursor:pointer;color:#003F8C;text-decoration:underline;">${r.name || ''}</span>`;
        }
        // Compose location name with locality
        const punchInLocality = isSunday || r.isLeave ? '' : extractLocality(r.punchInLocationName);
        const punchOutLocality = isSunday || r.isLeave ? '' : extractLocality(r.punchOutLocationName);
        const punchInLocationNameDisplay = (isSunday || r.isLeave) ? '' : (r.punchInLocationName ? `${r.punchInLocationName}${punchInLocality ? ' (' + punchInLocality + ')' : ''}` : '');
        const punchOutLocationNameDisplay = (isSunday || r.isLeave) ? '' : (r.punchOutLocationName ? `${r.punchOutLocationName}${punchOutLocality ? ' (' + punchOutLocality + ')' : ''}` : '');
        // Show reason if present and this is a punch out row
        const reasonCell = r.reason ? r.reason : '';
        if (r.isLeave && (!r.name || r.name.trim() === '') && r.employeeId) {
            fetchEmployeeName(r.employeeId, function(name) {
                let nameCell = name || '';
                if (isAdmin && r.employeeId) {
                    nameCell = `<span class="clickable-employee" data-employee-id="${r.employeeId}" style="cursor:pointer;color:#003F8C;text-decoration:underline;">${name || ''}</span>`;
                }
                $tbody.append(`<tr>
                    <td data-label="Date">${r.date}</td>
                    <td data-label="Employee Name">${nameCell}</td>
                    <td data-label="Punch In Time">${isSunday || r.isLeave ? '' : r.punchIn}</td>
                    <td data-label="Punch In Location">${isSunday || r.isLeave ? '' : r.punchInLocation}</td>
                    <td data-label="Punch In Location Name">${punchInLocationNameDisplay}</td>
                    <td data-label="Punch Out Time">${isSunday || r.isLeave ? '' : r.punchOut}</td>
                    <td data-label="Punch Out Location">${isSunday || r.isLeave ? '' : r.punchOutLocation}</td>
                    <td data-label="Punch Out Location Name">${punchOutLocationNameDisplay}</td>
                    <td data-label="Hours Worked">${isSunday || r.isLeave ? '' : r.hoursWorked}</td>
                    <td data-label="Status">${status}</td>
                    <td data-label="Reason"></td>
                </tr>`);
            });
        } else {
            $tbody.append(`<tr>
                <td data-label="Date">${r.date}</td>
                <td data-label="Employee Name">${employeeNameCell}</td>
                <td data-label="Punch In Time">${isSunday || r.isLeave ? '' : r.punchIn}</td>
                <td data-label="Punch In Location">${isSunday || r.isLeave ? '' : r.punchInLocation}</td>
                <td data-label="Punch In Location Name">${punchInLocationNameDisplay}</td>
                <td data-label="Punch Out Time">${isSunday || r.isLeave ? '' : r.punchOut}</td>
                <td data-label="Punch Out Location">${isSunday || r.isLeave ? '' : r.punchOutLocation}</td>
                <td data-label="Punch Out Location Name">${punchOutLocationNameDisplay}</td>
                <td data-label="Hours Worked">${isSunday || r.isLeave ? '' : r.hoursWorked}</td>
                <td data-label="Status">${status}</td>
                <td data-label="Reason">${reasonCell}</td>
            </tr>`);
        }
    });
    // Add click handler for employee names (admin only)
    if (isAdmin) {
        $(document).off('click', '.clickable-employee').on('click', '.clickable-employee', function() {
            const employeeId = $(this).data('employee-id');
            const employeeName = $(this).text();
            // Filter data for this employee
            getAttendanceData(function(allData) {
                const filteredData = allData.filter(r => r.id === employeeId);
                renderTable(filteredData);
                // Update heading
                $('#attendanceRecords h2').text(`Attendance Records - ${employeeName}`);
                // Add "Show All" button if not present
                if ($('#showAllBtn').length === 0) {
                    $('<button id="showAllBtn" style="margin:10px 0;">Show All Employees</button>').insertBefore('#attendanceRecords .table-responsive');
                }
                $('#showAllBtn').off('click').on('click', function() {
                    renderTable(allData);
                    $('#attendanceRecords h2').text('All Attendance Records');
                    $(this).remove();
                });
            });
        });
    }
}

let currentEmployeeId = null;
let isAdmin = false;
const ADMIN_PASSWORD = 'admininz@123'; // Change this to your desired admin password

let employeeNameMap = {};

function fetchEmployeeName(id, callback) {
    if (employeeNameMap[id]) return callback(employeeNameMap[id]);
    db.ref('employees/' + id).once('value').then(snapshot => {
        const data = snapshot.val();
        if (data && data.name) {
            employeeNameMap[id] = data.name;
            callback(data.name);
        } else {
            callback('');
        }
    });
}

function setUserInfoBar(id, name) {
    $('#userInfoBar').text(`ID: ${id} | Name: ${name}`).show();
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
    // btoa output is base64, so only A-Za-z0-9+/= allowed, and usually longer than 6 chars
    return /^[A-Za-z0-9+/=]{8,}$/.test(str);
}

// Helper to mask all but last 3 digits of a phone number
function maskPhoneLast3(phone) {
    if (!phone) return '';
    // Remove non-digits for masking, but keep original for display
    const digits = phone.replace(/\D/g, '');
    if (digits.length <= 3) return phone;
    const masked = '*'.repeat(digits.length - 3) + digits.slice(-3);
    // If original had +91 or similar, preserve prefix
    const prefixMatch = phone.match(/^(\+\d{1,3}\s?)/);
    const prefix = prefixMatch ? prefixMatch[1] : '';
    return prefix + masked;
}

// Helper to mask email: first char, then stars, then last 3 before @, then domain
function maskEmailPartial(email) {
    if (!email) return '';
    const [user, domain] = email.split('@');
    if (!user || !domain || user.length <= 4) return email;
    return user[0] + '*'.repeat(user.length - 4) + user.slice(-3) + '@' + domain;
}

// Helper to extract locality from locationName string
function extractLocality(locationName) {
    if (!locationName) return '';
    const parts = locationName.split(',').map(s => s.trim());
    // Try to find a part that looks like a locality (e.g., ends with 'West', 'East', or is a known area)
    // Prefer the 2nd or 3rd from last, as OSM usually puts locality there
    // Try to match suburb, town, village, city as a full word
    // We'll just pick the 2nd or 3rd from last as best guess
    if (parts.length >= 3) {
        // Try to find a part that is not state/country
        for (let i = parts.length - 3; i >= 0; i--) {
            const p = parts[i];
            // Skip if looks like state or country
            if (/india|maharashtra|uttar pradesh|delhi|haryana|gujarat|bihar|west bengal|karnataka|tamil nadu|rajasthan|madhya pradesh|punjab|kerala|country|state/i.test(p)) continue;
            // Prefer if ends with 'West', 'East', etc. or is a known locality pattern
            if (/\b(west|east|north|south)\b/i.test(p) || p.split(' ').length <= 3) {
                return p;
            }
        }
        // Fallback: 3rd from end
        return parts[parts.length - 3];
    }
    return parts[0] || '';
}

// --- Admin Approval Panel for Pending Punch Outs ---
function renderPendingPunchOuts() {
    const $panel = $('#pendingPunchOutPanel');
    $panel.empty();
    if (!isAdmin) {
        $panel.hide();
        return;
    } else {
        $panel.show();
    }
    $panel.append('<h2>Pending Early Punch Out Requests</h2>');
    $panel.append('<table id="pendingTable" class="styled-punchout-table"><thead><tr><th>Employee ID</th><th>Name</th><th>Reason</th><th>Time</th><th>Action</th></tr></thead><tbody></tbody></table>');
    const $tbody = $panel.find('tbody');
    firebase.database().ref('pending_punchout').on('value', function(snapshot) {
        $tbody.empty();
        const data = snapshot.val() || {};
        Object.entries(data).forEach(([key, req]) => {
            $tbody.append(`<tr>
                <td>${req.id}</td>
                <td>${req.name}</td>
                <td>${req.reason}</td>
                <td>${new Date(req.time).toLocaleString()}</td>
                <td>
                    <button class="approve-btn" data-key="${key}">Approve</button>
                    <button class="reject-btn" data-key="${key}">Reject</button>
                </td>
            </tr>`);
        });
    });
}

function renderMyPunchOutRequests(employeeId) {
    const $panel = $('#myPunchOutPanel');
    $panel.empty();
    $panel.append('<h2>My Early Punch Out Requests</h2>');
    $panel.append('<table id="myPunchOutTable" class="styled-punchout-table"><thead><tr><th>Reason</th><th>Time</th><th>Status</th></tr></thead><tbody></tbody></table>');
    const $tbody = $panel.find('tbody');
    // Fetch pending requests
    firebase.database().ref('pending_punchout').orderByChild('id').equalTo(employeeId).on('value', function(snapshot) {
        $tbody.empty();
        const data = snapshot.val() || {};
        Object.values(data).forEach(req => {
            $tbody.append(`<tr>
                <td>${req.reason}</td>
                <td>${new Date(req.time).toLocaleString()}</td>
                <td><span style="color:#E70000;font-weight:bold;">Pending</span></td>
            </tr>`);
        });
        // Fetch approved from attendance (with reason)
        firebase.database().ref('attendance').orderByChild('id').equalTo(employeeId).once('value').then(snap => {
            const attData = snap.val() || {};
            Object.values(attData).forEach(r => {
                if (r.action === 'Punch Out' && r.reason) {
                    $tbody.append(`<tr>
                        <td>${r.reason}</td>
                        <td>${new Date(r.time).toLocaleString()}</td>
                        <td><span style="color:#28a745;font-weight:bold;">Approved</span></td>
                    </tr>`);
                }
            });
        });
    });
}

// Add CSS for styled-punchout-table
if (!document.getElementById('styledPunchoutTableCSS')) {
    const style = document.createElement('style');
    style.id = 'styledPunchoutTableCSS';
    style.innerHTML = `
    .styled-punchout-table {
        width: 100%;
        border-collapse: collapse;
        margin: 18px 0 24px 0;
        background: #f8f9fa;
        box-shadow: 0 2px 8px #e0e6f1;
    }
    .styled-punchout-table th, .styled-punchout-table td {
        border: 1px solid #d1dbe6;
        padding: 10px 14px;
        text-align: left;
    }
    .styled-punchout-table th {
        background: #003F8C;
        color: #fff;
        font-weight: bold;
    }
    .styled-punchout-table tr:nth-child(even) {
        background: #f0f4fa;
    }
    .styled-punchout-table tr:nth-child(odd) {
        background: #fff;
    }
    .styled-punchout-table button {
        padding: 5px 12px;
        border-radius: 5px;
        border: none;
        margin-right: 6px;
        font-weight: bold;
        cursor: pointer;
    }
    .styled-punchout-table .approve-btn {
        background: #28a745;
        color: #fff;
    }
    .styled-punchout-table .reject-btn {
        background: #E70000;
        color: #fff;
    }
    `;
    document.head.appendChild(style);
}

// Floating notification utility
function showFloatingNotification(message) {
    if ($('#floatingNotification').length) $('#floatingNotification').remove();
    $('body').append(`<div id="floatingNotification" style="position:fixed; bottom:30px; left:50%; transform:translateX(-50%); background:#003F8C; color:#fff; padding:16px 32px; border-radius:8px; box-shadow:0 2px 16px #0005; font-size:18px; z-index:99999; display:flex; align-items:center;"><span>${message}</span><button id="closeFloatingNotification" style="margin-left:20px; background:transparent; border:none; color:#fff; font-size:20px; cursor:pointer;">&times;</button></div>`);
    $('#closeFloatingNotification').click(function() { $('#floatingNotification').fadeOut(200, function() { $(this).remove(); }); });
}

// --- Admin Panel: List all employees with 8+ hours punch-in and no punch-out ---
function renderOverduePunchOuts() {
    if (!isAdmin) return;
    db.ref('attendance').once('value').then(snapshot => {
        const data = snapshot.val() || {};
        const records = Object.values(data);
        const now = new Date();
        const pending = {};
        records.forEach(r => {
            if (!pending[r.id]) pending[r.id] = {name: r.name, lastPunchIn: null, lastPunchOut: null};
            if (r.action === 'Punch In') pending[r.id].lastPunchIn = r;
            if (r.action === 'Punch Out') pending[r.id].lastPunchOut = r;
        });
        const late = [];
        Object.keys(pending).forEach(id => {
            const p = pending[id];
            if (p.lastPunchIn && (!p.lastPunchOut || new Date(p.lastPunchIn.time) > new Date(p.lastPunchOut.time))) {
                const inTime = new Date(p.lastPunchIn.time);
                const hours = (now - inTime) / (1000 * 60 * 60);
                if (hours >= 8) {
                    late.push({id, name: p.name, since: inTime.toLocaleString()});
                }
            }
        });
        let html = '<h3>Employees Not Punched Out (8+ hours)</h3>';
        if (late.length === 0) {
            html += '<div style="color:green;">No overdue punch outs!</div>';
        } else {
            html += '<div class="tablet-frame"><div class="scrollable-table"><table border="1" style="width:100%;margin-bottom:20px;"><tr><th>Employee ID</th><th>Name</th><th>Punch In Time</th><th>Send Reminder</th><th>Email Reminder</th></tr>';
            late.forEach(emp => {
                html += `<tr>
                    <td>${emp.id}</td>
                    <td>${emp.name}</td>
                    <td>${emp.since}</td>
                    <td><button class="send-reminder-btn" data-empid="${emp.id}" data-name="${emp.name}">Send Reminder</button></td>
                    <td><button class="send-email-reminder-btn" data-empid="${emp.id}" data-name="${emp.name}">Send Email Reminder</button></td>
                </tr>`;
            });
            html += '</table></div></div>';
        }
        if ($('#overduePunchOutPanel').length === 0) {
            $('<div id="overduePunchOutPanel" style="margin:30px 0;"></div>').insertBefore('#pendingPunchOutPanel');
        }
        $('#overduePunchOutPanel').html(html);

        // --- Inject tablet frame and scroll CSS if not present ---
        if (!document.getElementById('tabletFrameCSS')) {
            const style = document.createElement('style');
            style.id = 'tabletFrameCSS';
            style.innerHTML = `
            .tablet-frame {
                max-width: 700px;
                margin: 0 auto 24px auto;
                background: #f4f6fa;
                border-radius: 32px;
                box-shadow: 0 8px 32px #003f8c22, 0 1.5px 8px #003f8c11;
                padding: 32px 18px 32px 18px;
                border: 4px solid #e0e6f1;
                position: relative;
            }
            .tablet-frame:before {
                content: '';
                display: block;
                position: absolute;
                top: 16px; left: 50%;
                transform: translateX(-50%);
                width: 60px; height: 6px;
                background: #d1dbe6;
                border-radius: 3px;
                opacity: 0.7;
            }
            .scrollable-table {
                max-height: 400px;
                overflow-y: auto;
                border-radius: 18px;
                background: #fff;
                box-shadow: 0 2px 8px #e0e6f1;
                padding: 0;
            }
            .scrollable-table table {
                margin-bottom: 0 !important;
                border-radius: 18px;
                overflow: hidden;
            }
            `;
            document.head.appendChild(style);
        }

        // --- Automatic Email Reminders ---
        late.forEach(emp => {
            sendEmailReminderIfNotSent(emp.id, emp.name);
        });
    });
}

$(document).ready(function() {
    // Always request notification permission on page load if not already granted or denied
    if (window.Notification && Notification.permission !== "granted" && Notification.permission !== "denied") {
        Notification.requestPermission();
    }
    // Prompt for Employee ID at page load
    currentEmployeeId = prompt('Enter your Employee ID to view your attendance:');
    if (!currentEmployeeId) {
        alert('Employee ID is required!');
        $('.container').hide();
        return;
    }
    // Admin logic: if ID is 'admin', prompt for password
    isAdmin = currentEmployeeId.trim().toLowerCase() === 'admin';
    if (isAdmin) {
        const enteredPassword = prompt('Enter admin password:');
        if (enteredPassword !== ADMIN_PASSWORD) {
            alert('Incorrect admin password!');
            $('.container').hide();
            return;
        }
    }
    getAttendanceData(function(allData) {
        if (isAdmin) {
            renderTable(allData);
            $('#exportAllBtn').show();
        } else {
            const myData = allData.filter(r => r.id === currentEmployeeId);
            renderTable(myData);
            $('#exportAllBtn').hide();
        }
        // Always load leaves after attendance table
        loadLeaves();
        $('#exportFilterBtn').click(function() {
            const filterMonth = prompt('Enter Month (YYYY-MM) to export (leave blank for all):');
            const filterYear = prompt('Enter Year (YYYY) to export (leave blank for all):');
            let filtered;
            if (isAdmin) {
                filtered = allData;
            } else {
                filtered = allData.filter(record => record.id === currentEmployeeId);
            }
            filtered = filtered.filter(record => {
                let match = true;
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
            const grouped = groupData(filtered);
            if (grouped.length === 0) {
                alert('No data to export!');
                return;
            }
            let rows = [
                ['Date', 'Employee Name', 'Punch In Time', 'Punch Out Time', 'Location', 'Location Name', 'Hours Worked', 'Status'],
                ...grouped.map(r => [r.date, r.name, r.punchIn, r.punchOut, r.location, r.locationName, r.hoursWorked, getDayStatus(r.date, r.hoursWorked, r.punchIn, r.punchOut)])
            ];
            let worksheet = XLSX.utils.aoa_to_sheet(rows);
            let workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance');
            XLSX.writeFile(workbook, 'attendance_filtered.xlsx');
        });
        // Only admin can export all data
        $('#exportAllBtn').off('click').click(function() {
            if (!isAdmin) return;
            const grouped = groupData(allData);
            if (grouped.length === 0) {
                alert('No data to export!');
                return;
            }
            // Only export attendance rows, not leave rows
            let rows = [
                ['Date', 'Employee Name', 'Punch In Time', 'Punch Out Time', 'Location', 'Location Name', 'Hours Worked', 'Status']
            ];
            grouped.forEach(r => {
                if (r.isLeave) return; // skip leave rows
                rows.push([
                    r.date,
                    r.name || '',
                    r.punchIn || '',
                    r.punchOut || '',
                    r.location || '',
                    r.locationName || '',
                    r.hoursWorked || '',
                    r.isHoliday ? 'Holiday' : getDayStatus(r.date, r.hoursWorked, r.punchIn, r.punchOut)
                ]);
            });
            let worksheet = XLSX.utils.aoa_to_sheet(rows);
            let workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance');
            XLSX.writeFile(workbook, 'attendance_all.xlsx');
        });
    });

    // After login, show user info bar
    if (isAdmin) {
        setUserInfoBar('admin', 'Admin');
    } else {
        fetchEmployeeName(currentEmployeeId, function(empName) {
            setUserInfoBar(currentEmployeeId, empName || '');
            // Set user object in localStorage for later use
            localStorage.setItem('user', JSON.stringify({ id: currentEmployeeId, name: empName || '' }));
        });
    }

    // Leave form submit
    $('#leaveForm').off('submit').on('submit', function(e) {
        e.preventDefault();
        const fromDate = $('#leaveFrom').val();
        const toDate = $('#leaveTo').val();
        const reason = $('#leaveReason').val();
        const fileInput = $('#leaveProof')[0];
        if (!fromDate || !toDate || !reason) return alert('All fields required!');
        // Prevent duplicate leave for same date range
        fetchLeaves(function(leaves) {
            const userLeaves = leaves.filter(l => l.employeeId === currentEmployeeId);
            const overlap = userLeaves.some(l => {
                // Check if date ranges overlap
                const lFrom = new Date(l.fromDate);
                const lTo = new Date(l.toDate);
                const fFrom = new Date(fromDate);
                const fTo = new Date(toDate);
                return (
                    (fFrom <= lTo && fTo >= lFrom)
                );
            });
            if (overlap) {
                alert('You have already applied for leave in this date range.');
                return;
            }
            fetchEmployeeName(currentEmployeeId, function(empName) {
                // Handle file upload if present
                const file = fileInput && fileInput.files && fileInput.files[0];
                if (file) {
                    const storageRef = firebase.storage().ref('leaveProofs/' + Date.now() + '_' + file.name);
                    storageRef.put(file).then(snapshot => {
                        snapshot.ref.getDownloadURL().then(url => {
                            saveLeave(empName, url);
                        });
                    });
                } else {
                    saveLeave(empName, '');
                }
                function saveLeave(empName, proofUrl) {
                    const leaveObj = {
                        employeeId: currentEmployeeId,
                        employeeName: empName,
                        fromDate,
                        toDate,
                        reason,
                        proofUrl,
                        status: 'Pending',
                        appliedAt: new Date().toISOString()
                    };
                    applyLeave(leaveObj, function() {
                        alert('Leave applied!');
                        $('#leaveForm')[0].reset();
                        loadLeaves(); // Always reload leaves for both admin and employee
                    });
                }
            });
        });
    });

    function loadLeaves() {
        fetchLeaves(function(leaves) {
            // Admin sees all, employee sees only own
            let displayLeaves = leaves;
            if (!isAdmin) {
                displayLeaves = leaves.filter(l => l.employeeId === currentEmployeeId);
            }
            console.log('Rendering leaves:', displayLeaves.length, 'isAdmin:', isAdmin);
            renderLeaveTable(displayLeaves, isAdmin);
            showCurrentLeaveNotice(displayLeaves);
        });
    }

    // Initial load of leave table
    // loadLeaves(); // This line is removed as per the edit hint.

    // Accept/Reject leave (admin only) replaced with dropdown
    $(document).off('change', '.leave-status-dropdown').on('change', '.leave-status-dropdown', function() {
        const key = $(this).data('key');
        const newStatus = $(this).val();
        updateLeaveStatus(key, newStatus, function() {
            alert('Leave status updated to ' + newStatus);
            loadLeaves();
        });
    });

    // Hide admin-only elements for non-admins
    if (!isAdmin) {
        $('.admin-only').hide();
    } else {
        $('.admin-only').show();
    }

    // Show/hide leave form based on admin
    if (!isAdmin) {
        $('#leaveForm').show();
    } else {
        $('#leaveForm').hide();
    }

    function isCurrentLeave(leave) {
        if (leave.status !== 'Accepted') return false;
        if (!leave.fromDate || !leave.toDate) return false;
        const today = new Date();
        const from = new Date(leave.fromDate);
        const to = new Date(leave.toDate);
        return today >= from && today <= to;
    }

    function showCurrentLeaveNotice(leaves) {
        if (isAdmin) {
            $('#currentLeaveNotice').hide();
            return;
        }
        const active = leaves.find(isCurrentLeave);
        if (active) {
            $('#currentLeaveNotice').text(`You are on leave from ${active.fromDate} to ${active.toDate} (${getLeaveDays(active.fromDate, active.toDate)} days).`).show();
        } else {
            $('#currentLeaveNotice').hide();
        }
    }

    // Add Export Leave Data button if not present
    if ($('#exportLeaveBtn').length === 0) {
        $('<button id="exportLeaveBtn" class="admin-only" style="margin:10px 0 20px 0;">Export Leave Data</button>')
            .insertBefore($('#leaveSection .table-responsive'));
    }
    // Export Leave Data logic
    $('#exportLeaveBtn').off('click').on('click', function() {
        fetchLeaves(function(leaves) {
            if (!leaves || leaves.length === 0) {
                alert('No leave data to export!');
                return;
            }
            let rows = [
                ['Employee ID', 'Employee Name', 'From Date', 'To Date', 'Days', 'Reason', 'Document URL', 'Status', 'Applied At']
            ];
            leaves.forEach(l => {
                // Calculate days
                let days = getLeaveDays(l.fromDate, l.toDate);
                rows.push([
                    l.employeeId || '',
                    l.employeeName || '',
                    l.fromDate || '',
                    l.toDate || '',
                    days,
                    l.reason || '',
                    l.proofUrl || '',
                    l.status || '',
                    l.appliedAt || ''
                ]);
            });
            let worksheet = XLSX.utils.aoa_to_sheet(rows);
            let workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Leave Data');
            XLSX.writeFile(workbook, 'leave_data.xlsx');
        });
    });

    // Add EmailJS for email notifications
    (function(){
        emailjs.init("pR0GeazBW-YCli6Y-"); // User's actual EmailJS User ID
    })();
    
    // Function to send notifications
    function sendPunchOutNotifications(employeeId, employeeName) {
        // Get employee details from Firebase
        db.ref('employees/' + employeeId).once('value').then(snapshot => {
            const employee = snapshot.val();
            if (!employee) return;
            
            // Send WhatsApp message (opens WhatsApp with pre-filled message)
            if (employee.whatsapp) {
                const message = `Hi ${employeeName}, you have successfully punched out. Thank you!`;
                const whatsappUrl = `https://wa.me/${employee.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
                window.open(whatsappUrl, '_blank');
            }
            
            // Send email notification
            if (employee.email) {
                const templateParams = {
                    to_email: employee.email,
                    to_name: employeeName,
                    message: `Hi ${employeeName}, you have successfully punched out. Thank you!`
                };
                
                emailjs.send('service_nlk542o', 'template_fyvulbh', templateParams)
                    .then(function(response) {
                        console.log('Email sent successfully:', response);
                    }, function(error) {
                        console.log('Email failed:', error);
                    });
            }
        });
    }
    
    // Update Punch Out to send notifications
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
                addAttendance({
                    id: employeeId,
                    name: employeeName,
                    action: 'Punch Out',
                    time: timestamp.toISOString(),
                    location: location,
                    locationName: locationName
                }).then(() => {
                    alert('Punched Out Successfully!');
                    // After OK, redirect to index.html
                    window.location.href = 'index.html';
                    $('#employeeId').val('');
                    $('#employeeName').val('');
                    setPunchButtons(true);
                    clearStatus();
                    // Clear Punch Out notification timer
                    clearPunchOutNotification();
                    // Send WhatsApp/Email notifications
                    sendPunchOutNotifications(employeeId, employeeName);
                });
            });
        } else {
            alert('Please select Employee.');
        }
    });

    // Show Edit Profile section for employee (not admin)
    if (!isAdmin) {
        // Use the currentEmployeeId set at login
        const empId = currentEmployeeId;
        if (empId) {
            db.ref('employees/' + empId).once('value').then(snapshot => {
                const emp = snapshot.val();
                if (emp) {
                    // Show encrypted value by default
                    $('#editWhatsapp').val(emp.whatsapp || '');
                    $('#editEmail').val(emp.email || '');
                    // Add Show buttons if not present
                    if ($('#showWhatsappBtn').length === 0) {
                        $('<button type="button" id="showWhatsappBtn" style="margin-left:8px;">Show</button>').insertAfter('#editWhatsapp');
                    }
                    if ($('#showEmailBtn').length === 0) {
                        $('<button type="button" id="showEmailBtn" style="margin-left:8px;">Show</button>').insertAfter('#editEmail');
                    }
                    // Show green check if both fields are filled
                    if ((emp.whatsapp && emp.whatsapp.trim() !== '') && (emp.email && emp.email.trim() !== '')) {
                        $('#profileUpdateSuccess').show();
                    } else {
                        $('#profileUpdateSuccess').hide();
                    }
                }
            });
        }
        // Show/decrypt on button click with Employee ID check
        $(document).off('click', '#showWhatsappBtn').on('click', '#showWhatsappBtn', function() {
            const entered = prompt('Enter your Employee ID to view your WhatsApp:');
            if (entered && entered.trim() === currentEmployeeId.trim()) {
                const val = $('#editWhatsapp').val();
                $('#editWhatsapp').val(decrypt(val));
                $(this).remove();
            } else {
                alert('Incorrect Employee ID!');
            }
        });
        $(document).off('click', '#showEmailBtn').on('click', '#showEmailBtn', function() {
            const entered = prompt('Enter your Employee ID to view your Email:');
            if (entered && entered.trim() === currentEmployeeId.trim()) {
                const val = $('#editEmail').val();
                $('#editEmail').val(decrypt(val));
                $(this).remove();
            } else {
                alert('Incorrect Employee ID!');
            }
        });
        $('#editProfileForm').submit(function(e) {
            e.preventDefault();
            if (!empId) return;
            let whatsapp = $('#editWhatsapp').val().trim();
            let email = $('#editEmail').val().trim();
            // Save as plain text (unencrypted)
            db.ref('employees/' + empId).update({ whatsapp, email }).then(() => {
                $('#profileUpdateSuccess').show();
                setTimeout(() => $('#profileUpdateSuccess').fadeOut(500), 2000);
            });
        });
    } else {
        // Admin sees decrypted value without any masking
        const empId = currentEmployeeId;
        if (empId) {
            db.ref('employees/' + empId).once('value').then(snapshot => {
                const emp = snapshot.val();
                if (emp) {
                    // Always decrypt for admin without any masking
                    let whatsappVal = emp.whatsapp || '';
                    let emailVal = emp.email || '';
                    
                    // Always decrypt if encrypted
                    if (isEncrypted(whatsappVal)) whatsappVal = decrypt(whatsappVal);
                    if (isEncrypted(emailVal)) emailVal = decrypt(emailVal);
                    
                    $('#editWhatsapp').val(whatsappVal);
                    $('#editEmail').val(emailVal);
                    $('#editProfileSection').show();
                    if (whatsappVal.trim() !== '' && emailVal.trim() !== '') {
                        $('#profileUpdateSuccess').show();
                    } else {
                        $('#profileUpdateSuccess').hide();
                    }
                }
            });
        }
    }

    // Add/Edit Contact Info section
    $('#editContactInfoSection').remove(); // Remove any existing section to avoid duplicates
    
    if (isAdmin) {
        // For admin, show decrypted contact info without masking
        if (currentEmployeeId) {
            db.ref('employees/' + currentEmployeeId).once('value').then(snapshot => {
                const emp = snapshot.val();
                if (emp) {
                    // Always decrypt values for admin
                    let whatsappVal = emp.whatsapp || '';
                    let emailVal = emp.email || '';
                    
                    // Always decrypt if encrypted
                    if (isEncrypted(whatsappVal)) whatsappVal = decrypt(whatsappVal);
                    if (isEncrypted(emailVal)) emailVal = decrypt(emailVal);
                    
                    const html = `
                <div id="editContactInfoSection" style="margin: 0 auto;padding:18px 24px;background:#f8f9fa;border-radius:8px;max-width:400px;">
                    <h3>Employee Contact Info (Admin View)</h3>
                    <form id="editContactInfoForm">
                        <label>WhatsApp Number:</label>
                        <input type="text" id="editContactWhatsapp" style="margin-bottom:8px;width:220px;" value="${whatsappVal}" placeholder="e.g. +91 98765 43210">
                        <br>
                        <label>Email:</label>
                        <input type="text" id="editContactEmail" style="margin-bottom:8px;width:220px;" value="${emailVal}" placeholder="e.g. rahul@company.com">
                        <br>
                        <button type="submit" style="margin-top:10px;">Save</button>
                    </form>
                    <div id="editContactSuccess" style="color:green;display:none;margin-top:8px;">Contact info updated!</div>
                </div>`;
                    $('#leaveSection').before(html);
                    
                    // On submit, encrypt and update
                    $('#editContactInfoForm').off('submit').on('submit', function(e) {
                        e.preventDefault();
                        const whatsapp = $('#editContactWhatsapp').val().trim();
                        const email = $('#editContactEmail').val().trim();
                        // Save as plain text (not encrypted)
                        db.ref('employees/' + currentEmployeeId).update({
                            whatsapp: whatsapp,
                            email: email
                        }).then(() => {
                            $('#editContactSuccess').show();
                            setTimeout(() => $('#editContactSuccess').fadeOut(500), 2000);
                        });
                    });
                }
            });
        }
    } else {
        // For regular employees, show masked contact info with show buttons
        db.ref('employees/' + currentEmployeeId).once('value').then(snapshot => {
            const emp = snapshot.val();
            // Show section if WhatsApp or Email is missing, or always allow update
            const html = `
        <div id="editContactInfoSection" style="margin: 0 auto;padding:18px 24px;background:#f8f9fa;border-radius:8px;max-width:400px;">
            <h3>Edit Contact Info</h3>
            <form id="editContactInfoForm">
                <label>WhatsApp Number:</label>
                <input type="text" id="editContactWhatsapp" style="margin-bottom:8px;width:220px;" placeholder="e.g. +91 98765 43210" readonly>
                <button type="button" id="showWhatsappBtn" style="margin-left:8px;">Show</button><br>
                <label>Email:</label>
                <input type="text" id="editContactEmail" style="margin-bottom:8px;width:220px;" placeholder="e.g. rahul@company.com" readonly>
                <button type="button" id="showEmailBtn" style="margin-left:8px;">Show</button><br>
                <span id="contactCheckIcon" style="display:none;color:green;font-size:1.5em;vertical-align:middle;">✔️</span>
                <button type="submit" style="margin-top:10px;">Save</button>
            </form>
            <div id="editContactSuccess" style="color:green;display:none;margin-top:8px;">Contact info updated!</div>
        </div>`;
            $('#leaveSection').before(html);
            // Show encrypted by default
            $('#editContactWhatsapp').val(emp && emp.whatsapp ? maskPhoneLast3(isEncrypted(emp.whatsapp) ? decrypt(emp.whatsapp) : emp.whatsapp) : '').attr('placeholder', 'e.g. +91 98765 43210');
            $('#editContactEmail').val(emp && emp.email ? maskEmailPartial(isEncrypted(emp.email) ? decrypt(emp.email) : emp.email) : '').attr('placeholder', 'e.g. rahul@company.com');
            // Show button logic
            $(document).off('click', '#showWhatsappBtn').on('click', '#showWhatsappBtn', function() {
                $('#editContactWhatsapp').val(emp && emp.whatsapp ? (isEncrypted(emp.whatsapp) ? decrypt(emp.whatsapp) : emp.whatsapp) : '').prop('readonly', false).attr('placeholder', 'e.g. +91 98765 43210');
                $(this).remove();
                checkContactFields();
            });
            $(document).off('click', '#showEmailBtn').on('click', '#showEmailBtn', function() {
                $('#editContactEmail').val(emp && emp.email ? (isEncrypted(emp.email) ? decrypt(emp.email) : emp.email) : '').prop('readonly', false).attr('placeholder', 'e.g. rahul@company.com');
                $(this).remove();
                checkContactFields();
            });
            // On input, check for green check
            $('#editContactWhatsapp, #editContactEmail').on('input', checkContactFields);
            function checkContactFields() {
                const w = $('#editContactWhatsapp').val().trim();
                const e = $('#editContactEmail').val().trim();
                if (w && e && $('#editContactWhatsapp').prop('readonly') === false && $('#editContactEmail').prop('readonly') === false) {
                    $('#contactCheckIcon').show();
                } else {
                    $('#contactCheckIcon').hide();
                }
            }
            // On submit, encrypt and update, then revert to encrypted view
            $('#editContactInfoForm').off('submit').on('submit', function(e) {
                e.preventDefault();
                const whatsapp = $('#editContactWhatsapp').val().trim();
                const email = $('#editContactEmail').val().trim();
                // Save as plain text (not encrypted)
                db.ref('employees/' + currentEmployeeId).update({
                    whatsapp: whatsapp,
                    email: email
                }).then(() => {
                    $('#editContactSuccess').show();
                    setTimeout(() => $('#editContactSuccess').fadeOut(500), 2000);
                    // After update, revert to static green check if both present
                    $('#editContactWhatsapp').val(whatsapp ? whatsapp : '').prop('readonly', true).attr('placeholder', 'e.g. +91 98765 43210');
                    $('#editContactEmail').val(email ? email : '').prop('readonly', true).attr('placeholder', 'e.g. rahul@company.com');
                    if (whatsapp && email) {
                        $('#contactCheckIcon').show();
                    } else {
                        $('#contactCheckIcon').hide();
                    }
                    // Re-add Show buttons if missing
                    if ($('#showWhatsappBtn').length === 0) {
                        $('<button type="button" id="showWhatsappBtn" style="margin-left:8px;">Show</button>').insertAfter('#editContactWhatsapp');
                    }
                    if ($('#showEmailBtn').length === 0) {
                        $('<button type="button" id="showEmailBtn" style="margin-left:8px;">Show</button>').insertAfter('#editContactEmail');
                    }
                });
            });
        });
    }

    // Remove Add Your Contact Info section and logic
    $('#addContactInfoSection').remove();

    // Remove Edit Contact Info section and logic for employees (only once)
    if ($('#editContactInfoSection').length) {
        $('#editContactInfoSection').remove();
    }

    // Attendance table show more/less logic
    function updateAttendanceRows(showAll) {
        const $rows = $('#attendanceRecords tbody tr');
        if (showAll) {
            $rows.show();
            $('#toggleAttendanceRows').text('Show Less');
        } else {
            $rows.each(function(i) {
                $(this).toggle(i < 10);
            });
            $('#toggleAttendanceRows').text('Show More');
        }
    }
    // Initial state: show only 10 rows
    $(document).on('attendanceTableUpdated', function() {
        updateAttendanceRows(false);
    });
    // Toggle button
    let showAllRows = false;
    $('#toggleAttendanceRows').on('click', function() {
        showAllRows = !showAllRows;
        updateAttendanceRows(showAllRows);
    });
    // After table render, trigger event
    const origRenderTable = window.renderTable;
    window.renderTable = function(data) {
        origRenderTable(data);
        $(document).trigger('attendanceTableUpdated');
    };

    if ($('#pendingPunchOutPanel').length === 0) {
        $('<div id="pendingPunchOutPanel" style="margin:30px 0;"></div>').insertBefore('#exportPanel');
    }
    renderPendingPunchOuts();

    if (!isAdmin) {
        if ($('#myPunchOutPanel').length === 0) {
            $('<div id="myPunchOutPanel" style="margin:30px 0;"></div>').insertBefore('#attendanceRecords');
        }
        renderMyPunchOutRequests(currentEmployeeId);
    }

    // Approve/Reject handlers
    $(document).off('click', '.approve-btn').on('click', '.approve-btn', function() {
        const key = $(this).data('key');
        firebase.database().ref('pending_punchout/' + key).once('value').then(function(snapshot) {
            const req = snapshot.val();
            if (!req) return;
            // Add to attendance
            firebase.database().ref('attendance').push({
                id: req.id,
                name: req.name,
                action: 'Punch Out',
                time: req.time,
                location: req.location,
                locationName: req.locationName,
                reason: req.reason,
                approvedBy: 'admin',
                approvedAt: new Date().toISOString()
            }).then(function() {
                // Remove pending request
                firebase.database().ref('pending_punchout/' + key).remove();
                alert('Punch Out approved and recorded.');
                if (window.Notification && Notification.permission === 'granted') {
                    new Notification('Punch Out Approved', {
                        body: `Punch out approved for ${req.name} (${req.id})`,
                        icon: 'ind_logo.png'
                    });
                }
                showFloatingNotification(`Punch out approved for ${req.name} (${req.id})`);
            });
        });
    });
    $(document).off('click', '.reject-btn').on('click', '.reject-btn', function() {
        const key = $(this).data('key');
        firebase.database().ref('pending_punchout/' + key).remove().then(function() {
            alert('Punch Out request rejected.');
            if (window.Notification && Notification.permission === 'granted') {
                new Notification('Punch Out Rejected', {
                    body: `Punch out rejected for request ${key}`,
                    icon: 'ind_logo.png'
                });
            }
            showFloatingNotification(`Punch out request rejected (${key})`);
        });
    });

    // On page load (admin)
    if (isAdmin) {
        renderOverduePunchOuts();
        setInterval(renderOverduePunchOuts, 5 * 60 * 1000); // Auto-refresh every 5 min
        // Robust event handler for Send Reminder
        $(document).off('click', '.send-reminder-btn').on('click', '.send-reminder-btn', function() {
            const empId = $(this).data('empid');
            const name = $(this).data('name');
            // Browser notification for admin
            if (window.Notification && Notification.permission === 'granted') {
                new Notification('Reminder Sent', {
                    body: `Reminder sent to ${name} (ID: ${empId}) to punch out!`,
                    icon: 'ind_logo.png'
                });
            } else if (window.Notification && Notification.permission !== 'denied') {
                Notification.requestPermission();
            }
            showFloatingNotification(`Reminder sent to ${name} (ID: ${empId}) to punch out!`);
            // WhatsApp/email logic
            db.ref('employees/' + empId).once('value').then(snapshot => {
                const emp = snapshot.val();
                if (emp) {
                    // WhatsApp
                    if (emp.whatsapp) {
                        const msg = `Hi ${name}, please punch out. Your 8 hours are complete.`;
                        const waUrl = `https://wa.me/${emp.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`;
                        window.open(waUrl, '_blank');
                    }
                    // Email (if using EmailJS)
                    if (emp.email && typeof emailjs !== 'undefined') {
                        emailjs.send('service_nlk542o', 'template_fyvulbh', {
                            to_email: emp.email,
                            to_name: name,
                            message: `Hi ${name}, please punch out. Your 8 hours are complete.`
                        });
                    }
                }
            });
        });
    }

    // Add Export Pending Punch Out Requests button if not present (admin only)
    if (isAdmin && $('#exportPendingPunchOutBtn').length === 0) {
        $('<button id="exportPendingPunchOutBtn" class="admin-only" style="margin:10px 0 20px 0;">Export Pending Early Punch Out Requests</button>')
            .insertBefore($('#pendingPunchOutPanel'));
    }
    // Export Pending Punch Out Requests logic
    $('#exportPendingPunchOutBtn').off('click').on('click', function() {
        firebase.database().ref('pending_punchout').once('value').then(function(snapshot) {
            const data = snapshot.val() || {};
            const rows = [
                ['Employee ID', 'Name', 'Reason', 'Time', 'Status']
            ];
            Object.values(data).forEach(req => {
                rows.push([
                    req.id || '',
                    req.name || '',
                    req.reason || '',
                    req.time ? new Date(req.time).toLocaleString() : '',
                    'Pending'
                ]);
            });
            if (rows.length === 1) {
                alert('No pending punch out requests to export!');
                return;
            }
            const worksheet = XLSX.utils.aoa_to_sheet(rows);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Pending Punch Out');
            XLSX.writeFile(workbook, 'pending_punchout_requests.xlsx');
        });
    });

    // --- Email Reminder Utility Functions ---
    function sendEmailReminderIfNotSent(empId, empName) {
        // Use localStorage to avoid spamming: key = 'emailReminderSent_{empId}_{YYYYMMDD}'
        const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const key = `emailReminderSent_${empId}_${today}`;
        if (localStorage.getItem(key)) return; // Already sent today
        sendEmailReminder(empId, empName, function(success) {
            if (success) localStorage.setItem(key, '1');
        });
        
        // Also send WhatsApp reminder automatically
        sendWhatsAppReminderIfNotSent(empId, empName);
    }
    function sendEmailReminder(empId, empName, cb) {
        db.ref('employees/' + empId).once('value').then(snapshot => {
            const emp = snapshot.val();
            if (emp && emp.email) {
                // Fix: Properly decrypt email if it's encrypted
                const emailAddress = isEncrypted(emp.email) ? decrypt(emp.email) : emp.email;
                
                const templateParams = {
                    to_email: emailAddress,
                    to_name: empName,
                    message: `Hi ${empName}, please punch out. Your 8 hours are complete.`
                };
                
                if (typeof emailjs !== 'undefined') {
                    emailjs.send('service_nlk542o', 'template_fyvulbh', templateParams)
                        .then(function(response) {
                            showFloatingNotification(`Email reminder sent to ${empName} (${emailAddress})`);
                            if (cb) cb(true);
                        }, function(error) {
                            console.error("Email sending failed:", error);
                            showFloatingNotification(`Failed to send email to ${empName}: ${error.text}`);
                            if (cb) cb(false);
                        });
                } else {
                    console.error("EmailJS not available");
                    showFloatingNotification("Email service not available");
                    if (cb) cb(false);
                }
            } else {
                console.error("No email found for employee", empId);
                showFloatingNotification(`No email found for ${empName}`);
                if (cb) cb(false);
            }
        }).catch(error => {
            console.error("Error fetching employee data:", error);
            showFloatingNotification("Error fetching employee data");
            if (cb) cb(false);
        });
    }

    // Add handler for manual email reminder button (admin only)
    $(document).off('click', '.send-email-reminder-btn').on('click', '.send-email-reminder-btn', function() {
        const empId = $(this).data('empid');
        const name = $(this).data('name');
        sendEmailReminder(empId, name);
    });

    // New function to send WhatsApp reminders automatically
    function sendWhatsAppReminderIfNotSent(empId, empName) {
        // Use localStorage to avoid spamming: key = 'whatsappReminderSent_{empId}_{YYYYMMDD}'
        const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const key = `whatsappReminderSent_${empId}_${today}`;
        if (localStorage.getItem(key)) return; // Already sent today
        
        db.ref('employees/' + empId).once('value').then(snapshot => {
            const emp = snapshot.val();
            if (emp && emp.whatsapp) {
                // Fix: Properly decrypt whatsapp if it's encrypted
                const whatsappNumber = isEncrypted(emp.whatsapp) ? decrypt(emp.whatsapp) : emp.whatsapp;
                
                const msg = `Hi ${empName}, please punch out. Your 8 hours are complete.`;
                const waUrl = `https://wa.me/${whatsappNumber.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`;
                
                // Open WhatsApp in a new window
                const whatsappWindow = window.open(waUrl, '_blank');
                
                // Mark as sent
                localStorage.setItem(key, '1');
                
                // Log the notification
                console.log(`WhatsApp reminder sent to ${empName} (${whatsappNumber})`);
                showFloatingNotification(`WhatsApp reminder sent to ${empName}`);
                
                // Close the WhatsApp window after a delay (optional)
                setTimeout(() => {
                    if (whatsappWindow) {
                        whatsappWindow.close();
                    }
                }, 5000); // 5 seconds delay
            } else {
                console.error("No WhatsApp number found for employee", empId);
            }
        }).catch(error => {
            console.error("Error fetching employee data for WhatsApp:", error);
        });
    }
});