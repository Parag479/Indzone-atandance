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

$(document).ready(function() {
    // Fetch employees from Firebase
    let employees = [];
    function fetchEmployees(callback) {
        db.ref('employees').on('value', (snapshot) => {
            const data = snapshot.val() || {};
            employees = Object.values(data);
            if (callback) callback(employees);
            updateDropdown();
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

    $('#punchInBtn').click(function() {
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
                    action: 'Punch In',
                    time: timestamp.toISOString(),
                    location: location,
                    locationName: locationName
                }).then(() => {
                    alert('Punched In Successfully!');
                    $('#employeeId').val('');
                    $('#employeeName').val('');
                    setPunchButtons(true);
                    clearStatus();
                });
            });
        } else {
            alert('Please select Employee.');
        }
    });

    $('#punchOutBtn').click(function() {
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
                    $('#employeeId').val('');
                    $('#employeeName').val('');
                    setPunchButtons(true);
                    clearStatus();
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
                ['Employee ID', 'Employee Name', 'Action', 'Time', 'Location', 'Location Name']
            ];
            filtered.forEach(r => {
                rows.push([r.id, r.name, r.action, r.time, r.location, r.locationName]);
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

    // Initial fetch
    fetchEmployees();
});