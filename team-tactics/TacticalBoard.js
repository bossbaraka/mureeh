/* ==========================================================================
   MUREEH · TEAM TACTICAL SYSTEM — TacticalBoard
   --------------------------------------------------------------------------
   Owns the board surface: grid, connection layer, nodes, hover/focus
   semantics, formation transitions and the entrance sequence.

   Performance notes
     • Hovering a node writes ONE attribute on the board. All dimming and
       emphasising is CSS descendant selectors, so no other node is
       touched, measured or re-rendered.
     • Node position lives in a single composited transform. Formation
       switches interpolate normalised coordinates on the main thread and
       recompute only the affected SVG path data.
     • Nothing is measured per frame except the path geometry, which is
       the minimum required to keep lines attached to moving nodes.
   ========================================================================== */
(function (ns) {
  "use strict";

  const SVG_NS = "http://www.w3.org/2000/svg";
  const motion = ns.motion;

  /* --------------------------------------------------------------------
     TACTICAL GRID
     A very light geometric field — graph paper at low contrast, plus
     concentric command rings behind the captain. Deliberately not a
     football pitch: no markings, no centre circle semantics, just an
     information-space substrate.
     -------------------------------------------------------------------- */
  function buildGrid(bucket) {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("class", "tt-grid");
    svg.setAttribute("viewBox", "0 0 100 100");
    svg.setAttribute("preserveAspectRatio", "none");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");

    const lines = document.createElementNS(SVG_NS, "g");
    lines.setAttribute("class", "tt-grid__lines");

    const step = bucket === "mobile" ? 16.666 : 12.5;
    for (let x = step; x < 100; x += step) {
      const l = document.createElementNS(SVG_NS, "line");
      l.setAttribute("x1", x.toFixed(3));
      l.setAttribute("x2", x.toFixed(3));
      l.setAttribute("y1", "0");
      l.setAttribute("y2", "100");
      l.setAttribute("vector-effect", "non-scaling-stroke");
      lines.appendChild(l);
    }
    const rowStep = bucket === "mobile" ? 20 : 16.666;
    for (let y = rowStep; y < 100; y += rowStep) {
      const l = document.createElementNS(SVG_NS, "line");
      l.setAttribute("y1", y.toFixed(3));
      l.setAttribute("y2", y.toFixed(3));
      l.setAttribute("x1", "0");
      l.setAttribute("x2", "100");
      l.setAttribute("vector-effect", "non-scaling-stroke");
      lines.appendChild(l);
    }
    svg.appendChild(lines);

    // Deliberately only the grid lives here. The captain's presence is a
    // radial halo positioned in pixel space by the board itself: a circle
    // drawn into this preserveAspectRatio="none" viewBox gets stretched
    // into an ellipse, which reads as pitch markings rather than depth.
    return svg;
  }

  /* --------------------------------------------------------------------
     BOARD
     -------------------------------------------------------------------- */
  function inViewport(node) {
    if (!node || !node.getBoundingClientRect) return false;
    const r = node.getBoundingClientRect();
    const h = window.innerHeight || document.documentElement.clientHeight;
    const w = window.innerWidth || document.documentElement.clientWidth;
    return r.bottom > 0 && r.top < h && r.right > 0 && r.left < w;
  }

  function create(opts) {
    const team = opts.team;
    let lang = opts.lang || "ar";
    let formationId = opts.formation || "balanced";

    const el = document.createElement("div");
    el.className = "tt-board";
    el.dataset.formation = formationId;

    const gridLayer = document.createElement("div");
    gridLayer.className = "tt-board__gridlayer";
    gridLayer.setAttribute("aria-hidden", "true");

    // command halo — depth cue for the captain, tracked through formation
    // switches so it always sits behind whoever holds the centre
    const haloEl = document.createElement("div");
    haloEl.className = "tt-board__halo";
    haloEl.setAttribute("aria-hidden", "true");
    el.appendChild(haloEl);

    const nodeLayer = document.createElement("div");
    nodeLayer.className = "tt-board__nodes";

    el.appendChild(gridLayer);
    nodeLayer.setAttribute("role", "group");
    nodeLayer.setAttribute(
      "aria-label",
      lang === "ar" ? "لوحة تشكيل الفريق" : "Team tactical board"
    );

    const lines = ns.ConnectionLines.createLayer();
    el.appendChild(lines.element);
    el.appendChild(nodeLayer);

    const panel = ns.PlayerDetailPanel.create();
    // The panel MUST live on <body>, not inside the board: the section
    // wrapper carries a .reveal transform, and any transformed ancestor
    // silently becomes the containing block for position:fixed — which
    // would trap the drawer inside the section instead of the viewport.
    document.body.appendChild(panel.element);

    /* ---------------- state ---------------- */
    let formation = null;
    let gridEl = null;
    let positions = {};                 // {id: {x, y}} normalised
    const nodeEls = new Map();          // id -> HTMLElement
    let tween = null;
    let hasPlayed = false;
    let isLive = false;
    let sizeCache = new Map();          // id -> {hw, hh}
    let box = { width: 0, height: 0 };

    function langLabel() {
      return lang;
    }

    function sizer(id) {
      return sizeCache.get(id) || { hw: 62, hh: 62 };
    }

    function measureAll() {
      nodeEls.forEach((nodeEl, id) => {
        sizeCache.set(id, ns.PlayerNode.measure(nodeEl));
      });
      lines.setSizer(sizer);
    }

    function paintPositions() {
      nodeEls.forEach((nodeEl, id) => {
        const p = positions[id];
        if (!p) return;
        const m = sizeCache.get(id);
        ns.PlayerNode.setPosition(nodeEl, p.x, p.y, box.width, box.height, m && m.anchorDy);
      });
      lines.update(positions);

      // the captain's depth halo follows the captain, whatever formation is on
      if (haloEl && formation) {
        const c = positions[formation.captain.id];
        if (c) {
          haloEl.style.transform =
            `translate3d(${(c.x * box.width).toFixed(2)}px, ${(c.y * box.height).toFixed(2)}px, 0) translate(-50%, -50%)`;
        }
      }
    }

    function syncBox() {
      box = { width: el.clientWidth, height: el.clientHeight };
      lines.setViewport(box.width, box.height);
    }

    /* ---------------- mount a formation ---------------- */
    function applyFormation(nextId, options) {
      const animateMove = !!(options && options.animate) && hasPlayed;
      const next = ns.computeFormation(nextId, team, box.width || el.clientWidth || 1200);
      const prevPositions = positions;

      formation = next;
      formationId = next.id;
      el.dataset.formation = next.id;
      // one band of clearance per row, so the surface grows instead of
      // letting cards touch when a formation needs an extra row
      el.style.setProperty("--tt-capacity", String(next.capacity || 4));
      nodeLayer.setAttribute(
        "aria-label",
        lang === "ar"
          ? `لوحة تشكيل الفريق — ${ns.t(next.label, lang)}`
          : `Team tactical board — ${ns.t(next.label, lang)}`
      );

      // grid density follows the viewport bucket, not a fixed line count
      const nextGrid = buildGrid(next.bucket);
      if (gridEl && gridEl.parentNode === gridLayer) gridLayer.removeChild(gridEl);
      gridLayer.appendChild(nextGrid);
      gridEl = nextGrid;

      ensureNodes(next);
      measureAll();

      const target = {};
      next.nodes.forEach((n) => {
        target[n.id] = { x: n.x, y: n.y };
      });

      if (!animateMove || motion.reduced() || !Object.keys(prevPositions).length) {
        positions = target;
        syncBox();
        paintPositions();
        return;
      }

      // FLIP-style: interpolate normalised coordinates, redraw lines each frame
      const from = {};
      Object.keys(target).forEach((id) => {
        from[id] = prevPositions[id] || target[id];
      });

      if (tween) tween.cancel();
      el.classList.add("is-transitioning");
      tween = motion.tweenPositions(
        from,
        target,
        motion.DURATION.layout,
        (pos) => {
          positions = pos;
          paintPositions();
        },
        () => {
          positions = target;
          paintPositions();
          el.classList.remove("is-transitioning");
        }
      );
    }

    /** Create missing node elements, retire nodes that no longer exist. */
    function ensureNodes(next) {
      const wanted = new Set(next.nodes.map((n) => n.id));

      nodeEls.forEach((nodeEl, id) => {
        if (wanted.has(id)) return;
        nodeEl.remove();
        nodeEls.delete(id);
        sizeCache.delete(id);
      });

      next.nodes.forEach((node, i) => {
        if (nodeEls.has(node.id)) {
          ns.PlayerNode.updateText(nodeEls.get(node.id), node, lang);
          return;
        }
        const nodeEl = ns.PlayerNode.create(node, lang);
        nodeEl.style.setProperty("--tt-index", String(i));
        bindNode(nodeEl, node);
        nodeLayer.appendChild(nodeEl);
        nodeEls.set(node.id, nodeEl);
      });

      lines.setLinks(next.links);
    }

    /* ---------------- interaction ---------------- */
    let focusedId = null;

    /**
     * Focus is written as ONE class on the previously focused node and ONE
     * on the newly focused node. Everything else — dimming, line emphasis,
     * the peek line — is CSS reacting to those two hooks, so hovering a
     * single node never touches the other six.
     */
    function setFocus(id) {
      if (focusedId === id) return;
      if (focusedId) {
        const prev = nodeEls.get(focusedId);
        if (prev) prev.classList.remove("is-focused");
      }
      focusedId = id || null;
      if (focusedId) {
        const next = nodeEls.get(focusedId);
        if (next) next.classList.add("is-focused");
        el.setAttribute("data-focus-id", focusedId);
      } else {
        el.removeAttribute("data-focus-id");
      }
      lines.setFocus(focusedId);
    }

    function bindNode(nodeEl, node) {
      nodeEl.addEventListener("mouseenter", () => setFocus(node.id));
      nodeEl.addEventListener("mouseleave", () => {
        if (!panel.isOpen()) setFocus(null);
      });
      nodeEl.addEventListener("focus", () => setFocus(node.id));
      nodeEl.addEventListener("blur", () => {
        if (!panel.isOpen()) setFocus(null);
      });
      nodeEl.addEventListener("click", () => openNode(node));
      nodeEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
          e.preventDefault();
          openNode(node);
        } else if (e.key.indexOf("Arrow") === 0) {
          const moved = moveFocus(e.key, nodeEl);
          if (moved) e.preventDefault();
        }
      });
    }

    function openNode(node) {
      const nodeEl = nodeEls.get(node.id);
      panel.open(node.member, lang, nodeEl);
      setFocus(node.id);
      if (nodeEl) motion.focusPulse(nodeEl.querySelector(".tt-node__avatar"));
    }

    /** Directional keyboard navigation across the board. */
    function moveFocus(key, fromEl) {
      const fromId = fromEl.dataset.id;
      const a = positions[fromId];
      if (!a) return false;

      const dirs = {
        ArrowRight: { x: 1, y: 0 },
        ArrowLeft: { x: -1, y: 0 },
        ArrowDown: { x: 0, y: 1 },
        ArrowUp: { x: 0, y: -1 },
      };
      // in RTL the visual left/right swap, so follow the writing direction
      const rtl = document.documentElement.getAttribute("dir") === "rtl";
      const d = Object.assign({}, dirs[key]);
      if (rtl && (key === "ArrowRight" || key === "ArrowLeft")) d.x = -d.x;

      let best = null;
      let bestScore = Infinity;
      Object.keys(positions).forEach((id) => {
        if (id === fromId) return;
        const b = positions[id];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const along = dx * d.x + dy * d.y;
        if (along <= 0.0001) return;
        const across = Math.abs(dx * d.y - dy * d.x);
        const score = along + across * 2.4;
        if (score < bestScore) {
          bestScore = score;
          best = id;
        }
      });

      if (!best) return false;
      const target = nodeEls.get(best);
      if (target) target.focus();
      return true;
    }

    /* ---------------- entrance sequence ---------------- */
    function play() {
      if (hasPlayed) return;
      hasPlayed = true;

      if (motion.reduced()) {
        el.classList.add("is-entered", "is-live");
        isLive = true;
        lines.setLive(true);
        lines.setReduced(true);
        paintPositions();
        return;
      }

      const T = motion.TIMELINE;
      el.classList.add("is-entering");

      // nodes: captain first, then the crew staggered by 200ms each
      formation.nodes.forEach((node) => {
        const nodeEl = nodeEls.get(node.id);
        if (!nodeEl) return;
        const crewIndex = formation.nodes.filter((n) => !n.isCaptain).indexOf(node);
        const delay = node.isCaptain ? T.captain : motion.memberDelay(Math.max(0, crewIndex));
        nodeEl.style.setProperty("--tt-delay", `${delay}ms`);
      });

      // connection lines draw after the last node has landed
      lines.allPaths().forEach((path) => {
        path.style.strokeDasharray = "100";
        path.style.strokeDashoffset = "100";
      });
      window.setTimeout(() => {
        lines.allPaths().forEach((path, i) => {
          const anim = motion.drawPath(path, i * 28);
          if (anim && anim.finished) {
            anim.finished
              .then(() => {
                anim.cancel();
                path.style.strokeDasharray = "";
                path.style.strokeDashoffset = "";
                path.classList.add("is-drawn");
              })
              .catch(() => {});
          }
        });
      }, T.links);

      window.setTimeout(() => {
        el.classList.add("is-entered");
      }, T.links);

      window.setTimeout(() => {
        el.classList.add("is-live");
        isLive = true;
        lines.setLive(true);
      }, T.live);
    }

    /* ---------------- lifecycle ---------------- */
    function mount() {
      syncBox();
      applyFormation(formationId, { animate: false });
      syncBox();
      measureAll();
      paintPositions();

      if (typeof ResizeObserver === "function") {
        const ro = new ResizeObserver(() => {
          syncBox();
          // node footprint changes with the board, so re-measure before drawing
          measureAll();
          paintPositions();
        });
        ro.observe(el);
      } else {
        window.addEventListener("resize", () => {
          syncBox();
          measureAll();
          paintPositions();
        });
      }

      /* --- reveal trigger -------------------------------------------------
         Three independent paths into play(), because a board that never
         plays is a board of invisible nodes (they sit at opacity 0 until the
         entrance runs) and that is unrecoverable for the visitor:

           1. already on screen at mount  -> play now
           2. scrolled into view          -> IntersectionObserver at ANY
              visible pixel. A fraction threshold is unsafe here: on mobile
              the board is taller than the viewport band the section leaves
              it, so a 18% requirement can go unmet at a normal scroll stop.
           3. keyboard user tabs in       -> focusin plays instantly, so a
              focused control is never invisible.
      ------------------------------------------------------------------- */
      if (inViewport(el)) {
        play();
      } else if (typeof IntersectionObserver === "function") {
        const io = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                play();
                io.disconnect();
              }
            });
          },
          { threshold: 0 }
        );
        io.observe(el);
        // last-resort net: never leave the board empty for long
        window.setTimeout(() => {
          if (inViewport(el)) play();
        }, 1500);
      } else {
        play();
      }
      nodeLayer.addEventListener("focusin", play);

      // re-measure once webfonts settle — metrics shift text width
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => {
          measureAll();
          paintPositions();
        });
      }
    }

    function setLang(next) {
      lang = next;
      panel.setLang(next);
      if (formation) {
        formation.nodes.forEach((node) => {
          const nodeEl = nodeEls.get(node.id);
          if (nodeEl) ns.PlayerNode.updateText(nodeEl, node, lang);
        });
        nodeLayer.setAttribute(
          "aria-label",
          lang === "ar"
            ? `لوحة تشكيل الفريق — ${ns.t(formation.label, lang)}`
            : `Team tactical board — ${ns.t(formation.label, lang)}`
        );
      }
      // text width changes with language, so refresh hit-boxes and geometry
      window.requestAnimationFrame(() => {
        measureAll();
        paintPositions();
      });
    }

    function getPositions() {
      return positions;
    }

    return {
      element: el,
      mount,
      applyFormation,
      setLang,
      setFocus,
      play,
      getPositions,
      panel,
      get isLive() {
        return isLive;
      },
    };
  }

  ns.TacticalBoard = { create, buildGrid };
})(window.MureehTeam = window.MureehTeam || {});
