/* ==========================================================================
   MUREEH · TEAM TACTICAL SYSTEM — ConnectionLines
   --------------------------------------------------------------------------
   Owns the SVG layer that draws relationships between nodes.

   Lines are geometry, never images: every path is recomputed from the
   live node positions, so when a formation switch moves a node the line
   attached to it moves on the very same frame. Three relationship kinds
   are drawn differently so hierarchy reads before collaboration does:

     hierarchy  command -> front line    solid, slow signal flow
     row        row n   -> row n + 1     solid, quiet
     cross      declared collaboration   dotted, revealed on focus only

   The layer works in the board's pixel space (viewBox kept in sync by the
   board's ResizeObserver) so curves never distort on resize.
   ========================================================================== */
(function (ns) {
  "use strict";

  const SVG_NS = "http://www.w3.org/2000/svg";

  /**
   * Vertical connector: leaves the source's bottom edge and enters the
   * target's top edge, each measured against its own avatar radius.
   */
  function verticalPath(x1, y1, x2, y2, padOut, padIn) {
    const sy = y1 + padOut;
    const ey = y2 - padIn;
    const dy = Math.max(18, (ey - sy) * 0.45);
    return `M ${x1} ${sy} C ${x1} ${sy + dy}, ${x2} ${ey - dy}, ${x2} ${ey}`;
  }

  /** Lateral connector between two nodes, bowing away from the board centre. */
  function lateralPath(x1, y1, x2, y2, r1, r2, cx, cy) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const ux = dx / len;
    const uy = dy / len;

    // trim each end to the avatar's edge so lines never hide under the card
    const sx = x1 + ux * r1;
    const sy = y1 + uy * r1;
    const ex = x2 - ux * r2;
    const ey = y2 - uy * r2;

    // bow perpendicular, away from the board centre, for a deliberate arc
    let px = -uy;
    let py = ux;
    const mx = (sx + ex) / 2;
    const my = (sy + ey) / 2;
    const toCentreX = cx - mx;
    const toCentreY = cy - my;
    if (px * toCentreX + py * toCentreY > 0) {
      px = -px;
      py = -py;
    }
    // a whisper of arc — enough to feel drawn, not enough to swoop
    const bow = Math.min(24, len * 0.07);
    return `M ${sx} ${sy} Q ${mx + px * bow} ${my + py * bow}, ${ex} ${ey}`;
  }

  function createLayer() {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("class", "tt-lines");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");

    const gHierarchy = document.createElementNS(SVG_NS, "g");
    const gRow = document.createElementNS(SVG_NS, "g");
    const gCross = document.createElementNS(SVG_NS, "g");
    gHierarchy.setAttribute("class", "tt-lines__group tt-lines__group--hierarchy");
    gRow.setAttribute("class", "tt-lines__group tt-lines__group--row");
    gCross.setAttribute("class", "tt-lines__group tt-lines__group--cross");
    svg.appendChild(gCross);   // painted first -> sits behind the solid lines
    svg.appendChild(gRow);
    svg.appendChild(gHierarchy);

    const groupFor = {
      hierarchy: gHierarchy,
      row: gRow,
      cross: gCross,
    };

    let links = [];
    let paths = new Map();   // "from<to:kind" -> <path>
    let activePaths = [];    // paths currently emphasised by focus
    let sizeOf = () => ({ hw: 28, hh: 28 });
    let box = { width: 0, height: 0 };

    function linkKey(l) {
      return `${l.from}<${l.to}:${l.kind}`;
    }

    /** Build (or rebuild) the path elements for a link set. */
    function setLinks(next) {
      links = next.slice();
      paths = new Map();
      activePaths = [];
      [gHierarchy, gRow, gCross].forEach((g) => {
        while (g.firstChild) g.removeChild(g.firstChild);
      });

      links.forEach((l) => {
        const path = document.createElementNS(SVG_NS, "path");
        path.setAttribute("class", `tt-link tt-link--${l.kind}`);
        path.setAttribute("fill", "none");
        path.setAttribute("pathLength", "100");
        path.dataset.from = l.from;
        path.dataset.to = l.to;
        path.dataset.kind = l.kind;
        (groupFor[l.kind] || gRow).appendChild(path);
        paths.set(linkKey(l), path);
      });
    }

    function setViewport(width, height) {
      box = { width, height };
      svg.setAttribute("viewBox", `0 0 ${Math.max(1, width)} ${Math.max(1, height)}`);
      svg.setAttribute("width", Math.max(1, width));
      svg.setAttribute("height", Math.max(1, height));
    }

    function setSizer(fn) {
      if (typeof fn === "function") sizeOf = fn;
    }

    /** Recompute every path from a {id: {x, y}} map of NORMALISED positions. */
    function update(positions) {
      if (!box.width || !box.height) return;
      const w = box.width;
      const h = box.height;
      const cx = w / 2;
      const cy = h / 2;

      links.forEach((l) => {
        const a = positions[l.from];
        const b = positions[l.to];
        if (!a || !b) return;
        const path = paths.get(linkKey(l));
        if (!path) return;

        const ax = a.x * w;
        const ay = a.y * h;
        const bx = b.x * w;
        const by = b.y * h;
        const sa = sizeOf(l.from);
        const sb = sizeOf(l.to);

        const gap = 4;
        const vertical = Math.abs(bx - ax) < Math.abs(by - ay) * 1.15;
        const d = vertical
          ? verticalPath(ax, ay, bx, by, sa.hh + gap, sb.hh + gap)
          : lateralPath(
              ax, ay, bx, by,
              Math.max(sa.hw, sa.hh) + gap,
              Math.max(sb.hw, sb.hh) + gap,
              cx, cy
            );

        path.setAttribute("d", d);
      });
    }

    /**
     * Emphasise the links touching `id`. Only the paths that actually
     * change are written to, and geometry is never recomputed here — focus
     * is a pure presentation change.
     */
    function setFocus(id) {
      if (activePaths.length) {
        activePaths.forEach((p) => p.classList.remove("is-active"));
        activePaths.length = 0;
      }
      if (id) {
        svg.setAttribute("data-focus", id);
      } else {
        svg.removeAttribute("data-focus");
        return;
      }
      links.forEach((l) => {
        if (l.from !== id && l.to !== id) return;
        const p = paths.get(linkKey(l));
        if (!p) return;
        p.classList.add("is-active");
        activePaths.push(p);
      });
    }

    function setLive(on) {
      svg.classList.toggle("is-live", !!on);
    }

    function setReduced(on) {
      svg.classList.toggle("is-reduced", !!on);
    }

    function allPaths() {
      return Array.from(paths.values());
    }

    function pathsFor(id) {
      return links
        .filter((l) => l.from === id || l.to === id)
        .map((l) => paths.get(linkKey(l)))
        .filter(Boolean);
    }

    return {
      element: svg,
      setLinks,
      setViewport,
      setSizer,
      update,
      setFocus,
      setLive,
      setReduced,
      allPaths,
      pathsFor,
    };
  }

  ns.ConnectionLines = { createLayer };
})(window.MureehTeam = window.MureehTeam || {});
