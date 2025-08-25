// holidays.js
// Central holiday calendar. Edit/extend per your region.
// By default: India National Holidays for 2025 (sample). Add state-specific below if needed.

window.HOLIDAYS = [
  // Format: { date: 'YYYY-MM-DD', name: 'Festival Name', type: 'festival'|'public'|'company' }
  // --- 2025 India (sample; adjust as needed) ---
  { date: '2025-01-01', name: 'New Year\'s Day', type: 'public' },
  { date: '2025-01-14', name: 'Makar Sankranti', type: 'festival' },
  { date: '2025-01-26', name: 'Republic Day', type: 'public' },
  { date: '2025-03-14', name: 'Holi', type: 'festival' },
  { date: '2025-03-31', name: 'Ram Navami', type: 'festival' },
  { date: '2025-04-10', name: 'Good Friday', type: 'public' },
  { date: '2025-06-07', name: 'Bakrid (Eid al-Adha)', type: 'festival' },
  { date: '2025-08-15', name: 'Independence Day', type: 'public' },
  { date: '2025-08-27', name: 'Ganesh Chaturthi', type: 'festival' },
  { date: '2025-10-02', name: 'Gandhi Jayanti', type: 'public' },
  { date: '2025-10-20', name: 'Diwali', type: 'festival' },
  { date: '2025-12-25', name: 'Christmas', type: 'public' },
];

// Helper: lookup holiday by date string 'YYYY-MM-DD'
window.getHolidayByDate = function(dateStr) {
  if (!Array.isArray(window.HOLIDAYS)) return null;
  return window.HOLIDAYS.find(h => h.date === dateStr) || null;
};