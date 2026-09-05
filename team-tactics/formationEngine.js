/* ==========================================================================
   MUREEH · TEAM TACTICAL SYSTEM — automatic formation engine
   --------------------------------------------------------------------------
   Decides WHERE every member stands and WHO connects to whom, purely from
   data. No coordinates are ever authored per-person.

   Contract:
     computeFormation(formationId, team, viewport) ->
       {
         id, label, caption,
         captain: { x, y },
         nodes:  [{ member, x, y, row, lane }],   // x/y are normalised 0..1
         links:  [{ from, to, kind }],            // kind: hierarchy|row|cross
         rows:   [[nodeId, ...], ...]
       }

   Adding a member with an unknown `position` is safe: the engine
   keyword-matches their role, and if that fails too it drops them into the
   least-loaded lane, then into an overflow bench row. It never throws.

   Adding a NEW formation = add one entry to FORMATION_TYPES. Nothing else
   in the feature needs to change.
   ========================================================================== */
(function (ns) {
  "use strict";

  /* --------------------------------------------------------------------
     VIEWPORT BUCKETS
     The engine emits a different layout per bucket so the board stays
     legible instead of being squeezed. `mobile` produces a vertical
     tactical flow (captain on top, squads stacked beneath).
     -------------------------------------------------------------------- */
  function viewportBucket(width) {
    if (width < 640) return "mobile";
    if (width < 1000) return "tablet";
    return "desktop";
  }

  /* --------------------------------------------------------------------
     SLOT GRAMMAR
     A formation is an ordered list of slots. Each slot declares which
     positions it *prefers*; the assignment pass fills preferred matches
     first, then back-fills leftovers by seniority.

     x/y are normalised (0..1) anchors in the board's coordinate space.
     -------------------------------------------------------------------- */

  /* Captain anchor sits low enough that the card's extra height (badge +
     larger avatar) stays inside the board even at its minimum height. */
  const CAPTAIN_SLOT = {
    desktop: { x: 0.5, y: 0.15 },
    tablet: { x: 0.5, y: 0.16 },
    mobile: { x: 0.5, y: 0.115 },
  };

  const FORMATION_TYPES = {
    /* ------------------------------------------------------------------
       BALANCED — the default. A symmetric diamond: the surface layer wide,
       the core engine in the middle, delivery closing underneath.
       ------------------------------------------------------------------ */
    balanced: {
      label: { ar: "متوازن", en: "Balanced" },
      caption: {
        ar: "التشكيل الافتراضي — القيادة في الأعلى، والفرق موزّعة حولها بتوازن.",
        en: "Default shape — command on top, squads balanced around it.",
      },
      slots: [
        { row: 0, x: 0.29, y: 0.365, prefer: ["design"] },
        { row: 0, x: 0.71, y: 0.365, prefer: ["infrastructure"] },
        { row: 1, x: 0.155, y: 0.605, prefer: ["frontend"] },
        { row: 1, x: 0.5, y: 0.585, prefer: ["backend"] },
        { row: 1, x: 0.845, y: 0.605, prefer: ["ai"] },
        { row: 2, x: 0.5, y: 0.835, prefer: ["mobile", "growth"] },
      ],
      mobile: [
        { row: 0, x: 0.28, y: 0.245, prefer: ["design"] },
        { row: 0, x: 0.72, y: 0.245, prefer: ["infrastructure"] },
        { row: 1, x: 0.28, y: 0.445, prefer: ["frontend"] },
        { row: 1, x: 0.72, y: 0.445, prefer: ["backend"] },
        { row: 2, x: 0.28, y: 0.645, prefer: ["ai"] },
        { row: 2, x: 0.72, y: 0.645, prefer: ["mobile", "growth"] },
      ],
      tablet: [
        { row: 0, x: 0.29, y: 0.34, prefer: ["design"] },
        { row: 0, x: 0.71, y: 0.34, prefer: ["infrastructure"] },
        { row: 1, x: 0.16, y: 0.585, prefer: ["frontend"] },
        { row: 1, x: 0.5, y: 0.565, prefer: ["backend"] },
        { row: 1, x: 0.84, y: 0.585, prefer: ["ai"] },
        { row: 2, x: 0.5, y: 0.82, prefer: ["mobile", "growth"] },
      ],
    },

    /* ------------------------------------------------------------------
       ENGINEERING — build capacity pushed to the front line, craft and
       delivery stacked behind it.
       ------------------------------------------------------------------ */
    engineering: {
      label: { ar: "هندسي", en: "Engineering" },
      caption: {
        ar: "الخط الأمامي هندسي بالكامل — الواجهة والخلفية والذكاء في المقدمة.",
        en: "Front line is pure build — interface, backend and AI leading.",
      },
      slots: [
        { row: 0, x: 0.2, y: 0.37, prefer: ["backend"] },
        { row: 0, x: 0.5, y: 0.335, prefer: ["frontend"] },
        { row: 0, x: 0.8, y: 0.37, prefer: ["ai"] },
        { row: 1, x: 0.33, y: 0.62, prefer: ["infrastructure"] },
        { row: 1, x: 0.67, y: 0.62, prefer: ["mobile"] },
        { row: 2, x: 0.5, y: 0.855, prefer: ["design", "growth"] },
      ],
      mobile: [
        { row: 0, x: 0.28, y: 0.245, prefer: ["backend"] },
        { row: 0, x: 0.72, y: 0.245, prefer: ["frontend"] },
        { row: 1, x: 0.28, y: 0.445, prefer: ["ai"] },
        { row: 1, x: 0.72, y: 0.445, prefer: ["infrastructure"] },
        { row: 2, x: 0.28, y: 0.645, prefer: ["mobile"] },
        { row: 2, x: 0.72, y: 0.645, prefer: ["design", "growth"] },
      ],
      tablet: [
        { row: 0, x: 0.2, y: 0.345, prefer: ["backend"] },
        { row: 0, x: 0.5, y: 0.315, prefer: ["frontend"] },
        { row: 0, x: 0.8, y: 0.345, prefer: ["ai"] },
        { row: 1, x: 0.33, y: 0.605, prefer: ["infrastructure"] },
        { row: 1, x: 0.67, y: 0.605, prefer: ["mobile"] },
        { row: 2, x: 0.5, y: 0.845, prefer: ["design", "growth"] },
      ],
    },

    /* ------------------------------------------------------------------
       CREATIVE — the experience layer leads directly under command and
       the build squad widens out beneath it. An inverted triangle.
       ------------------------------------------------------------------ */
    creative: {
      label: { ar: "إبداعي", en: "Creative" },
      caption: {
        ar: "التجربة في المقدّمة — التصميم يقود مباشرة تحت القيادة.",
        en: "Experience first — design leads directly beneath command.",
      },
      slots: [
        { row: 0, x: 0.5, y: 0.34, prefer: ["design"] },
        { row: 1, x: 0.24, y: 0.6, prefer: ["frontend"] },
        { row: 1, x: 0.5, y: 0.575, prefer: ["ai"] },
        { row: 1, x: 0.76, y: 0.6, prefer: ["growth"] },
        { row: 2, x: 0.3, y: 0.845, prefer: ["backend"] },
        { row: 2, x: 0.7, y: 0.845, prefer: ["infrastructure", "mobile"] },
      ],
      mobile: [
        { row: 0, x: 0.5, y: 0.24, prefer: ["design"] },
        { row: 1, x: 0.28, y: 0.445, prefer: ["frontend"] },
        { row: 1, x: 0.72, y: 0.445, prefer: ["growth"] },
        { row: 2, x: 0.28, y: 0.645, prefer: ["ai"] },
        { row: 2, x: 0.72, y: 0.645, prefer: ["backend"] },
        { row: 3, x: 0.5, y: 0.845, prefer: ["infrastructure", "mobile"] },
      ],
      tablet: [
        { row: 0, x: 0.5, y: 0.315, prefer: ["design"] },
        { row: 1, x: 0.24, y: 0.58, prefer: ["frontend"] },
        { row: 1, x: 0.5, y: 0.56, prefer: ["ai"] },
        { row: 1, x: 0.76, y: 0.58, prefer: ["growth"] },
        { row: 2, x: 0.3, y: 0.835, prefer: ["backend"] },
        { row: 2, x: 0.7, y: 0.835, prefer: ["infrastructure", "mobile"] },
      ],
    },

    /* ------------------------------------------------------------------
       STARTUP — a tight huddle. Two concentric arcs around command: the
       inner arc is the day-to-day core, the outer arc is the extension.
       ------------------------------------------------------------------ */
    startup: {
      label: { ar: "شركة ناشئة", en: "Startup" },
      caption: {
        ar: "تشكيل مضغوط — نواة تعمل على تماس مباشر مع القيادة، وامتداد خلفها.",
        en: "Compact shape — a core squad in direct contact with command.",
      },
      slots: [
        { row: 0, x: 0.315, y: 0.395, prefer: ["backend"] },
        { row: 0, x: 0.5, y: 0.34, prefer: ["frontend"] },
        { row: 0, x: 0.685, y: 0.395, prefer: ["design"] },
        { row: 1, x: 0.195, y: 0.7, prefer: ["infrastructure"] },
        { row: 1, x: 0.5, y: 0.775, prefer: ["ai"] },
        { row: 1, x: 0.805, y: 0.7, prefer: ["mobile", "growth"] },
      ],
      mobile: [
        { row: 0, x: 0.28, y: 0.245, prefer: ["backend"] },
        { row: 0, x: 0.72, y: 0.245, prefer: ["frontend"] },
        { row: 1, x: 0.28, y: 0.445, prefer: ["design"] },
        { row: 1, x: 0.72, y: 0.445, prefer: ["infrastructure"] },
        { row: 2, x: 0.28, y: 0.645, prefer: ["ai"] },
        { row: 2, x: 0.72, y: 0.645, prefer: ["mobile", "growth"] },
      ],
      tablet: [
        { row: 0, x: 0.315, y: 0.365, prefer: ["backend"] },
        { row: 0, x: 0.5, y: 0.315, prefer: ["frontend"] },
        { row: 0, x: 0.685, y: 0.365, prefer: ["design"] },
        { row: 1, x: 0.195, y: 0.685, prefer: ["infrastructure"] },
        { row: 1, x: 0.5, y: 0.76, prefer: ["ai"] },
        { row: 1, x: 0.805, y: 0.685, prefer: ["mobile", "growth"] },
      ],
    },
  };

  const FORMATION_ORDER = ["balanced", "engineering", "creative", "startup"];

  /* --------------------------------------------------------------------
     POSITION CLASSIFICATION
     member.position -> known key, or the best keyword match, or null.
     -------------------------------------------------------------------- */
  function classify(member) {
    const pos = String(member.position || "").toLowerCase();
    if (ns.POSITION_META[pos]) return pos;

    const hay = [member.role, member.specialty, member.position]
      .map((v) => (typeof v === "string" ? v : (v && (v.en || v.ar)) || ""))
      .join(" ")
      .toLowerCase();

    let best = null;
    let bestScore = 0;
    Object.keys(ns.POSITION_META).forEach((key) => {
      const kw = ns.POSITION_META[key].keywords || [];
      const score = kw.reduce((acc, k) => (hay.indexOf(k) >= 0 ? acc + 1 : acc), 0);
      if (score > bestScore) {
        bestScore = score;
        best = key;
      }
    });
    return best;
  }

  /* --------------------------------------------------------------------
     ASSIGNMENT PASS
     1. Preferred matches first (highest seniority wins contested slots).
     2. Leftovers fill any free slot, nearest-first by lane density.
     3. Overflow beyond the slot count lands in a computed bench row.
     -------------------------------------------------------------------- */
  function assign(members, slots) {
    const placement = new Map();      // memberId -> slot index
    const filled = new Array(slots.length).fill(null);

    const ranked = members.slice().sort((a, b) => {
      const sa = ns.SENIORITY[a.seniority] || 2;
      const sb = ns.SENIORITY[b.seniority] || 2;
      if (sb !== sa) return sb - sa;
      return String(a.id).localeCompare(String(b.id));
    });

    const pending = [];

    ranked.forEach((member) => {
      const pos = classify(member);
      let idx = -1;
      for (let i = 0; i < slots.length; i++) {
        if (filled[i]) continue;
        if (pos && slots[i].prefer.indexOf(pos) >= 0) {
          idx = i;
          break;
        }
      }
      if (idx < 0) {
        pending.push(member);
        return;
      }
      filled[idx] = member;
      placement.set(member.id, idx);
    });

    // Back-fill: any still-free slot, taken in declaration order.
    pending.slice().forEach((member) => {
      const free = filled.findIndex((v) => !v);
      if (free < 0) return;
      filled[free] = member;
      placement.set(member.id, free);
      pending.splice(pending.indexOf(member), 1);
    });

    // True overflow — more people than the formation has slots for.
    const overflow = pending.slice();

    return { filled, placement, overflow };
  }

  /* --------------------------------------------------------------------
     ROW SPACING
     Authored slot `y` values are an ORDERING and ARC hint, never final
     coordinates: any fixed vertical layout collides with the cards as soon
     as the row count or viewport changes. So rows are distributed over
     equal bands sized from the busiest formation, and each node keeps its
     authored offset relative to its own row, scaled to sit inside the band.

     Result: the diamond / triangle / arc read is preserved, vertical
     overlap is structurally impossible, and every formation shares one
     vertical rhythm so switching never resizes the board.
     -------------------------------------------------------------------- */
  const ROW_BAND_PX = 180; // vertical room one row of cards needs, incl. clearance

  let capacityCache = null;
  function rowCapacity(bucket) {
    if (capacityCache && capacityCache[bucket]) return capacityCache[bucket];
    capacityCache = capacityCache || {};
    let max = 2;
    Object.keys(FORMATION_TYPES).forEach((fid) => {
      const slots = FORMATION_TYPES[fid][bucket] || FORMATION_TYPES[fid].slots;
      const rows = new Set(slots.map((s) => s.row)).size;
      if (rows + 1 > max) max = rows + 1; // +1 for the command band
    });
    capacityCache[bucket] = max;
    return max;
  }

  function spaceRows(nodes, bucket) {
    const capacity = rowCapacity(bucket);
    const band = 1 / capacity;

    const byRow = new Map();
    nodes.forEach((n) => {
      const key = n.isCaptain ? -1 : n.row;
      if (!byRow.has(key)) byRow.set(key, []);
      byRow.get(key).push(n);
    });

    const groups = Array.from(byRow.keys())
      .sort((a, b) => a - b)
      .map((k) => byRow.get(k));

    const count = groups.length;

    /* Clearance is deliberately ASYMMETRIC. A card is anchored on its
       avatar, so it hangs much further BELOW the point than above it:
       measured at the 180px desktop band, a member card reaches ~32px
       above the anchor and ~85px below it, the captain ~38/~111. Reserving
       symmetric half-bands is what previously clipped the bottom row.

         ARC        intra-row offset, kept inside this band fraction
         CLEAR_TOP  >= above-anchor reach (avatar radius) + one ARC
         CLEAR_BOT  >= below-anchor reach (avatar + labels) + one ARC
       Both hold as long as CSS gives each band its documented px (see
       --tt-band in team-tactics.css). */
    const ARC = 0.1;
    const CLEAR_TOP = 0.5;
    const CLEAR_BOTTOM = 0.65;

    const lo = band * CLEAR_TOP;
    const hi = 1 - band * CLEAR_BOTTOM;
    const span = hi - lo;
    const spacing = count > 1 ? span / (count - 1) : 0;
    const start = count > 1 ? lo : 0.5;

    groups.forEach((group, i) => {
      const centre = count > 1 ? start + i * spacing : 0.5;
      const mean = group.reduce((a, n) => a + n.y, 0) / group.length;
      let maxAbs = 0;
      group.forEach((n) => {
        maxAbs = Math.max(maxAbs, Math.abs(n.y - mean));
      });
      group.forEach((n) => {
        // keep the authored relationship inside the row (the arc of a line),
        // expressed as a fraction of the band so it stays well clear of the
        // neighbouring rows above and below
        const raw = maxAbs > 0 ? centre + ((n.y - mean) / maxAbs) * band * ARC : centre;
        n.y = Math.min(hi, Math.max(lo, raw));
      });
    });

    // `groups` lets the surface grow when a roster overflows the authored
    // bands, instead of squeezing cards against each other
    return { capacity, band, groups: count };
  }

  /* --------------------------------------------------------------------
     BENCH ROW
     Deterministic coordinates for overflow members so an unexpectedly
     large team still renders cleanly instead of stacking on one point.
     -------------------------------------------------------------------- */
  function benchRow(count) {
    const out = [];
    for (let i = 0; i < count; i++) {
      const spread = count === 1 ? 0.5 : 0.22 + (i * (0.56 / (count - 1)));
      out.push({ x: spread });
    }
    return out;
  }

  /* --------------------------------------------------------------------
     LINK SYNTHESIS
     hierarchy : command  ->  first occupied row          (solid)
     row       : row n    ->  nearest node in row n + 1   (solid, lighter)
     cross     : declared member.connections              (dotted, on-focus)
     -------------------------------------------------------------------- */
  function buildLinks(nodes, byId) {
    const links = [];
    const seen = new Set();
    const key = (a, b, kind) => `${kind}:${a}<${b}`;

    const rows = [];
    nodes.forEach((n) => {
      rows[n.row] = rows[n.row] || [];
      rows[n.row].push(n);
    });
    const orderedRows = rows.filter(Boolean);

    const captainId = (nodes.find((n) => n.member.isCaptain) || {}).id;

    // 1 — command to the front line
    const front = orderedRows.find((r) => !r.some((n) => n.id === captainId)) || [];
    if (captainId) {
      front.forEach((n) => {
        const k = key(captainId, n.id, "hierarchy");
        if (seen.has(k)) return;
        seen.add(k);
        links.push({ from: captainId, to: n.id, kind: "hierarchy" });
      });
    }

    // 2 — row to row, nearest-x pairing (one link per upper node)
    for (let i = 0; i < orderedRows.length - 1; i++) {
      const upper = orderedRows[i];
      const lower = orderedRows[i + 1];
      upper.forEach((u) => {
        if (u.id === captainId && front.length) {
          // command already links to the front line; avoid a duplicate
        }
        let best = null;
        let bestD = Infinity;
        lower.forEach((l) => {
          const d = Math.abs(u.x - l.x) + Math.abs(u.y - l.y) * 0.35;
          if (d < bestD) {
            bestD = d;
            best = l;
          }
        });
        if (!best) return;
        const k = key(u.id, best.id, "row");
        const already = seen.has(key(u.id, best.id, "hierarchy"));
        if (seen.has(k) || already) return;
        seen.add(k);
        links.push({ from: u.id, to: best.id, kind: "row" });
      });
    }

    // 3 — declared cross-squad collaboration
    nodes.forEach((n) => {
      const wants = Array.isArray(n.member.connections) ? n.member.connections : [];
      wants.slice(0, 2).forEach((targetPos) => {
        const target = nodes.find((o) => o.id !== n.id && classify(o.member) === targetPos);
        if (!target) return;
        const a = n.id < target.id ? n.id : target.id;
        const b = n.id < target.id ? target.id : n.id;
        const k = `cross:${a}<${b}`;
        if (seen.has(k)) return;
        seen.add(k);
        links.push({ from: a, to: b, kind: "cross" });
      });
    });

    return { links, rows: orderedRows.map((r) => r.map((n) => n.id)), byId };
  }

  /* --------------------------------------------------------------------
     MAIN
     -------------------------------------------------------------------- */
  function computeFormation(formationId, team, width) {
    const bucket = viewportBucket(width);
    const def = FORMATION_TYPES[formationId] || FORMATION_TYPES.balanced;
    const id = FORMATION_TYPES[formationId] ? formationId : "balanced";
    // authored y is only ever a relative hint; spaceRows finalises it
    const slots = (def[bucket] || def.slots).map((slot) => ({
      row: slot.row,
      x: slot.x,
      y: CAPTAIN_SLOT[bucket].y + slot.y,
      prefer: slot.prefer,
    }));

    const all = [team.captain].concat(team.members || []);
    const captain = all.find((m) => m.isCaptain) || team.captain;
    const crew = all.filter((m) => m !== captain);

    const { filled, overflow } = assign(crew, slots);

    const nodes = [];
    nodes.push({
      id: captain.id,
      member: captain,
      x: CAPTAIN_SLOT[bucket].x,
      y: CAPTAIN_SLOT[bucket].y,
      row: -1,
      isCaptain: true,
    });

    filled.forEach((member, i) => {
      if (!member) return;
      nodes.push({
        id: member.id,
        member,
        x: slots[i].x,
        y: slots[i].y,
        row: slots[i].row,
        isCaptain: false,
      });
    });

    const bench = benchRow(overflow.length);
    const deepest = nodes.reduce((m, n) => Math.max(m, n.row), 0);
    overflow.forEach((member, i) => {
      nodes.push({
        id: member.id,
        member,
        x: bench[i].x,
        // hint below every real row so the spacing pass files it last
        y: CAPTAIN_SLOT[bucket].y + 1.15 + i * 0.001,
        row: deepest + 1,
        isCaptain: false,
      });
    });

    // captain rides along in band 0 with the same treatment
    nodes.forEach((n) => {
      if (n.isCaptain) n.y = CAPTAIN_SLOT[bucket].y;
    });
    const spacing = spaceRows(nodes, bucket);
    const bands = Math.max(spacing.capacity, spacing.groups);

    nodes.forEach((n) => {
      if (n.isCaptain) n.x = CAPTAIN_SLOT[bucket].x;
    });

    const byId = new Map(nodes.map((n) => [n.id, n]));
    const { links, rows } = buildLinks(nodes, byId);
    const captainNode = nodes.find((n) => n.isCaptain);

    return {
      id,
      bucket,
      label: def.label,
      caption: def.caption,
      capacity: bands,
      captain: { x: captainNode.x, y: captainNode.y },
      nodes,
      links,
      rows,
      byId,
    };
  }

  ns.viewportBucket = viewportBucket;
  ns.rowCapacity = rowCapacity;
  ns.classify = classify;
  ns.FORMATION_TYPES = FORMATION_TYPES;
  ns.FORMATION_ORDER = FORMATION_ORDER;
  ns.computeFormation = computeFormation;
})(window.MureehTeam = window.MureehTeam || {});
