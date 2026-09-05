/* ==========================================================================
   MUREEH LOGO PARTICLE ENGINE
   A reusable canvas-based system that renders the ACTUAL extracted geometry
   of the MUREEH bird mark as a configurable particle / dot-matrix field.

   Data source: window.MUREEH_LOGO = { ratio, lo, mid, hi, edge }
   Each tier is an array of points in normalized space [-1, 1] x [-1, 1]
   sampled directly from the real logo artwork (lo = sparse, mid = hero
   density, hi = dense halftone, edge = contour/blueprint points).

   Public API (data attributes read from the mount element):
     data-variant   = hero | sparse | dense | edge | field | reveal | network
     data-density   = 0..1   (fraction of available points used)
     data-opacity   = 0..1   (base opacity of the field)
     data-interactive = "true" | "false"
     data-animated  = "true" | "false"
     data-mono      = optional single hex color override (e.g. for ink-only look)
     data-reform    = "true" -> particles start scattered and settle into place
     data-network   = "true" -> draw connective lines between nearby particles,
                       like a network/constellation graph, instead of (or in
                       addition to) plain dots
     data-cycle     = "true" -> continuously alternate between a scattered
                       "network cloud" state and the settled logo silhouette,
                       instead of settling once and staying put. Gives the
                       impression of the network repeatedly self-organizing
                       into the brand mark.
     data-cycle-hold  = ms to hold the settled logo shape before scattering
                         again (default 3200)
     data-cycle-scatter = ms to hold the scattered cloud before re-forming
                           (default 1400)
   ========================================================================== */

