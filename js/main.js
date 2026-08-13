/* =========================================================================
   AZENTOS — behaviour
   ========================================================================= */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduced = matchMedia('(prefers-reduced-motion: reduce)');

  /* =======================================================================
     Smooth scroll — Lenis eases the real scroll position, so sticky/fixed
     elements, IntersectionObserver and window.scrollY all keep working
     ===================================================================== */
  var lenis = null;

  function makeLenis() {
    return new Lenis({
      duration: 1.05,
      easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); },
      smoothWheel: true,
      syncTouch: false,   // phones keep their native momentum — smoothing it feels laggy
      autoRaf: true       // Lenis drives its own RAF; do not add a second ticker
    });
  }

  if (!reduced.matches && window.Lenis) lenis = makeLenis();

  // follow a live change to the OS setting, but never while the menu holds the lock —
  // tearing Lenis down mid-lock would leave the page scrollable behind the overlay
  reduced.addEventListener('change', function (e) {
    if (root.classList.contains('is-menu-open') || !window.Lenis) return;
    if (e.matches && lenis) { lenis.destroy(); lenis = null; }
    else if (!e.matches && !lenis) { lenis = makeLenis(); }
  });

  /* Anchor offsets are already a design token: section[id] and footer[id] carry
     scroll-margin-top: clamp(76px, 12vw, 110px). Lenis reads that property itself, so
     passing a measured header height on top of it would land every section short by a
     header. Only targets that declare no scroll margin need one measured for them. */
  function headClearance() {
    var head = document.querySelector('.site-head');
    if (!head) return 0;
    // the header only covers content while it is fixed — below 1024px, and whenever
    // the menu is open. Above that it scrolls away and nothing needs clearing.
    return getComputedStyle(head).position === 'fixed' ? head.offsetHeight + 10 : 0;
  }

  function scrollToTarget(target) {
    var declared = parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
    var extra = declared ? 0 : headClearance();

    if (lenis) {
      lenis.scrollTo(target, { offset: -extra });
      return;
    }
    // window.scrollTo ignores scroll-margin (only scrollIntoView honours it), so the
    // no-Lenis path has to apply the same number by hand to land in the same place
    var top = target === document.body
      ? 0
      : window.scrollY + target.getBoundingClientRect().top - declared - extra;
    window.scrollTo({ top: Math.max(0, top), behavior: reduced.matches ? 'auto' : 'smooth' });
  }

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

      // One lock, never two. Lenis holds the page with its own overflow:clip and never
      // touches the body, so the scroll position is never lost and there is nothing to
      // restore on close. Pinning the body as well would collapse the page height,
      // resync Lenis to 0, and drop the user at the top when the menu closes.
      if (lenis) {
        if (open) lenis.stop();
        else      lenis.start();
      } else if (open) {
        scrollY = window.scrollY;
        document.body.style.position = 'fixed';
        document.body.style.top   = -scrollY + 'px';
        document.body.style.left  = '0';
        document.body.style.right = '0';
      } else if (document.body.style.position === 'fixed') {
        document.body.style.position = '';
        document.body.style.top   = '';
        document.body.style.left  = '';
        document.body.style.right = '';
        // instant, because html no longer carries scroll-behavior: smooth — that pair
        // was the visible bug: the page animated up from 0 back to where you were
        window.scrollTo(0, scrollY);
      }

      if (open) panel.focus({ preventScroll: true });
      else      btn.focus({ preventScroll: true });
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
     In-page anchors — routed through Lenis so they ease instead of jumping,
     and clear the header when it is the fixed one
     ===================================================================== */
  (function anchors() {
    document.addEventListener('click', function (e) {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (!e.target.closest) return;

      var a = e.target.closest('a[href]');
      if (!a || a.target === '_blank') return;

      var href = a.getAttribute('href');
      if (!href || href.charAt(0) !== '#' || href === '#') return;

      var target = document.getElementById(href.slice(1));
      if (!target) return;

      e.preventDefault();
      scrollToTarget(target);
      // keep the URL honest without letting the browser jump; harmless if file:// refuses
      try { history.replaceState(null, '', href); } catch (err) { /* file:// */ }
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
