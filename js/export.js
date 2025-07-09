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
                punchOut: '',
                location: '',
                locationName: '',
                hoursWorked: ''
            };
        }
        if (r.action === 'Punch In') {
            grouped[key].punchIn = time;
            grouped[key].punchInRaw = r.time;
            grouped[key].location = r.location;
            grouped[key].locationName = r.locationName;
        }
        if (r.action === 'Punch Out') {
            grouped[key].punchOut = time;
            grouped[key].punchOutRaw = r.time;
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
    const $tbody = $('#leaveRecords tbody');
    $tbody.empty();
    leaves.forEach(l => {
        let actionHtml = '';
        if (isAdmin && l.status === 'Pending') {
            actionHtml = `<button class="accept-leave" data-key="${l.key}">Accept</button> <button class="reject-leave" data-key="${l.key}">Reject</button>`;
        } else {
            actionHtml = l.status;
        }
        let proofHtml = l.proofUrl ? `<a href="${l.proofUrl}" target="_blank">View</a>` : '';
        let days = getLeaveDays(l.fromDate, l.toDate);
        $tbody.append(`<tr>
            <td>${l.employeeId}</td>
            <td>${l.employeeName}</td>
            <td>${l.fromDate || ''}</td>
            <td>${l.toDate || ''}</td>
            <td>${days}</td>
            <td>${l.reason}</td>
            <td>${proofHtml}</td>
            <td>${actionHtml}</td>
        </tr>`);
    });
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
    grouped.forEach(r => {
        const status = getDayStatus(r.date, r.hoursWorked, r.punchIn, r.punchOut);
        $tbody.append(`<tr>
            <td data-label="Date">${r.date}</td>
            <td data-label="Employee Name">${r.name}</td>
            <td data-label="Punch In Time">${r.punchIn}</td>
            <td data-label="Punch Out Time">${r.punchOut}</td>
            <td data-label="Location">${r.location}</td>
            <td data-label="Location Name">${r.locationName}</td>
            <td data-label="Hours Worked">${r.hoursWorked}</td>
            <td data-label="Status">${status}</td>
        </tr>`);
    });
}

let currentEmployeeId = null;
let isAdmin = false;
const ADMIN_PASSWORD = 'admin@123'; // Change this to your desired admin password

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

$(document).ready(function() {
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
            let rows = [
                ['Date', 'Employee Name', 'Punch In Time', 'Punch Out Time', 'Location', 'Location Name', 'Hours Worked', 'Status'],
                ...grouped.map(r => [r.date, r.name, r.punchIn, r.punchOut, r.location, r.locationName, r.hoursWorked, getDayStatus(r.date, r.hoursWorked, r.punchIn, r.punchOut)])
            ];
            let worksheet = XLSX.utils.aoa_to_sheet(rows);
            let workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance');
            XLSX.writeFile(workbook, 'attendance_all.xlsx');
        });
    });

    // Leave form submit
    $('#leaveForm').off('submit').on('submit', function(e) {
        e.preventDefault();
        const fromDate = $('#leaveFrom').val();
        const toDate = $('#leaveTo').val();
        const reason = $('#leaveReason').val();
        const fileInput = $('#leaveProof')[0];
        if (!fromDate || !toDate || !reason) return alert('All fields required!');
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
                    if (isAdmin) loadLeaves();
                });
            }
        });
    });

    function loadLeaves() {
        fetchLeaves(function(leaves) {
            if (!isAdmin) {
                leaves = leaves.filter(l => l.employeeId === currentEmployeeId);
            }
            renderLeaveTable(leaves, isAdmin);
        });
    }

    // Initial load of leave table
    loadLeaves();

    // Accept/Reject leave (admin only)
    $(document).on('click', '.accept-leave', function() {
        const key = $(this).data('key');
        updateLeaveStatus(key, 'Accepted', loadLeaves);
    });
    $(document).on('click', '.reject-leave', function() {
        const key = $(this).data('key');
        updateLeaveStatus(key, 'Rejected', loadLeaves);
    });

    // Hide admin-only elements for non-admins
    if (!isAdmin) {
        $('.admin-only').hide();
    } else {
        $('.admin-only').show();
    }
});