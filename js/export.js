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

function renderTable(data) {
    const grouped = groupData(data);
    const $tbody = $('#attendanceRecords tbody');
    $tbody.empty();
    grouped.forEach(r => {
        $tbody.append(`<tr>
            <td data-label="Date">${r.date}</td>
            <td data-label="Employee Name">${r.name}</td>
            <td data-label="Punch In Time">${r.punchIn}</td>
            <td data-label="Punch Out Time">${r.punchOut}</td>
            <td data-label="Location">${r.location}</td>
            <td data-label="Location Name">${r.locationName}</td>
            <td data-label="Hours Worked">${r.hoursWorked}</td>
        </tr>`);
    });
}

$(document).ready(function() {
    getAttendanceData(function(allData) {
        renderTable(allData);

        $('#exportAllBtn').click(function() {
            const grouped = groupData(allData);
            if (grouped.length === 0) {
                alert('No data to export!');
                return;
            }
            let rows = [
                ['Date', 'Employee Name', 'Punch In Time', 'Punch Out Time', 'Location', 'Location Name', 'Hours Worked'],
                ...grouped.map(r => [r.date, r.name, r.punchIn, r.punchOut, r.location, r.locationName, r.hoursWorked])
            ];
            let worksheet = XLSX.utils.aoa_to_sheet(rows);
            let workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance');
            XLSX.writeFile(workbook, 'attendance_all.xlsx');
        });

        $('#exportFilterBtn').click(function() {
            const filterId = prompt('Enter Employee ID to export (leave blank for all):');
            const filterMonth = prompt('Enter Month (YYYY-MM) to export (leave blank for all):');
            const filterYear = prompt('Enter Year (YYYY) to export (leave blank for all):');
            let filtered = allData.filter(record => {
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
            const grouped = groupData(filtered);
            if (grouped.length === 0) {
                alert('No data to export!');
                return;
            }
            let rows = [
                ['Date', 'Employee Name', 'Punch In Time', 'Punch Out Time', 'Location', 'Location Name', 'Hours Worked'],
                ...grouped.map(r => [r.date, r.name, r.punchIn, r.punchOut, r.location, r.locationName, r.hoursWorked])
            ];
            let worksheet = XLSX.utils.aoa_to_sheet(rows);
            let workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance');
            XLSX.writeFile(workbook, 'attendance_filtered.xlsx');
        });
    });
});