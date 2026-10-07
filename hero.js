(() => {
  const root = document.querySelector('.soft-hero[data-dk-motion]');
  if (!root || !window.DemoKitMotion) return;
  const spin = root.querySelector('.ring-spin');
  const strip = root.querySelector('.strip-track');
  const segment = strip.querySelector('span');
  window.DemoKitMotion.mount(root, {
    durationMs: 60000,
    draw(elapsed) {
      spin.style.transform = 'rotateY(' + elapsed / 60000 * 360 + 'deg)';
      strip.style.transform = 'translateX(' + -((elapsed / 70) % segment.getBoundingClientRect().width) + 'px)';
    },
    staticFrame() {
      spin.style.transform = 'rotateY(0deg)';
      strip.style.transform = 'translateX(0px)';
    }
  });
})();
