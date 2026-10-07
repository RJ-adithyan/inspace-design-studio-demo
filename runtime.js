/* Shared neutral mechanics. Custom scenes own their visual drawing. */
(function demoKitRuntime(window, document) {
  'use strict';

  const MOBILE_QUERY = '(max-width: 767px)';
  const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';

  function listenMedia(query, listener) {
    if (!query) return function noop() {};
    if (typeof query.addEventListener === 'function') {
      query.addEventListener('change', listener);
      return function remove() { query.removeEventListener('change', listener); };
    }
    if (typeof query.addListener === 'function') {
      query.addListener(listener);
      return function remove() { query.removeListener(listener); };
    }
    return function noop() {};
  }

  function setupMenu() {
    document.documentElement.classList.add('js');
    document.querySelectorAll('.dk-header').forEach(function (header) {
      const toggle = header.querySelector('.dk-menu');
      if (!toggle) return;
      const controls = toggle.getAttribute('aria-controls');
      const nav = (controls && document.getElementById(controls)) || header.querySelector('.dk-nav');
      if (!nav) return;

      if (!nav.id) nav.id = controls || 'dk-nav';
      toggle.hidden = false;
      nav.hidden = false;
      toggle.setAttribute('aria-controls', nav.id);
      toggle.setAttribute('aria-expanded', 'false');
      nav.setAttribute('aria-hidden', 'false');

      const background = Array.from(document.querySelectorAll('#main, .dk-footer'))
        .filter(function (element) { return !header.contains(element); });
      const links = function () {
        return Array.from(nav.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'));
      };
      let open = false;

      function setInert(element, value) {
        if ('inert' in element) element.inert = value;
        if (value) element.setAttribute('aria-hidden', 'true');
        else element.removeAttribute('aria-hidden');
      }

      function setMenu(next, restoreFocus) {
        open = Boolean(next);
        const isMobile = window.matchMedia(MOBILE_QUERY).matches;
        header.classList.toggle('is-menu-open', open);
        document.body.classList.toggle('dk-menu-open', open);
        toggle.setAttribute('aria-expanded', String(open));
        const toggleLabel = toggle.querySelector('.dk-menu-label');
        if (toggleLabel) toggleLabel.textContent = open ? 'Close' : 'Menu';
        nav.setAttribute('aria-hidden', String(!open && isMobile));
        nav.hidden = !open && isMobile;
        setInert(nav, !open && isMobile);
        background.forEach(function (element) { setInert(element, open); });
        if (open) {
          const first = links()[0];
          if (first) first.focus();
        } else if (restoreFocus) {
          toggle.focus();
        }
      }

      toggle.addEventListener('click', function () { setMenu(!open, false); });
      nav.addEventListener('click', function (event) {
        if (event.target.closest('a[href]')) setMenu(false, false);
      });
      document.addEventListener('keydown', function (event) {
        if (!open) return;
        if (event.key === 'Escape') {
          event.preventDefault();
          setMenu(false, true);
          return;
        }
        if (event.key !== 'Tab') return;
        const items = [toggle].concat(links());
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      });
      document.addEventListener('focusin', function (event) {
        if (open && event.target !== toggle && !nav.contains(event.target)) toggle.focus();
      });

      const mobile = window.matchMedia(MOBILE_QUERY);
      const removeMedia = listenMedia(mobile, function (event) {
        setMenu(false, false);
      });
      window.addEventListener('pagehide', function () { removeMedia(); });
      setMenu(false, false);
    });
  }

  function mountMotion(root, options) {
    if (!root || !root.matches || !root.matches('[data-dk-motion]')) return null;
    const config = options || {};
    const duration = Math.max(1, Number(config.durationMs) || 10000);
    const hasDraw = typeof config.draw === 'function';
    const canAnimate = hasDraw && typeof window.requestAnimationFrame === 'function';
    const draw = hasDraw ? config.draw : function noop() {};
    const staticFrame = typeof config.staticFrame === 'function' ? config.staticFrame : draw;
    const control = root.querySelector('[data-dk-motion-toggle]');
    const label = root.querySelector('[data-dk-motion-label]');
    const reduced = window.matchMedia ? window.matchMedia(REDUCED_QUERY) : { matches: false };
    const connection = window.navigator && window.navigator.connection;
    let elapsed = Math.max(0, Number(root.dataset.motionElapsed) || 0);
    let userPaused = false;
    let visible = true;
    let hidden = Boolean(document.hidden);
    let frame = 0;
    let lastTime = 0;
    let destroyed = false;
    let lastState = '';

    function saveData() { return Boolean(connection && connection.saveData); }
    function staticReason() {
      if (!canAnimate) return 'static';
      if (reduced.matches) return 'reduced-motion';
      if (saveData()) return 'save-data';
      if (hidden) return 'page-hidden';
      if (!visible) return 'out-of-view';
      if (userPaused) return 'paused';
      return 'playing';
    }
    function setState(state) {
      root.dataset.motionState = state;
      root.dataset.motionElapsed = String(Math.round(elapsed));
      if (control) {
        const inactive = state === 'reduced-motion' || state === 'save-data' || state === 'static';
        control.hidden = false;
        control.disabled = inactive;
        control.setAttribute('aria-pressed', String(userPaused));
        control.setAttribute('aria-label', inactive ? 'Motion unavailable' : (userPaused ? 'Play motion' : 'Pause motion'));
      }
      if (label) label.textContent = (state === 'reduced-motion' || state === 'save-data' || state === 'static')
        ? 'Still'
        : (userPaused ? 'Play' : 'Pause');
    }
    function renderStatic(state) {
      setState(state);
      staticFrame(0, { elapsed: elapsed, durationMs: duration, state: state, root: root });
    }
    function stopFrame() {
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
      lastTime = 0;
    }
    function tick(now) {
      frame = 0;
      if (destroyed) return;
      const state = staticReason();
      if (state !== 'playing') {
        setState(state);
        if (state === 'reduced-motion' || state === 'save-data' || state === 'static') renderStatic(state);
        return;
      }
      if (lastTime) elapsed += Math.max(0, now - lastTime);
      lastTime = now;
      setState('playing');
      draw(elapsed % duration, { elapsed: elapsed, durationMs: duration, state: 'playing', root: root });
      frame = window.requestAnimationFrame(tick);
    }
    function sync() {
      if (destroyed) return;
      const state = staticReason();
      if (state !== 'playing') {
        stopFrame();
        setState(state);
        if (state === 'reduced-motion' || state === 'save-data' || state === 'static') renderStatic(state);
        lastState = state;
        return;
      }
      if (lastState !== 'playing') lastTime = 0;
      lastState = 'playing';
      setState('playing');
      if (!frame) frame = window.requestAnimationFrame(tick);
    }
    function onToggle() {
      userPaused = !userPaused;
      sync();
    }
    if (control) control.addEventListener('click', onToggle);
    const removeReduced = listenMedia(reduced, sync);
    const removeConnection = connection && typeof connection.addEventListener === 'function'
      ? (connection.addEventListener('change', sync), function () { connection.removeEventListener('change', sync); })
      : function noop() {};
    const onVisibility = function () { hidden = Boolean(document.hidden); sync(); };
    document.addEventListener('visibilitychange', onVisibility);
    let observer = null;
    if ('IntersectionObserver' in window) {
      observer = new window.IntersectionObserver(function (entries) {
        if (entries[0]) { visible = entries[0].isIntersecting; sync(); }
      }, { threshold: 0.01 });
      observer.observe(root);
    }
    setState(staticReason());
    if (staticReason() === 'reduced-motion' || staticReason() === 'save-data' || staticReason() === 'static') {
      renderStatic(staticReason());
    } else {
      draw(0, { elapsed: elapsed, durationMs: duration, state: 'playing', root: root });
    }
    sync();
    return {
      destroy: function () {
        destroyed = true;
        stopFrame();
        if (observer) observer.disconnect();
        removeReduced();
        removeConnection();
        document.removeEventListener('visibilitychange', onVisibility);
        if (control) control.removeEventListener('click', onToggle);
      },
      pause: function () { userPaused = true; sync(); },
      play: function () { userPaused = false; sync(); },
      get elapsed() { return elapsed; },
      get state() { return root.dataset.motionState; }
    };
  }

  window.DemoKitMotion = window.DemoKitMotion || {};
  window.DemoKitMotion.mount = mountMotion;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setupMenu, { once: true });
  else setupMenu();
}(window, document));
