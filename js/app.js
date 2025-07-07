// app.js

$(document).ready(function() {
    // Load employees from localStorage or empty array
    let employees = JSON.parse(localStorage.getItem('employees')) || [];
    const employeeData = JSON.parse(localStorage.getItem('employeeData')) || [];

    // Populate dropdown with employees
    function updateDropdown() {
        $('#employeeId').empty().append('<option value="">Select Employee</option>');
        employees.forEach(emp => {
            $('#employeeId').append(`<option value="${emp.id}">${emp.id} - ${emp.name}</option>`);
        });
    }
    updateDropdown();

    // Auto-fill name on select
    $('#employeeId').change(function() {
        const selected = employees.find(e => e.id === $(this).val());
        $('#employeeName').val(selected ? selected.name : '');
    });

    // Location fetch with reverse geocoding
    function setLocation() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(function(position) {
                $('#location').val(
                    `Lat: ${position.coords.latitude}, Lon: ${position.coords.longitude}`
                );
                $.get(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${position.coords.latitude}&lon=${position.coords.longitude}`, function(data) {
                    $('#locationName').val(
                        data.address.city || data.address.town || data.address.village || data.address.state || data.display_name || 'Unknown'
                    );
                }).fail(function() {
                    $('#locationName').val('Unknown');
                });
            }, function() {
                $('#location').val('Location unavailable');
                $('#locationName').val('Unknown');
            });
        } else {
            $('#location').val('Geolocation not supported');
            $('#locationName').val('Unknown');
        }
    }

    setLocation();
    $('#employeeId').focus(setLocation);

    function saveData() {
        localStorage.setItem('employeeData', JSON.stringify(employeeData));
    }

    $('#punchInBtn').click(function() {
        const employeeId = $('#employeeId').val();
        const employeeName = $('#employeeName').val();
        const timestamp = new Date();
        const location = $('#location').val();
        const locationName = $('#locationName').val();

        if (employeeId && employeeName && location) {
            employeeData.push({
                id: employeeId,
                name: employeeName,
                action: 'Punch In',
                time: timestamp.toISOString(),
                location: location,
                locationName: locationName
            });
            saveData();
            alert('Punched In Successfully!');
            $('#employeeId').val('');
            $('#employeeName').val('');
            setLocation();
        } else {
            alert('Please select Employee and wait for location.');
        }
    });

    $('#punchOutBtn').click(function() {
        const employeeId = $('#employeeId').val();
        const employeeName = $('#employeeName').val();
        const timestamp = new Date();
        const location = $('#location').val();
        const locationName = $('#locationName').val();

        if (employeeId && employeeName && location) {
            employeeData.push({
                id: employeeId,
                name: employeeName,
                action: 'Punch Out',
                time: timestamp.toISOString(),
                location: location,
                locationName: locationName
            });
            saveData();
            alert('Punched Out Successfully!');
            $('#employeeId').val('');
            $('#employeeName').val('');
            setLocation();
        } else {
            alert('Please select Employee and wait for location.');
        }
    });

    // Export Data button logic with filter
    $('#exportBtn').click(function() {
        const filterId = prompt('Enter Employee ID to export (leave blank for all):');
        const filterMonth = prompt('Enter Month (YYYY-MM) to export (leave blank for all):');
        const filterYear = prompt('Enter Year (YYYY) to export (leave blank for all):');

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

    // Add employee name and location name fields if not present
    if (!$('#employeeName').length) {
        $('<label for="employeeName">Employee Name:</label><input type="text" id="employeeName" required>')
            .insertAfter($('#employeeId'));
    }
    if (!$('#locationName').length) {
        $('<input type="hidden" id="locationName">').insertAfter($('#location'));
    }
});