/* ==========================================================================
   MUREEH · TEAM TACTICAL SYSTEM — motion layer
   --------------------------------------------------------------------------
   The Framer-Motion-equivalent primitives for a no-build vanilla stack:
   spring-flavoured easings, a staggered entrance timeline, FLIP layout
   transitions, and a single reduced-motion switch every layer honours.

   Everything here is additive and side-effect free until called.
   ========================================================================== */
(function (ns) {
  "use strict";

  /* --------------------------------------------------------------------
     REDUCED MOTION
     A live MediaQueryList, not a one-shot snapshot — if the user flips
     the OS setting mid-session the board adapts on the next transition.
     -------------------------------------------------------------------- */
  const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
  function reduced() {
    return mql.matches === true;
  }

  /* --------------------------------------------------------------------
     EASING TOKENS
     Matched to the easing already used across the site
     (cubic-bezier(.16,1,.3,1) — an expressive decelerate, no bounce).
     -------------------------------------------------------------------- */
  const EASE = {
    out: "cubic-bezier(.16,1,.3,1)",
    inOut: "cubic-bezier(.65,0,.35,1)",
    soft: "cubic-bezier(.22,.61,.36,1)",
  };

  const DURATION = {
    layout: 620,     // formation switching
    draw: 900,       // connection line draw-in
    rise: 760,       // node entrance
    fade: 260,
  };

  /* --------------------------------------------------------------------
     ENTRANCE TIMELINE — exact schedule requested for the feature:
       0.00s  board surface
       0.30s  tactical grid
       0.60s  captain
       0.90s  first member, then +0.20s per member
       2.20s  connection lines
       2.50s  board becomes interactive
     Member delays are derived (0.9 + i*0.2) rather than hard-coded, so a
     7th or 8th member extends the sequence correctly.
     -------------------------------------------------------------------- */
  const TIMELINE = {
    surface: 0,
    grid: 300,
    captain: 600,
    firstMember: 900,
    memberStep: 200,
    links: 2200,
    live: 2500,
  };

  function memberDelay(index) {
    return TIMELINE.firstMember + index * TIMELINE.memberStep;
  }

  /* --------------------------------------------------------------------
     animate()
     Thin guard around Element.animate() so reduced-motion collapses every
     animation to its end state instead of playing it.
     -------------------------------------------------------------------- */
  function animate(el, keyframes, options) {
    if (!el || typeof el.animate !== "function") return null;
    const opts = Object.assign({ duration: DURATION.fade, easing: EASE.out, fill: "both" }, options || {});
    if (reduced()) opts.duration = 1;
    return el.animate(keyframes, opts);
  }

  /* --------------------------------------------------------------------
     lerp + easing solver
     Used to interpolate node positions during a formation switch so the
     SVG connection lines can be recomputed every single frame and stay
     perfectly attached to the nodes they join.
     -------------------------------------------------------------------- */
  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  /** CSS cubic-bezier(.16,1,.3,1) approximated as an ease-out expo-ish curve. */
  function easeOutProgress(t) {
    return 1 - Math.pow(1 - t, 3.2);
  }

  /**
   * Interpolate a map of {id: {x,y}} from `from` to `to` over `duration`,
   * calling `onFrame(positions, t)` each frame. Reduced motion jumps
   * straight to the end state with a single frame.
   */
  function tweenPositions(from, to, duration, onFrame, onDone) {
    const ids = Object.keys(to);
    if (reduced() || duration <= 0) {
      onFrame(to, 1);
      if (onDone) onDone();
      return { cancel: function () {} };
    }

    let raf = 0;
    let start = 0;
    let cancelled = false;

    function frame(now) {
      if (cancelled) return;
      if (!start) start = now;
      const raw = Math.min(1, (now - start) / duration);
      const t = easeOutProgress(raw);
      const pos = {};
      ids.forEach((id) => {
        const a = from[id] || to[id];
        const b = to[id];
        pos[id] = { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
      });
      onFrame(pos, t);
      if (raw < 1) {
        raf = window.requestAnimationFrame(frame);
      } else if (onDone) {
        onDone();
      }
    }

    raf = window.requestAnimationFrame(frame);
    return {
      cancel: function () {
        cancelled = true;
        window.cancelAnimationFrame(raf);
      },
    };
  }

  /* --------------------------------------------------------------------
     PATH DRAW
     Reveals an SVG path by animating its dash offset. Works regardless of
     path length because every link carries pathLength="100".
     -------------------------------------------------------------------- */
  function drawPath(path, delay) {
    if (!path) return null;
    if (reduced()) {
      path.style.strokeDasharray = "none";
      path.style.strokeDashoffset = "0";
      path.style.opacity = "";
      return null;
    }
    return path.animate(
      [{ strokeDashoffset: 100 }, { strokeDashoffset: 0 }],
      { duration: DURATION.draw, delay: delay || 0, easing: EASE.out, fill: "both" }
    );
  }

  /* --------------------------------------------------------------------
     focusPulse
     One-shot accent ring when a node is opened. Decorative only, so it is
     skipped entirely under reduced motion.
     -------------------------------------------------------------------- */
  function focusPulse(el) {
    if (!el || reduced()) return null;
    return el.animate(
      [
        { boxShadow: "0 0 0 0 rgba(21,101,192,.34)" },
        { boxShadow: "0 0 0 16px rgba(21,101,192,0)" },
      ],
      { duration: 700, easing: EASE.out }
    );
  }

  ns.motion = {
    reduced,
    EASE,
    DURATION,
    TIMELINE,
    memberDelay,
    animate,
    lerp,
    easeOutProgress,
    tweenPositions,
    drawPath,
    focusPulse,
  };
})(window.MureehTeam = window.MureehTeam || {});