(function () {
  "use strict";

  const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function pick(arr, fraction) {
    if (fraction >= 0.999) return arr;
    const n = Math.max(8, Math.floor(arr.length * fraction));
    // deterministic even sampling (keeps silhouette coherent instead of random holes)
    const out = [];
    const step = arr.length / n;
    for (let i = 0; i < n; i++) out.push(arr[Math.floor(i * step)]);
    return out;
  }

  // simple seeded PRNG so "random" scatter targets are stable across a
  // cycle's own lifetime but still feel organic from cycle to cycle
  function makeRng(seed) {
    let s = seed >>> 0;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  class LogoParticlePattern {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d", { alpha: true });
      this.variant = canvas.dataset.variant || "field";
      this.density = parseFloat(canvas.dataset.density || "1");
      this.baseOpacity = parseFloat(canvas.dataset.opacity || "1");
      this.interactive = canvas.dataset.interactive === "true";
      this.animated = canvas.dataset.animated !== "false" && !REDUCED_MOTION;
      this.mono = canvas.dataset.mono || null;
      this.reform = canvas.dataset.reform === "true";
      this.scale = parseFloat(canvas.dataset.scale || "1");
      this.network = canvas.dataset.network === "true" || this.variant === "network";
      this.cycle = canvas.dataset.cycle === "true" || this.variant === "network";
      this.cycleHold = parseFloat(canvas.dataset.cycleHold || "3200");
      this.cycleScatter = parseFloat(canvas.dataset.cycleScatter || "1400");
      this.linkDistance = parseFloat(canvas.dataset.linkDistance || "0.16");

      this.mouse = { x: 0, y: 0, active: false };
      this.raf = null;
      this.startTime = performance.now();
      this.settleDuration = 2600; // ms — "idea becoming a system"

      // cycle state machine: 'settling' -> 'formed' -> 'scattering' -> 'scattered' -> 'settling' ...
      this.cyclePhase = this.reform ? "settling" : "formed";
      this.cyclePhaseStart = this.startTime;
      this.rngSeed = 1;

      this._buildPoints();
      this._bindEvents();
      this._resize();
      window.addEventListener("resize", () => this._resize());

      if (this.animated) {
        this._loop();
      } else {
        this._drawStatic();
      }

      // Pause rendering for any off-screen canvas to save CPU/GPU,
      // not just interactive ones — keeps the site fast with many patterns.
      this._observeVisibility();
    }

    _sourceTier() {
      const data = window.MUREEH_LOGO;
      if (!data) return [];
      switch (this.variant) {
        case "sparse": return data.lo;
        case "dense": return data.hi;
        case "edge": return data.edge;
        case "hero": return data.mid;
        case "network": return data.mid;
        default: return data.mid;
      }
    }

    _buildPoints() {
      const raw = this._sourceTier();
      const chosen = pick(raw, this.density);
      const rng = makeRng(chosen.length + 7);
      this.points = chosen.map((p, i) => {
        const hasColor = p.length >= 3 && typeof p[2] === "string";
        const scatterX = (rng() * 2 - 1) * 1.6;
        const scatterY = (rng() * 2 - 1) * 1.6;
        return {
          tx: p[0], // target x normalized (logo position)
          ty: p[1], // target y normalized (logo position)
          sx: scatterX, // scattered "network cloud" position
          sy: scatterY,
          x: this.reform ? scatterX : p[0],
          y: this.reform ? scatterY : p[1],
          color: this.mono || (hasColor ? p[2] : "#1565C0"),
          r: 0.9 + Math.random() * 1.1,
          phase: Math.random() * Math.PI * 2,
          speed: 0.15 + Math.random() * 0.25,
        };
      });
    }

    _bindEvents() {
      if (!this.interactive) return;
      const rectTarget = this.canvas.parentElement || this.canvas;
      rectTarget.addEventListener("mousemove", (e) => {
        const r = this.canvas.getBoundingClientRect();
        this.mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1;
        this.mouse.y = ((e.clientY - r.top) / r.height) * 2 - 1;
        this.mouse.active = true;
      });
      rectTarget.addEventListener("mouseleave", () => {
        this.mouse.active = false;
      });
    }

    _observeVisibility() {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !this.raf && this.animated) this._loop();
          if (!entry.isIntersecting && this.raf) {
            cancelAnimationFrame(this.raf);
            this.raf = null;
          }
        });
      }, { threshold: 0.05 });
      io.observe(this.canvas);
    }

    _resize() {
      const parent = this.canvas.parentElement;
      const w = parent.clientWidth;
      const h = parent.clientHeight || parent.clientWidth * 0.6;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.canvas.width = w * dpr;
      this.canvas.height = h * dpr;
      this.canvas.style.width = w + "px";
      this.canvas.style.height = h + "px";
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.w = w;
      this.h = h;
    }

    _project(px, py) {
      const s = Math.min(this.w, this.h) * 0.46 * this.scale;
      const cx = this.w / 2;
      const cy = this.h / 2;
      return [cx + px * s, cy + py * s];
    }

    _drawStatic() {
      this._render(1);
    }

    // Advances the repeating "scatter -> reform -> hold -> scatter" state
    // machine. Returns a 0..1 "settle" factor: 1 = fully formed into the
    // logo silhouette, 0 = fully scattered into the network cloud.
    _advanceCycle(now) {
      if (!this.cycle) {
        return this.reform ? Math.min(1, (now - this.startTime) / this.settleDuration) : 1;
      }
      const elapsed = now - this.cyclePhaseStart;
      switch (this.cyclePhase) {
        case "settling": {
          const t = Math.min(1, elapsed / this.settleDuration);
          if (t >= 1) { this.cyclePhase = "formed"; this.cyclePhaseStart = now; }
          return 1 - Math.pow(1 - t, 3);
        }
        case "formed": {
          if (elapsed >= this.cycleHold) { this.cyclePhase = "scattering"; this.cyclePhaseStart = now; }
          return 1;
        }
        case "scattering": {
          const t = Math.min(1, elapsed / (this.settleDuration * 0.55));
          if (t >= 1) { this.cyclePhase = "scattered"; this.cyclePhaseStart = now; }
          return 1 - (1 - Math.pow(1 - t, 2)); // ease out from 1 -> 0
        }
        case "scattered": {
          if (elapsed >= this.cycleScatter) {
            this.cyclePhase = "settling";
            this.cyclePhaseStart = now;
          }
          return 0;
        }
        default:
          return 1;
      }
    }

    _loop() {
      const step = (now) => {
        const settle = this._advanceCycle(now);
        this._render(settle, now);
        this.raf = requestAnimationFrame(step);
      };
      this.raf = requestAnimationFrame(step);
    }

    _render(settle, now) {
      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.w, this.h);

      const t = (now || 0) / 1000;
      const projected = new Array(this.points.length);

      for (let i = 0; i < this.points.length; i++) {
        const p = this.points[i];

        // interpolate between the scattered "network cloud" position and
        // the settled logo-silhouette position using the cycle's settle
        // factor (also used by the legacy one-shot `reform` animation).
        let px = p.sx + (p.tx - p.sx) * settle;
        let py = p.sy + (p.ty - p.sy) * settle;

        // subtle organic drift, more pronounced while scattered so the
        // "network" reads as alive rather than frozen
        if (this.animated) {
          const driftAmp = 0.006 + (1 - settle) * 0.01;
          px += Math.sin(t * p.speed + p.phase) * driftAmp;
          py += Math.cos(t * p.speed * 0.8 + p.phase) * driftAmp;
        }

        // cursor displacement
        if (this.interactive && this.mouse.active) {
          const dx = px - this.mouse.x;
          const dy = py - this.mouse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const radius = 0.34;
          if (dist < radius) {
            const force = (1 - dist / radius) * 0.14;
            px += (dx / (dist || 1)) * force;
            py += (dy / (dist || 1)) * force;
          }
        }

        const [x, y] = this._project(px, py);
        projected[i] = { x, y, color: p.color, r: p.r };
      }

      // ---- network connective lines (drawn first, underneath the dots) ----
      if (this.network) {
        const s = Math.min(this.w, this.h) * 0.46 * this.scale;
        const linkPx = this.linkDistance * s;
        const linkPxSq = linkPx * linkPx;
        // While scattered, links are longer/sparser (open network feel);
        // while formed, shorten the threshold so lines trace the silhouette
        // edges rather than crossing the whole shape.
        const threshold = linkPxSq * (0.55 + settle * 0.9);
        ctx.lineWidth = 0.7;
        // spatial bucketing to keep this roughly O(n) instead of O(n^2)
        // for the point counts used on this site (hundreds, not thousands
        // of dense points at once for network-enabled canvases).
        const cell = Math.max(linkPx, 1);
        const buckets = new Map();
        const bucketKey = (x, y) => `${Math.floor(x / cell)}:${Math.floor(y / cell)}`;
        for (let i = 0; i < projected.length; i++) {
          const key = bucketKey(projected[i].x, projected[i].y);
          if (!buckets.has(key)) buckets.set(key, []);
          buckets.get(key).push(i);
        }
        const neighborsOf = (x, y) => {
          const cx = Math.floor(x / cell);
          const cy = Math.floor(y / cell);
          const out = [];
          for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
              const arr = buckets.get(`${cx + dx}:${cy + dy}`);
              if (arr) out.push(...arr);
            }
          }
          return out;
        };
        const maxLinksPerPoint = 3;
        for (let i = 0; i < projected.length; i++) {
          const a = projected[i];
          const candidates = neighborsOf(a.x, a.y);
          let links = 0;
          for (let k = 0; k < candidates.length && links < maxLinksPerPoint; k++) {
            const j = candidates[k];
            if (j <= i) continue;
            const b = projected[j];
            const ddx = a.x - b.x;
            const ddy = a.y - b.y;
            const distSq = ddx * ddx + ddy * ddy;
            if (distSq < threshold) {
              const alpha = this.baseOpacity * (1 - distSq / threshold) * 0.55;
              if (alpha <= 0.01) continue;
              ctx.beginPath();
              ctx.strokeStyle = a.color;
              ctx.globalAlpha = Math.min(1, alpha);
              ctx.moveTo(a.x, a.y);
              ctx.lineTo(b.x, b.y);
              ctx.stroke();
              links++;
            }
          }
        }
      }

      // ---- dots ----
      for (let i = 0; i < projected.length; i++) {
        const p = projected[i];
        const point = this.points[i];
        const alpha = this.baseOpacity * (0.55 + 0.45 * Math.sin(t * point.speed + point.phase) * 0.5 + 0.5);
        ctx.beginPath();
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.min(1, alpha);
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  function initAll() {
    document.querySelectorAll("canvas[data-logo-pattern]").forEach((canvas) => {
      if (canvas._mureehInit) return;
      canvas._mureehInit = true;
      new LogoParticlePattern(canvas);
    });
  }

  window.MureehLogoEngine = { LogoParticlePattern, initAll };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAll);
  } else {
    initAll();
  }
})();
