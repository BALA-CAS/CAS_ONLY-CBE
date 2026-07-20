document.addEventListener('DOMContentLoaded', function () {
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.querySelector('.main-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('nav-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }
});

// GA4 event tracking: phone clicks, WhatsApp clicks, form submissions, lead-magnet downloads
(function () {
  function track(name, params) {
    if (typeof gtag === 'function') {
      gtag('event', name, params || {});
    }
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest('a');
    if (!a) return;
    var href = a.getAttribute('href') || '';

    if (href.indexOf('tel:') === 0) {
      track('phone_click', { link_url: href, page_path: window.location.pathname });
    } else if (href.indexOf('wa.me') !== -1 || href.indexOf('whatsapp.com') !== -1) {
      track('whatsapp_click', { link_url: href, page_path: window.location.pathname });
    } else if (href.indexOf('/assets/downloads/') !== -1 || a.hasAttribute('download')) {
      track('lead_magnet_download', {
        file_name: href.split('/').pop(),
        page_path: window.location.pathname,
      });
    }
  });

  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (!form || form.tagName !== 'FORM') return;
    var formName = form.getAttribute('name') || 'unknown_form';
    track('form_submit', { form_name: formName, page_path: window.location.pathname });
  });
})();
