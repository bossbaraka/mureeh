/* ==========================================================================
   MUREEH — bilingual (AR/EN) switcher
   Persists choice in localStorage, flips dir/lang, swaps all data-ar/data-en
   text nodes, placeholders, and html-safe fragments (data-ar-html/data-en-html).
   ========================================================================== */
(function () {
  "use strict";

  const STORAGE_KEY = "mureeh_lang";
  const supported = ["ar", "en"];

  function getSavedLang() {
    const saved = localStorage.getItem(STORAGE_KEY);
    return supported.includes(saved) ? saved : "ar";
  }

  function applyLanguage(lang) {
    document.documentElement.setAttribute("lang", lang);
    document.documentElement.setAttribute("dir", lang === "ar" ? "rtl" : "ltr");
    document.body.classList.toggle("lang-en", lang === "en");

    // plain text swaps
    document.querySelectorAll(`[data-${lang}]`).forEach((el) => {
      if (el.hasAttribute(`data-${lang}-html`) || el.hasAttribute(`data-${lang}-placeholder`)) return;
      const val = el.getAttribute(`data-${lang}`);
      if (val !== null) el.textContent = val;
    });

    // html-safe fragments (e.g. headlines with <br> / <em>)
    document.querySelectorAll(`[data-${lang}-html]`).forEach((el) => {
      const val = el.getAttribute(`data-${lang}-html`);
      if (val !== null) el.innerHTML = val;
    });

    // placeholders
    document.querySelectorAll(`[data-${lang}-placeholder]`).forEach((el) => {
      const val = el.getAttribute(`data-${lang}-placeholder`);
      if (val !== null) el.setAttribute("placeholder", val);
    });

    // language toggle button label shows the OTHER language (desktop + mobile variants)
    ["langSwitch", "langSwitchMobile"].forEach((id) => {
      const btn = document.getElementById(id);
      if (btn) btn.textContent = lang === "ar" ? "EN" : "عربي";
    });

    localStorage.setItem(STORAGE_KEY, lang);
    document.dispatchEvent(new CustomEvent("mureeh:langchange", { detail: { lang } }));
  }

  function initSwitcher() {
    const lang = getSavedLang();
    applyLanguage(lang);

    ["langSwitch", "langSwitchMobile"].forEach((id) => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.addEventListener("click", () => {
          const current = document.documentElement.getAttribute("lang") || "ar";
          const next = current === "ar" ? "en" : "ar";
          applyLanguage(next);
        });
      }
    });
  }

  window.MureehI18n = {
    getLang: () => document.documentElement.getAttribute("lang") || "ar",
    apply: applyLanguage,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initSwitcher);
  } else {
    initSwitcher();
  }
})();
