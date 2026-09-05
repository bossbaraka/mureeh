/* ==========================================================================
   MUREEH · TEAM TACTICAL SYSTEM — TeamTactics (entry point)
   --------------------------------------------------------------------------
   Boots the feature into an existing section. It owns nothing global
   beyond `window.MureehTeam`, adds no styles outside its own stylesheet,
   and degrades to nothing at all if its mount points are absent — so
   removing the section from the page removes the feature cleanly.

   Mount contract (see index.html):
     [data-tt-toolbar]  <- FormationSelector
     [data-tt-board]    <- TacticalBoard
   ========================================================================== */
(function (ns) {
  "use strict";

  let instance = null;

  async function init(root) {
    const toolbar = root.querySelector("[data-tt-toolbar]");
    const boardHost = root.querySelector("[data-tt-board]");
    if (!boardHost) return null;

    let lang = "ar";
    if (window.MureehI18n && typeof window.MureehI18n.getLang === "function") {
      lang = window.MureehI18n.getLang();
    }

    let team;
    try {
      team = await ns.fetchTeam();
    } catch (err) {
      boardHost.innerHTML =
        '<p class="tt__error">' +
        (lang === "ar" ? "تعذّر تحميل بيانات الفريق." : "Could not load team data.") +
        "</p>";
      return null;
    }

    const board = ns.TacticalBoard.create({
      team,
      lang,
      formation: "balanced",
    });

    const selector = ns.FormationSelector.create({
      lang,
      active: "balanced",
      onChange: (id) => board.applyFormation(id, { animate: true }),
    });

    if (toolbar) toolbar.appendChild(selector.element);
    boardHost.appendChild(board.element);
    board.mount();

    // Re-render on language switch. The site fires this for every
    // data-ar/data-en swap; dynamically built nodes are handled here.
    const onLang = (e) => {
      const next = (e.detail && e.detail.lang) || (window.MureehI18n && window.MureehI18n.getLang()) || "ar";
      selector.setLang(next);
      board.setLang(next);
    };
    document.addEventListener("mureeh:langchange", onLang);

    instance = { board, selector, team, destroy };

    function destroy() {
      document.removeEventListener("mureeh:langchange", onLang);
      board.element.remove();
      // the drawer is mounted on <body>, so it must be torn down from there
      if (board.panel && board.panel.element) board.panel.element.remove();
      if (toolbar) toolbar.innerHTML = "";
      instance = null;
    }

    return instance;
  }

  function autoInit() {
    const root = document.getElementById("teamTactics");
    if (!root) return;
    if (root.dataset.ttReady === "true") return;
    root.dataset.ttReady = "true";
    Promise.resolve(init(root)).catch((err) => {
      // never let this feature break the rest of the page
      console.warn("[mureeh:team-tactics] init failed", err);
    });
  }

  ns.init = init;
  ns.getInstance = () => instance;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoInit);
  } else {
    autoInit();
  }
})(window.MureehTeam = window.MureehTeam || {});
