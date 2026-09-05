/* ==========================================================================
   MUREEH · TEAM TACTICAL SYSTEM — PlayerDetailPanel
   --------------------------------------------------------------------------
   A non-navigating detail surface. On wide screens it slides in from the
   inline-end edge so the board stays visible behind it; on narrow screens
   the same component becomes a bottom sheet. One element, created once,
   reused for every member — opening a player never re-renders the board.

   Accessibility: role=dialog + aria-modal, a focus trap while open,
   Escape to dismiss, scroll lock, and focus returned to the node that
   opened it.
   ========================================================================== */
(function (ns) {
  "use strict";

  const t = ns.t;

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, (m) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[m]));
  }

  const LABELS = {
    ar: {
      close: "إغلاق",
      captain: "قائد الفريق",
      specialization: "التخصّص",
      skills: "المهارات",
      projects: "المشروع الحالي",
      position: "الموقع في التشكيل",
      noProject: "لا يوجد مشروع مسجّل حاليًا.",
      dialog: "تفاصيل عضو الفريق",
    },
    en: {
      close: "Close",
      captain: "Team Captain",
      specialization: "Specialization",
      skills: "Skills",
      projects: "Current Project",
      position: "Board Position",
      noProject: "No project assigned right now.",
      dialog: "Team member details",
    },
  };

  function create() {
    let root = null;
    let surface = null;
    let body = null;
    let lastTrigger = null;
    let isOpen = false;
    let onLang = () => {};
    let currentMember = null;
    let currentLang = "ar";

    function build() {
      root = document.createElement("div");
      root.className = "tt-panel";
      root.setAttribute("role", "dialog");
      root.setAttribute("aria-modal", "true");
      root.setAttribute("aria-hidden", "true");
      root.hidden = true;

      const scrim = document.createElement("div");
      scrim.className = "tt-panel__scrim";
      scrim.dataset.ttClose = "";

      surface = document.createElement("div");
      surface.className = "tt-panel__surface";

      const close = document.createElement("button");
      close.type = "button";
      close.className = "tt-panel__close";
      close.dataset.ttClose = "";
      close.innerHTML = '<span aria-hidden="true">✕</span>';

      body = document.createElement("div");
      body.className = "tt-panel__body";

      surface.appendChild(close);
      surface.appendChild(body);
      root.appendChild(scrim);
      root.appendChild(surface);

      close.addEventListener("click", () => closePanel());
      scrim.addEventListener("click", () => closePanel());
      root.addEventListener("keydown", trap);
    }

    function trap(e) {
      if (e.key !== "Tab" || !isOpen) return;
      const focusables = surface.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    function render(member, lang) {
      currentMember = member;
      currentLang = lang;
      const L = LABELS[lang] || LABELS.en;
      const status = ns.STATUSES[member.status] || ns.STATUSES.available;
      const posMeta = ns.POSITION_META[member.position] || {};
      const title = member.isCaptain ? L.captain : t(member.role, lang);
      const skills = Array.isArray(member.skills) ? member.skills : [];
      const projects = Array.isArray(member.projects) ? member.projects : [];
      const avatarHtml = member.avatar
        ? `<img class="tt-panel__photo" src="${esc(member.avatar)}" alt="" loading="lazy">`
        : `<span class="tt-panel__mono">${esc(ns.PlayerNode.initials(member.name, lang))}</span>`;

      body.innerHTML = `
        <div class="tt-panel__head">
          <div class="tt-panel__avatar" data-accent="${esc(posMeta.accent || "cobalt")}">${avatarHtml}</div>
          <div class="tt-panel__id">
            ${member.isCaptain ? '<span class="tt-panel__badge">CAPTAIN</span>' : ""}
            <h3 class="tt-panel__name" id="ttPanelName">${esc(t(member.name, lang))}</h3>
            <p class="tt-panel__role">${esc(title)}</p>
            <p class="tt-panel__exp">${esc(t(member.experience, lang))}</p>
            <p class="tt-panel__status" data-status="${esc(member.status || "available")}">
              <span aria-hidden="true">${esc(status.glyph)}</span>
              <span>${esc(t(status.label, lang))}</span>
            </p>
          </div>
        </div>

        <div class="tt-panel__block">
          <h4 class="tt-panel__label">${esc(L.specialization)}</h4>
          <p class="tt-panel__value">${esc(t(member.specialty, lang))}</p>
        </div>

        <div class="tt-panel__block">
          <h4 class="tt-panel__label">${esc(L.skills)}</h4>
          <ul class="tt-panel__skills">
            ${skills.map((s) => `<li>${esc(s)}</li>`).join("")}
          </ul>
        </div>

        <div class="tt-panel__block">
          <h4 class="tt-panel__label">${esc(L.projects)}</h4>
          ${
            projects.length
              ? `<ul class="tt-panel__projects">${projects
                  .map(
                    (p) => `<li>
                        <span class="tt-panel__proj-name">${esc(t(p.name, lang))}</span>
                        <span class="tt-panel__proj-role">${esc(t(p.role, lang))}</span>
                      </li>`
                  )
                  .join("")}</ul>`
              : `<p class="tt-panel__empty">${esc(L.noProject)}</p>`
          }
        </div>

        <div class="tt-panel__block">
          <h4 class="tt-panel__label">${esc(L.position)}</h4>
          <p class="tt-panel__value tt-panel__value--mono">${esc(t(posMeta.label, lang) || "—")}</p>
        </div>
      `;

      const L2 = LABELS[lang] || LABELS.en;
      root.setAttribute("aria-label", L2.dialog);
      const closeBtn = surface.querySelector(".tt-panel__close");
      if (closeBtn) closeBtn.setAttribute("aria-label", L2.close);
    }

    function openPanel(member, lang, trigger) {
      if (!root) build();
      lastTrigger = trigger || document.activeElement;
      render(member, lang);
      root.hidden = false;
      root.setAttribute("aria-hidden", "false");
      document.body.classList.add("tt-scroll-lock");
      // force a frame so the transition has a start state to animate from
      void root.offsetWidth;
      root.classList.add("is-open");
      isOpen = true;
      const closeBtn = surface.querySelector(".tt-panel__close");
      if (closeBtn) closeBtn.focus();
      document.addEventListener("keydown", onDocKey);
    }

    function closePanel() {
      if (!root || !isOpen) return;
      root.classList.remove("is-open");
      root.setAttribute("aria-hidden", "true");
      isOpen = false;
      document.body.classList.remove("tt-scroll-lock");
      document.removeEventListener("keydown", onDocKey);

      const finish = () => {
        root.hidden = true;
        if (lastTrigger && typeof lastTrigger.focus === "function" && document.contains(lastTrigger)) {
          lastTrigger.focus();
        }
        lastTrigger = null;
      };

      if (ns.motion.reduced()) {
        finish();
      } else {
        surface.addEventListener("transitionend", function once() {
          surface.removeEventListener("transitionend", once);
          if (!isOpen) finish();
        });
        window.setTimeout(() => {
          if (!isOpen && root.hidden) return;
          if (!isOpen) finish();
        }, 420);
      }
    }

    function onDocKey(e) {
      if (e.key === "Escape") {
        e.stopPropagation();
        closePanel();
      }
    }

    /** Re-render in place when the visitor flips language while open. */
    function setLang(lang) {
      if (isOpen && currentMember) render(currentMember, lang);
    }

    function getIsOpen() {
      return isOpen;
    }

    return {
      open: openPanel,
      close: closePanel,
      setLang,
      isOpen: getIsOpen,
      get element() {
        if (!root) build();
        return root;
      },
    };
  }

  ns.PlayerDetailPanel = { create };
})(window.MureehTeam = window.MureehTeam || {});
