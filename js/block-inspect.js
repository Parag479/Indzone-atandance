// --- Robust Inspect/Right Click Blocker (Global, runs ASAP) ---
(function() {
  window.blockInspect = true;
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
  function blockContextMenu(e) { if (window.blockInspect) e.preventDefault(); }
  function blockKeydown(e) {
    if (!window.blockInspect) return;
    if (
      e.keyCode === 123 || // F12
      (e.ctrlKey && e.shiftKey && (e.keyCode === 73 || e.keyCode === 74 || e.keyCode === 67 || e.keyCode === 75)) || // Ctrl+Shift+I/J/C/K
      (e.ctrlKey && (e.keyCode === 85 || e.keyCode === 83 || e.keyCode === 80 || e.keyCode === 70)) // Ctrl+U/S/P/F
    ) {
      e.preventDefault();
    }
  }
  function attachBlockers() {
    document.addEventListener('contextmenu', blockContextMenu, true);
    document.addEventListener('keydown', blockKeydown, true);
  }
  function detachBlockers() {
    document.removeEventListener('contextmenu', blockContextMenu, true);
    document.removeEventListener('keydown', blockKeydown, true);
  }
  attachBlockers();
  setInterval(() => { attachBlockers(); }, 1000);
  // Helper: check if admin cookie is set (page-specific)
  function isAdmin() {
    const name = 'isAdmin_' + window.location.pathname.replace(/\W/g, '_') + '=';
    return document.cookie.split(';').some(c => c.trim().startsWith(name + '1'));
  }
  // Helper: set admin cookie from console (page-specific)
  window.setAdminMode = function() {
    const name = 'isAdmin_' + window.location.pathname.replace(/\W/g, '_');
    document.cookie = name + '=1; path=' + window.location.pathname + ';';
    showToast('Admin mode enabled (reload to use Ctrl+1)');
  };
  // Only allow toggle with Ctrl+1 if admin cookie is set, otherwise prompt for code
  document.addEventListener('keydown', function(e) {
    if (e.ctrlKey && !e.shiftKey && e.key === '1') {
      if (!isAdmin()) {
        var code = prompt('Enter admin code to toggle inspect block:');
        if (code === 'indzone123') {
          const name = 'isAdmin_' + window.location.pathname.replace(/\W/g, '_');
          document.cookie = name + '=1; path=' + window.location.pathname + ';';
          window.blockInspect = false;
          detachBlockers();
          showToast('Inspect Block: OFF');
        } else {
          showToast('Incorrect admin code!');
        }
        return;
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
  window.addEventListener('DOMContentLoaded', function() {
    window.blockInspect = true;
    attachBlockers();
    showToast('Inspect Block: ON');
  });
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
      if (!isAdmin()) return;
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