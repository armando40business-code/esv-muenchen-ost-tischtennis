/* ESV München-Ost · Tischtennis — UI behaviours */
(function () {
  // Mobile nav
  var burger = document.querySelector('.burger');
  var links = document.querySelector('.nav-links');
  if (burger && links) {
    burger.addEventListener('click', function () {
      links.classList.toggle('open');
    });
    links.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () { links.classList.remove('open'); });
    });
  }

  // Scroll reveal
  var reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && reveals.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12 });
    reveals.forEach(function (el, i) {
      el.style.transitionDelay = (Math.min(i % 3, 2) * 80) + 'ms';
      io.observe(el);
    });
  } else {
    reveals.forEach(function (el) { el.classList.add('in'); });
  }

  // Contact form — no backend, opens mail client
  var form = document.querySelector('.cform');
  if (form) {
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var n = encodeURIComponent(form.name.value || '');
      var msg = encodeURIComponent(form.message.value || '');
      var from = encodeURIComponent(form.email.value || '');
      window.location.href = 'mailto:tischtennis@esv-muenchen-ost.de'
        + '?subject=' + encodeURIComponent('Anfrage über die Website von ' + (n || 'Interessent'))
        + '&body=' + msg + '%0D%0A%0D%0A' + from;
    });
  }
})();
