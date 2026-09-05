/* ==========================================================================
   MUREEH · TEAM TACTICAL SYSTEM — PlayerNode
   --------------------------------------------------------------------------
   Builds one tactical node and keeps it in sync with data + position.

   Deliberate split of responsibilities:
     • outer .tt-node          -> POSITION only (transform, written by JS
                                  during formation transitions)
     • inner .tt-node__inner   -> APPEARANCE only (hover scale, entrance,
                                  focus ring — pure CSS, so hovering one
                                  node never triggers JS for the others)

   Accessibility: each node is a real focusable button with a descriptive
   aria-label that names the person, their role and their status in words —
   status is never carried by colour alone.
   ========================================================================== */
(function (ns) {
  "use strict";

  const t = ns.t;

  function initials(name, lang) {
    const text = String(t(name, lang) || "").trim();
    if (!text) return "—";
    const parts = text.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  function describe(node, lang) {
    const m = node.member;
    const status = ns.STATUSES[m.status] || ns.STATUSES.available;
    const bits = [
      t(m.name, lang),
      m.isCaptain ? t({ ar: "قائد الفريق", en: "Team Captain" }, lang) : t(m.role, lang),  // full role, not the board abbreviation
      t(status.label, lang),
      lang === "ar" ? "اضغط لعرض التفاصيل" : "Activate to view details",
    ];
    return bits.filter(Boolean).join(" — ");
  }

  /* --------------------------------------------------------------------
     DOM CONSTRUCTION
     -------------------------------------------------------------------- */
  /** Board-appropriate label, with a graceful fall back to the long prose. */
  function boardRole(m, lang) {
    return t(m.shortRole || m.role, lang);
  }

  function boardTag(m, lang) {
    const tag = m.tag && (m.tag.ar || m.tag.en) ? m.tag : m.specialty;
    // deliberately one short phrase — seniority and full prose live in the
    // drawer, and anything longer than this ellipsises on narrow viewports
    return t(tag, lang);
  }

  function create(node, lang) {
    const m = node.member;
    const status = ns.STATUSES[m.status] || ns.STATUSES.available;
    const accent = (ns.POSITION_META[m.position] || {}).accent || "cobalt";

    const el = document.createElement("div");
    el.className = "tt-node";
    if (node.isCaptain) el.classList.add("tt-node--captain");
    el.dataset.id = m.id;
    el.dataset.position = m.position || "";
    el.dataset.status = m.status || "available";
    el.dataset.accent = accent;
    el.setAttribute("role", "button");
    el.setAttribute("tabindex", "0");
    el.setAttribute("aria-haspopup", "dialog");
    el.setAttribute("aria-label", describe(node, lang));

    const inner = document.createElement("div");
    inner.className = "tt-node__inner";

    /* --- avatar --- */
    const avatar = document.createElement("div");
    avatar.className = "tt-node__avatar";
    avatar.setAttribute("aria-hidden", "true");

    if (m.avatar) {
      const img = document.createElement("img");
      img.src = m.avatar;
      img.alt = "";
      img.loading = "lazy";
      img.className = "tt-node__photo";
      avatar.appendChild(img);
    } else {
      const mono = document.createElement("span");
      mono.className = "tt-node__mono";
      mono.textContent = initials(m.name, lang);
      avatar.appendChild(mono);
    }

    const dot = document.createElement("span");
    dot.className = "tt-node__dot";
    dot.setAttribute("aria-hidden", "true");
    const glyph = document.createElement("span");
    glyph.className = "tt-node__glyph";
    glyph.textContent = status.glyph;
    dot.appendChild(glyph);
    avatar.appendChild(dot);

    /* --- text block --- */
    const meta = document.createElement("div");
    meta.className = "tt-node__meta";

    if (node.isCaptain) {
      const badge = document.createElement("span");
      badge.className = "tt-node__badge";
      badge.textContent = "CAPTAIN";
      meta.appendChild(badge);
    }

    const name = document.createElement("span");
    name.className = "tt-node__name";
    name.textContent = t(m.name, lang);

    // role and the hover "peek" occupy one fixed-height slot so revealing
    // brief info on hover never shifts the board layout
    const line = document.createElement("span");
    line.className = "tt-node__line";

    const role = document.createElement("span");
    role.className = "tt-node__role";
    role.textContent = boardRole(m, lang);
    line.appendChild(role);

    const state = document.createElement("span");
    state.className = "tt-node__state";
    const stateGlyph = document.createElement("span");
    stateGlyph.className = "tt-node__state-glyph";
    stateGlyph.setAttribute("aria-hidden", "true");
    stateGlyph.textContent = status.glyph;
    const stateText = document.createElement("span");
    stateText.className = "tt-node__state-text";
    stateText.textContent = t(status.label, lang);
    state.appendChild(stateGlyph);
    state.appendChild(stateText);

    /* --- hover peek: the "brief info" layer, stacked in the role slot --- */
    const peek = document.createElement("span");
    peek.className = "tt-node__peek";
    peek.setAttribute("aria-hidden", "true");
    peek.textContent = boardTag(m, lang);
    line.appendChild(peek);

    meta.appendChild(name);
    meta.appendChild(line);
    meta.appendChild(state);

    inner.appendChild(avatar);
    inner.appendChild(meta);
    el.appendChild(inner);

    return el;
  }

  /* --------------------------------------------------------------------
     LANGUAGE REFRESH
     Text only — the element is never rebuilt, so an open detail panel,
     focus ring, or in-flight transition all survive a language switch.
     -------------------------------------------------------------------- */
  function updateText(el, node, lang) {
    const m = node.member;
    const status = ns.STATUSES[m.status] || ns.STATUSES.available;
    el.setAttribute("aria-label", describe(node, lang));

    const mono = el.querySelector(".tt-node__mono");
    if (mono) mono.textContent = initials(m.name, lang);

    const name = el.querySelector(".tt-node__name");
    if (name) name.textContent = t(m.name, lang);

    const role = el.querySelector(".tt-node__role");
    if (role) role.textContent = boardRole(m, lang);

    const stateText = el.querySelector(".tt-node__state-text");
    if (stateText) stateText.textContent = t(status.label, lang);

    const stateGlyph = el.querySelector(".tt-node__state-glyph");
    if (stateGlyph) stateGlyph.textContent = status.glyph;

    const dotGlyph = el.querySelector(".tt-node__glyph");
    if (dotGlyph) dotGlyph.textContent = status.glyph;

    const peek = el.querySelector(".tt-node__peek");
    if (peek) peek.textContent = boardTag(m, lang);
  }

  /* --------------------------------------------------------------------
     POSITION
     Writes a single composited transform. left/top stay at 0 so the
     browser never re-lays-out during a transition.

     The tactical coordinate is the AVATAR, not the card: the label block
     hangs below the point, and `shiftY` corrects for that so the connection
     lines meet at the face rather than crossing the text.
     -------------------------------------------------------------------- */
  function setPosition(el, nx, ny, width, height, shiftY) {
    const x = nx * width;
    const y = ny * height - (shiftY || 0);
    el.style.transform =
      `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) translate(-50%, -50%)`;
  }

  /**
   * Geometry the board needs: the avatar's half-extents (used to trim
   * line endpoints to the circle's edge) and the signed distance from the
   * card centre up to the avatar centre.
   */
  function measure(el) {
    const cardH = el.offsetHeight || 92;
    const avatar = el.querySelector(".tt-node__avatar");
    if (!avatar) {
      return { hw: 28, hh: 28, anchorDy: 0, cardW: el.offsetWidth, cardH };
    }
    const aw = avatar.offsetWidth || 56;
    const ah = avatar.offsetHeight || 56;
    const avatarTop = avatar.offsetTop;
    return {
      hw: aw / 2,
      hh: ah / 2,
      // negative: avatar centre sits above the card centre
      anchorDy: avatarTop + ah / 2 - cardH / 2,
      cardW: el.offsetWidth,
      cardH,
    };
  }

  ns.PlayerNode = { create, updateText, setPosition, measure, describe, initials };
})(window.MureehTeam = window.MureehTeam || {});
