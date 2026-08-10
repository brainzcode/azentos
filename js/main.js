/* =========================================================================
   AZENTOS — behaviour
   ========================================================================= */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduced = matchMedia('(prefers-reduced-motion: reduce)');

  /* =======================================================================
     Mobile menu — one state function owns every attribute and the lock
     ===================================================================== */
  (function menu() {
    var btn   = document.getElementById('menuBtn');
    var panel = document.getElementById('menu');
    if (!btn || !panel) return;

    var open = false;
    var scrollY = 0;

    var FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea,' +
                    '[tabindex]:not([tabindex="-1"])';

    // the burger is the close control and lives outside the panel
    function focusables() {
      return [btn].concat([].slice.call(panel.querySelectorAll(FOCUSABLE)));
    }

    function set(state) {
      if (state === open) return;
      open = state;

      panel.classList.toggle('is-open', open);
      root.classList.toggle('is-menu-open', open);
      btn.setAttribute('aria-expanded', String(open));
      btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      if (open) panel.removeAttribute('inert');
      else      panel.setAttribute('inert', '');

      if (open) {
        scrollY = window.scrollY;
        document.body.style.position = 'fixed';
        document.body.style.top   = -scrollY + 'px';
        document.body.style.left  = '0';
        document.body.style.right = '0';
        panel.focus({ preventScroll: true });
      } else {
        document.body.style.position = '';
        document.body.style.top   = '';
        document.body.style.left  = '';
        document.body.style.right = '';
        window.scrollTo(0, scrollY);
        btn.focus({ preventScroll: true });
      }
    }

    btn.addEventListener('click', function () { set(!open); });

    panel.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () { set(false); });
    });

    document.addEventListener('keydown', function (e) {
      if (!open) return;
      if (e.key === 'Escape') { set(false); return; }
      if (e.key !== 'Tab') return;

      var list  = focusables();
      var first = list[0];
      var last  = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });

    // crossing into desktop must not strand the page in a locked state
    matchMedia('(min-width: 1024px)').addEventListener('change', function (e) {
      if (e.matches) set(false);
    });
  }());

  /* =======================================================================
     Services accordion — single-open disclosure
     ===================================================================== */
  (function accordion() {
    var items = [].slice.call(document.querySelectorAll('.acc__item'));
    if (!items.length) return;

    items.forEach(function (item) {
      var btn = item.querySelector('.acc__btn');
      if (!btn) return;

      btn.addEventListener('click', function () {
        var willOpen = !item.classList.contains('is-open');

        items.forEach(function (other) {
          var isTarget = other === item;
          other.classList.toggle('is-open', isTarget && willOpen);
          var b = other.querySelector('.acc__btn');
          if (b) b.setAttribute('aria-expanded', String(isTarget && willOpen));
        });
      });
    });
  }());

  /* =======================================================================
     Trusted rail — pointer drag on top of native scrolling
     ===================================================================== */
  (function rail() {
    var el = document.getElementById('trustRail');
    if (!el) return;

    var down = false, moved = false, startX = 0, startLeft = 0, pid = null;

    el.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'touch') return;   // let iOS/Android scroll natively
      down = true; moved = false;
      startX = e.clientX;
      startLeft = el.scrollLeft;
      pid = e.pointerId;
    });

    el.addEventListener('pointermove', function (e) {
      if (!down || e.pointerId !== pid) return;
      var dx = e.clientX - startX;
      if (!moved && Math.abs(dx) > 4) {
        moved = true;
        el.classList.add('is-dragging');
        el.setPointerCapture(pid);
      }
      if (moved) el.scrollLeft = startLeft - dx;
    });

    function release(e) {
      if (!down || (e && e.pointerId !== pid)) return;
      down = false;
      if (moved && el.hasPointerCapture(pid)) el.releasePointerCapture(pid);
      el.classList.remove('is-dragging');
      pid = null;
    }

    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    // a drag that ends on a card must not fire that card's click
    el.addEventListener('click', function (e) {
      if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; }
    }, true);
  }());

  /* =======================================================================
     Footer wordmark — fit the type to the exact column width
     ===================================================================== */
  (function wordmark() {
    var el = document.getElementById('wordmarkText');
    if (!el) return;

    var inner = el.firstElementChild;
    if (!inner) return;

    function fit() {
      // scrollWidth is clamped to the box, so it reports the column width rather than
      // the text width whenever the type is smaller than its column. Measure the
      // inline-block child instead — that box is the glyphs.
      el.style.fontSize = '100px';
      var natural = inner.getBoundingClientRect().width;
      var avail = el.clientWidth;
      if (!natural || !avail) { el.style.fontSize = ''; return; }
      // .999 keeps sub-pixel rounding from pushing the last glyph past the edge
      el.style.fontSize = (100 * avail / natural * 0.999).toFixed(2) + 'px';
    }

    fit();
    requestAnimationFrame(fit);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
    window.addEventListener('load', function () { requestAnimationFrame(fit); });

    var raf = null;
    window.addEventListener('resize', function () {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(fit);
    });
  }());

  /* =======================================================================
     Reveal on scroll
     ===================================================================== */
  (function reveal() {
    var nodes = [].slice.call(document.querySelectorAll('.reveal'));
    if (!nodes.length) return;

    if (reduced.matches || !('IntersectionObserver' in window)) {
      nodes.forEach(function (n) { n.classList.add('is-in'); });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });

    nodes.forEach(function (n, i) {
      n.style.transitionDelay = (Math.min(i % 4, 3) * 70) + 'ms';
      io.observe(n);
    });
  }());

}());
