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

  // Hide audio hint on first click (helps activate AudioContext)
  window.addEventListener('click', () => {
    const hint = document.getElementById('audio-hint');
    if (hint) {
      hint.style.transition = 'opacity 0.5s';
      hint.style.opacity = '0';
      setTimeout(() => hint.remove(), 500);
    }
  }, { once: true });

  // --- LOGICA DE BASES ---
  const PRESETS = {
    synthwave: '9n31s0k0l00e03t2ma7g0fj07r1i0o432T1v1uebf0q8y10ob23d08A9F6B9Q0681Pd756E3b862c632T1v1u76f10p7q011d03A1F9B2Q1030Pfc6cE362663b72T7v1u21f30j61552n8q011d07H_SJ5JJFAAAkAAAh8IcE0T2v1u15f10w4qw02d03w0E0b4h40000000h4g000000014h000000004h400000000p1fAqqfELEf2M00000',
    '8bit': '9n31s0k0l00e05t2ma7g0hj07r1i0o432T1v1uebf0q8y10ob23d08A9F6B9Q0681Pd756E3b862c632T1v1ub7f0q0x10p71d23A5F4B9Q0001Pffa7E4b862363379T7v1u21f30j61552n8q011d07H_SJ5JJFAAAkAAAh8IcE0T2v1u15f10w4qw02d03w0E0b404h00000000424h00000000404h00000000404h00000000p1nAqqfELEf2M2suCzXEeD0000',
    lofi: '9n31s0k0l00e06t2ma7g0ij07r1i0o432T1v1uebf0q8y10ob23d08A9F6B9Q0681Pd756E3b862c632T1v1ub7f0q0x10p71d23A5F4B9Q0001Pffa7E4b862363379T7v1u21f30j61552n8q011d07H_SJ5JJFAAAkAAAh8IcE0T2v1u15f10w4qw02d03w0E0b404h000000000g8h4000000001014g00000000404h800000000p1CAqqfELEf2M2suCzXEeD0096Cz42-wYbD7Q7pw0',
    trap: '9n31s0k0l00e07t2ma7g0jj07r1i0o432T1v1uebf0q8y10ob23d08A9F6B9Q0681Pd756E3b862c632T1v1ub7f0q0x10p71d23A5F4B9Q0001Pffa7E4b862363379T7v1u21f30j61552n8q011d07H_SJ5JJFAAAkAAAh8IcE0T2v1u15f10w4qw02d03w0E0b400h40000000010w4h000000000g014g00000000400h4w00000000p1CAqqfELEf2M2suCzXEeD0096Cz42-wYbD7Q7pw0',
    orchestra: '9n31s0k0l00e08t2ma7g0Fj07r1i0o432T1v1uebf0q8y10ob23d08A9F6B9Q0681Pd756E3b862c632T1v1ua9f0qo1321d23A0F0B2Q2010Pf770E261278T7v1u21f30j61552n8q011d07H_SJ5JJFAAAkAAAh8IcE0T2v1u15f10w4qw02d03w0E0b400h40000000000000000000000042ch400000000000000000000000400h400000000000000000000000400h4w0000000000000000000000p1KAqqfELEf2M2suPhZIyqfAWutfisS00AqqcgbW3MKsvgtC0'
  };

  window.toggleBases = function() {
    const sidebar = document.getElementById('basesSidebar');
    if (sidebar) sidebar.classList.toggle('open');
  };

  window.loadBase = function(genre) {
    const hash = PRESETS[genre];
    if (hash) {
      const internalIframe = document.getElementById('siteFrame');
      const newUrl = 'https://www.beepbox.co/#' + hash;
      
      // Force reload by briefly clearing src or using replace if allowed
      internalIframe.src = 'about:blank';
      setTimeout(() => {
        internalIframe.src = newUrl;
      }, 50);

      // Auto-close sidebar on mobile
      if (window.innerWidth < 768) {
        toggleBases();
      }

      // Visual feedback
      const btn = document.querySelector(`.base-btn[data-genre="${genre}"]`);
      if (btn) {
        const originalBg = btn.style.background;
        btn.style.background = 'rgba(56, 189, 248, 0.4)';
        setTimeout(() => btn.style.background = originalBg, 300);
      }
    }
  };


})();