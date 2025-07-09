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
    leaves.forEach(l => {
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
            <td>${l.employeeName}</td>
            <td>${l.fromDate || ''}</td>
            <td>${l.toDate || ''}</td>
            <td>${days}</td>
            <td>${l.reason}</td>
            <td>${proofHtml}</td>
            <td>${actionHtml}</td>
        </tr>`);
    });
    // Heading update
    if (isAdmin) {
        $('#leaveSection h2').last().text('All Leave Requests (Admin)');
    } else {
        $('#leaveSection h2').last().text('My Leave Requests');
    }
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
                    punchOut: '',
                    location: '',
                    locationName: '',
                    hoursWorked: '',
                    status: 'Holiday',
                    isHoliday: true
                });
            }
            date.setDate(date.getDate() + 1);
        }
    }
    // Sort by date ascending
    grouped.sort((a, b) => new Date(a.date) - new Date(b.date));
    grouped.forEach(r => {
        const isSunday = new Date(r.date).getDay() === 0;
        const status = r.isHoliday ? 'Holiday' : getDayStatus(r.date, r.hoursWorked, r.punchIn, r.punchOut);
        $tbody.append(`<tr>
            <td data-label="Date">${r.date}</td>
            <td data-label="Employee Name">${r.name || ''}</td>
            <td data-label="Punch In Time">${isSunday ? '' : r.punchIn}</td>
            <td data-label="Punch Out Time">${isSunday ? '' : r.punchOut}</td>
            <td data-label="Location">${isSunday ? '' : r.location}</td>
            <td data-label="Location Name">${isSunday ? '' : r.locationName}</td>
            <td data-label="Hours Worked">${isSunday ? '' : r.hoursWorked}</td>
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

function setUserInfoBar(id, name) {
    $('#userInfoBar').text(`ID: ${id} | Name: ${name}`).show();
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

    // After login, show user info bar
    if (isAdmin) {
        setUserInfoBar('admin', 'Admin');
    } else {
        fetchEmployeeName(currentEmployeeId, function(empName) {
            setUserInfoBar(currentEmployeeId, empName || '');
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
});