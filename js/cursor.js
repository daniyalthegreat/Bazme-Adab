/*
  Custom cursor — a dip-pen nib that leaves a flowing, calligraphic
  ink trail as it moves (a single tapering stroke, not sparkle dots).
  On hover over links/buttons, the nib tilts down as if pressing to
  write. Disabled automatically on touch devices (no mouse to track).
*/

(function () {
  if (window.matchMedia('(pointer: coarse)').matches) return; // skip on touch

  // ---- the nib itself: a long, tapered dip-pen shape, held at an
  // angle, with a thin center slit like a real nib's ink channel ----
  const cursor = document.createElement('div');
  cursor.id = 'ink-cursor';
  cursor.innerHTML = `
    <svg viewBox="0 0 30 30" width="30" height="30">
      <g id="nib-group" transform="rotate(-40 15 15)">
        <path d="M15 4 L20 16 C20 22 17.5 26 15 28 C12.5 26 10 22 10 16 Z"
              fill="#1C2333" stroke="#1C2333" stroke-width="0.5"/>
        <path d="M15 15 L15 27" stroke="#F7F3EC" stroke-width="0.8" opacity="0.7"/>
        <circle cx="15" cy="15.5" r="1.3" fill="#F7F3EC" opacity="0.55"/>
      </g>
    </svg>
  `;
  document.body.appendChild(cursor);

  // ---- the trail: one continuous SVG path redrawn from recent
  // points, tapering and fading toward the tail, like real ink ----
  const svgNS = 'http://www.w3.org/2000/svg';
  const trailSvg = document.createElementNS(svgNS, 'svg');
  trailSvg.id = 'ink-trail-svg';
  const trailPath = document.createElementNS(svgNS, 'path');
  trailPath.setAttribute('fill', 'none');
  trailPath.setAttribute('stroke', '#1C2333');
  trailPath.setAttribute('stroke-linecap', 'round');
  trailPath.setAttribute('stroke-linejoin', 'round');
  trailSvg.appendChild(trailPath);
  document.body.appendChild(trailSvg);

  const style = document.createElement('style');
  style.textContent = `
    * { cursor: none !important; }
    #ink-cursor {
      position: fixed;
      top: 0; left: 0;
      width: 30px; height: 30px;
      pointer-events: none;
      z-index: 10000;
      transform: translate(-15px, -26px);
      transition: transform 0.15s ease;
      will-change: transform;
    }
    #ink-cursor.pressing #nib-group {
      transform: rotate(-15deg) translate(1px, 1px);
    }
    #ink-cursor svg { display: block; overflow: visible; }
    #nib-group { transition: transform 0.18s ease; transform-origin: 15px 15px; }
    #ink-trail-svg {
      position: fixed;
      top: 0; left: 0;
      width: 100vw; height: 100vh;
      pointer-events: none;
      z-index: 9999;
      overflow: visible;
    }
  `;
  document.head.appendChild(style);

  // ---- trail point tracking ----
  const MAX_POINTS = 14;       // how long the visible stroke is
  const FADE_MS = 550;         // how long a point takes to fully vanish
  let points = []; // {x, y, t}

  function buildSmoothPath(pts) {
    if (pts.length < 2) return '';
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length - 1; i++) {
      const midX = (pts[i].x + pts[i + 1].x) / 2;
      const midY = (pts[i].y + pts[i + 1].y) / 2;
      d += ` Q ${pts[i].x} ${pts[i].y} ${midX} ${midY}`;
    }
    return d;
  }

  function render() {
    const now = Date.now();
    points = points.filter(p => now - p.t < FADE_MS);
    if (points.length > MAX_POINTS) points = points.slice(points.length - MAX_POINTS);

    if (points.length >= 2) {
      trailPath.setAttribute('d', buildSmoothPath(points));
      // Calligraphic taper: the whole stroke thins and fades as it
      // gets shorter (fewer live points = trail is dying out), giving
      // a hand-drawn ink-running-out feel rather than a constant line.
      const fullness = points.length / MAX_POINTS; // 0 (thin/faint) → 1 (full stroke)
      trailPath.setAttribute('stroke-width', String(1.2 + fullness * 2.2));
      trailPath.setAttribute('opacity', String(0.15 + fullness * 0.45));
    } else {
      trailPath.setAttribute('d', '');
    }
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);

  document.addEventListener('mousemove', function (e) {
    cursor.style.transform = `translate(${e.clientX - 15}px, ${e.clientY - 26}px)`;
    points.push({ x: e.clientX, y: e.clientY, t: Date.now() });
  });

  // ---- hover state: nib tilts flatter, as if pressed down to write,
  // whenever the pointer is over anything clickable ----
  const INTERACTIVE_SELECTOR = 'a, button, input, textarea, select, [role="button"], .plan-btn, .dash-lec-item, .lecture-action';

  document.addEventListener('mouseover', function (e) {
    if (e.target.closest(INTERACTIVE_SELECTOR)) {
      cursor.classList.add('pressing');
    }
  });
  document.addEventListener('mouseout', function (e) {
    if (e.target.closest(INTERACTIVE_SELECTOR)) {
      cursor.classList.remove('pressing');
    }
  });

  document.addEventListener('mouseleave', function () {
    cursor.style.opacity = '0';
  });
  document.addEventListener('mouseenter', function () {
    cursor.style.opacity = '1';
  });
})();