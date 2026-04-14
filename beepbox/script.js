// Keep experience immediate and fullscreen-like. Detect if iframe failed to load due to X-Frame-Options
(function () {
  const iframe = document.getElementById('siteFrame');

  // If the iframe can't load (most common cause: X-Frame-Options or CSP), show a simple fallback link
  const fallbackId = 'blockedNotice';
  let notice = document.getElementById(fallbackId);
  if (!notice) {
    notice = document.createElement('div');
    notice.id = fallbackId;
    notice.innerHTML = 'This site may block embedding. Open in a new tab: <a id="openLink" href="https://www.beepbox.co/" target="_blank" rel="noopener" style="color:#9be7ff">Open BeepBox</a>';
    document.body.appendChild(notice);
  }

  // If iframe loads successfully, we won't show notice. Use a timeout to decide.
  let loaded = false;
  // Some sites can fire load even when blocked; use postMessage handshake where possible
  iframe.addEventListener('load', () => {
    // small delay to allow navigation; assume success unless later check fails
    setTimeout(() => {
      if (!loaded) {
        // try to access iframe location - will throw if cross-origin and blocked, but allowed if site embedded
        try {
          // Accessing contentDocument for cross-origin raises a security error; treat that as "likely embedded ok"
          const doc = iframe.contentDocument;
          // If null or inaccessible, still consider it loaded. Hide notice.
          hideNotice();
        } catch (e) {
          // Cross-origin but loaded – still hide notice
          hideNotice();
        }
      }
    }, 300);
  });

  // If iframe errors or remains unreachable, show notice after a short timeout
  setTimeout(() => {
    // If iframe's contentWindow is null or its document is empty for same-origin, show notice
    try {
      if (!iframe.contentWindow || !iframe.contentWindow.location) {
        showNotice();
      } else {
        // If still here, likely okay; hide notice
        hideNotice();
      }
    } catch (e) {
      // Cross-origin access denied but iframe likely loaded; hide notice
      hideNotice();
    }
  }, 1200);

  function showNotice() {
    notice.style.display = 'block';
  }
  function hideNotice() {
    notice.style.display = 'none';
  }

})();