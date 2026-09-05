/* ==========================================================================
   MUREEH · TEAM TACTICAL SYSTEM — FormationSelector
   --------------------------------------------------------------------------
   A segmented control for the available formations. Switching never
   reloads or re-mounts anything: it just emits a change event and the
   board animates its nodes to the new coordinates.

   Rendered from FORMATION_TYPES, so registering a new formation in
   formationEngine.js is all it takes to get a new control here.
   ========================================================================== */
(function (ns) {
  "use strict";

  const t = ns.t;

  const LABELS = {
    ar: { group: "اختيار التشكيل", caption: "وصف التشكيل" },
    en: { group: "Formation view", caption: "Formation description" },
  };

  function create(options) {
    // Known formations first, in their authored order, then anything else
    // registered in FORMATION_TYPES — so adding a formation in exactly one
    // place (the engine) is enough to get a working control here.
    function resolveIds() {
      const known = (ns.FORMATION_ORDER || []).filter((id) => !!ns.FORMATION_TYPES[id]);
      const extras = Object.keys(ns.FORMATION_TYPES).filter((id) => known.indexOf(id) < 0);
      return known.concat(extras);
    }

    const ids = options.ids || resolveIds();
    let active = options.active || ids[0];
    let lang = options.lang || "ar";
    let onChange = options.onChange || function () {};

    const wrap = document.createElement("div");
    wrap.className = "tt-formations";
    wrap.setAttribute("role", "group");

    const caption = document.createElement("p");
    caption.className = "tt-formations__caption";
    caption.setAttribute("aria-live", "polite");

    const buttons = new Map();

    function paint() {
      const L = LABELS[lang] || LABELS.en;
      wrap.setAttribute("aria-label", L.group);

      if (!buttons.size) {
        ids.forEach((id) => {
          const def = ns.FORMATION_TYPES[id];
          if (!def) return;
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "tt-formation";
          btn.dataset.formation = id;
          btn.addEventListener("click", () => select(id));
          wrap.appendChild(btn);
          buttons.set(id, btn);
        });
        wrap.appendChild(caption);
      }

      buttons.forEach((btn, id) => {
        const def = ns.FORMATION_TYPES[id];
        btn.textContent = t(def.label, lang);
        btn.setAttribute("title", t(def.caption, lang));
        const isActive = id === active;
        btn.classList.toggle("is-active", isActive);
        btn.setAttribute("aria-pressed", isActive ? "true" : "false");
      });

      const def = ns.FORMATION_TYPES[active];
      caption.textContent = def ? t(def.caption, lang) : "";
      caption.setAttribute("aria-label", L.caption);
    }

    function select(id) {
      if (!ns.FORMATION_TYPES[id] || id === active) return;
      active = id;
      paint();
      onChange(id);
    }

    function setLang(next) {
      lang = next;
      paint();
    }

    function setActive(id) {
      active = id;
      paint();
    }

    paint();

    return {
      element: wrap,
      setLang,
      setActive,
      getActive: () => active,
    };
  }

  ns.FormationSelector = { create };
})(window.MureehTeam = window.MureehTeam || {});
