/* ==========================================================================
   MUREEH — dynamic portfolio (case studies) fed from /api/projects
   Renders bilingual project data pulled live from the SQLite-backed API,
   re-renders instantly on language switch, and reuses the logo pattern
   engine for the on-hover overlay per project.
   ========================================================================== */
(function () {
  "use strict";

  const container = document.getElementById("caseStudiesContainer");
  if (!container) return;

  let projectsCache = [];

  const labels = {
    ar: {
      problem: "المشكلة", solution: "الحل", technology: "التقنية", result: "النتيجة",
      empty: "لا توجد مشاريع منشورة بعد.", project: "مشروع",
    },
    en: {
      problem: "The Problem", solution: "The Solution", technology: "Technology", result: "Result",
      empty: "No published projects yet.", project: "PROJECT",
    }
  };

  const patternVariants = ["hero", "sparse", "edge", "dense"];

  function escapeHtml(str) {
    if (!str) return "";
    return String(str).replace(/[&<>"']/g, (m) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[m]));
  }

  function renderProjects(lang) {
    if (projectsCache.length === 0) {
      container.innerHTML = `<div style="padding:60px 0; text-align:center; color:var(--graphite-2);">${labels[lang].empty}</div>`;
      return;
    }

    const L = labels[lang];
    const html = projectsCache.map((p, i) => {
      const title = lang === "ar" ? p.title_ar : p.title_en;
      const problem = lang === "ar" ? p.problem_ar : p.problem_en;
      const solution = lang === "ar" ? p.solution_ar : p.solution_en;
      const technology = lang === "ar" ? p.technology_ar : p.technology_en;
      const resultHeadline = lang === "ar" ? p.result_headline_ar : p.result_headline_en;
      const tag = lang === "ar" ? p.tag_ar : p.tag_en;
      const variant = patternVariants[i % patternVariants.length];
      const imgSrc = p.image_path ? `/${p.image_path}` : "assets/v2/case-saas.jpg";
      const indexLabel = String(p.index_no || i + 1).padStart(2, "0");

      return `
        <div class="case reveal in">
          <div class="case-head">
            <div>
              <span class="case-index">${L.project} ${indexLabel} — ${escapeHtml(p.category || "")}</span>
              <h3>${escapeHtml(title)}</h3>
            </div>
            <span class="case-year">${escapeHtml(p.year || "")}</span>
          </div>
          <div class="case-visual">
            <img src="${imgSrc}" alt="${escapeHtml(title)}" loading="lazy">
            <canvas class="case-pattern-overlay" data-logo-pattern data-variant="${variant}" data-density="0.5" data-opacity="0.5" data-interactive="false" data-animated="true" data-mono="#F6F3EC" data-scale="1.1"></canvas>
            ${tag ? `<span class="case-tag">${escapeHtml(tag)}</span>` : ""}
          </div>
          <div class="case-grid">
            <div class="col"><span>${L.problem}</span><p>${escapeHtml(problem)}</p></div>
            <div class="col"><span>${L.solution}</span><p>${escapeHtml(solution)}</p></div>
            <div class="col"><span>${L.technology}</span><p>${escapeHtml(technology)}</p></div>
            <div class="col"><span>${L.result}</span><p>${escapeHtml(resultHeadline)}</p></div>
          </div>
          ${resultHeadline ? `<div class="case-result">${escapeHtml(resultHeadline)}</div>` : ""}
        </div>
      `;
    }).join("");

    container.innerHTML = html;

    // (re)initialize any new canvases created dynamically
    if (window.MureehLogoEngine) window.MureehLogoEngine.initAll();
  }

  /* ------------------------------------------------------------------
     Deep-link repair.
     This section populates asynchronously and grows the page by several
     thousand pixels AFTER the browser has already resolved a URL fragment,
     so any #anchor below #work (about / process / team / contact) lands
     thousands of pixels short of its target. Re-align once, after the
     reflow, and never fight a visitor who has already scrolled.
     ------------------------------------------------------------------ */
  let hashRepaired = false;
  let visitorScrolled = false;
  ["wheel", "touchstart", "keydown"].forEach((evt) => {
    window.addEventListener(evt, () => { visitorScrolled = true; }, { once: true, passive: true });
  });

  function repairHashScroll() {
    if (hashRepaired || visitorScrolled) return;
    const hash = (location.hash || "").trim();
    if (hash.length < 2 || hash.charAt(0) !== "#") return;
    hashRepaired = true;

    let target = null;
    try {
      target = document.querySelector(hash);
    } catch (err) {
      return; // not a usable selector — leave the browser's own scroll alone
    }
    if (!target || target.tagName !== "SECTION") return;

    const rect = target.getBoundingClientRect();
    const alreadyFine = rect.top >= -40 && rect.top <= window.innerHeight * 0.6;
    if (alreadyFine) return;

    // scroll-margin-top on sections already accounts for the fixed header
    target.scrollIntoView({ block: "start", behavior: "auto" });
  }

  async function loadAndRender() {
    try {
      const res = await fetch("/api/projects", { credentials: "same-origin" });
      if (!res.ok) throw new Error("fetch failed");
      projectsCache = await res.json();
    } catch (err) {
      console.warn("[mureeh] Falling back: could not load /api/projects", err);
      projectsCache = [];
    }
    const lang = (window.MureehI18n && window.MureehI18n.getLang()) || "ar";
    renderProjects(lang);
    // layout has changed width: give the anchor one more chance to settle
    window.requestAnimationFrame(repairHashScroll);
  }

  document.addEventListener("mureeh:langchange", (e) => {
    renderProjects(e.detail.lang);
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadAndRender);
  } else {
    loadAndRender();
  }
})();
