// Dummy localStorage fallback for demo (replace with backend/fetch if needed)
function getAttendanceData() {
    return JSON.parse(localStorage.getItem('employeeData') || '[]');
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
                locationName: ''
            };
        }
        if (r.action === 'Punch In') {
            grouped[key].punchIn = time;
            grouped[key].location = r.location;
            grouped[key].locationName = r.locationName;
        }
        if (r.action === 'Punch Out') {
            grouped[key].punchOut = time;
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
        </tr>`);
    });
}

$(document).ready(function() {
    let allData = getAttendanceData();
    renderTable(allData);

    $('#exportAllBtn').click(function() {
        const grouped = groupData(allData);
        if (grouped.length === 0) {
            alert('No data to export!');
            return;
        }
        let rows = [
            ['Date', 'Employee Name', 'Punch In Time', 'Punch Out Time', 'Location', 'Location Name'],
            ...grouped.map(r => [r.date, r.name, r.punchIn, r.punchOut, r.location, r.locationName])
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
            ['Date', 'Employee Name', 'Punch In Time', 'Punch Out Time', 'Location', 'Location Name'],
            ...grouped.map(r => [r.date, r.name, r.punchIn, r.punchOut, r.location, r.locationName])
        ];
        let worksheet = XLSX.utils.aoa_to_sheet(rows);
        let workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance');
        XLSX.writeFile(workbook, 'attendance_filtered.xlsx');
    });
});