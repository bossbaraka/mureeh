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

  const DEFAULT_PROJECTS = [
    {
      slug: "restaurants-mureeh",
      index_no: 1,
      category: "SaaS & Menu",
      year: "2025",
      title_ar: "منصّة مُريح للمطاعم والمنيو الرقمي",
      title_en: "Mureeh Restaurants & Digital Menu Platform",
      problem_ar: "تعاني المطاعم والمقاهي من تكاليف تحديث القوائم الورقية والبطء في إدارة الطلبات وتلقي المدفوعات.",
      problem_en: "Restaurants faced high reprinting costs and friction in managing daily digital menus and instant customer orders.",
      solution_ar: "منصة منيو رقمي متكاملة تتيح تصفّح المنيو، الطلب المباشر، وتحديث الأصناف والأسعار لحظياً.",
      solution_en: "A comprehensive digital menu & ordering system with real-time category updates and direct customer ordering.",
      technology_ar: "تطبيق ويب متجاوب، لوحة تحكم سريعة، وإدارة قائمة الطعام بمرونة عالية.",
      technology_en: "High-performance responsive web app, instant management dashboard, and menu sync engine.",
      result_ar: "توفير تكاليف الطباعة بنسبة 100٪ وتوفير تجربة طلب سلسة وحديثة للزبائن.",
      result_en: "100% savings on paper menu printing with seamless customer ordering.",
      result_headline_ar: "النتيجة: تشغيل فعلي مباشر للمنصة عبر الرابط: restaurantsmureeh-2.onrender.com",
      result_headline_en: "Result: Live active system running at restaurantsmureeh-2.onrender.com",
      image_path: "assets/v2/case-restaurants.jpg",
      tag_ar: "منيو رقمي / مطاعم",
      tag_en: "Digital Menu / SaaS",
      link_url: "https://restaurantsmureeh-2.onrender.com",
      sort_order: 1
    },
    {
      slug: "mureeh-cloud-platform",
      index_no: 2,
      category: "SaaS",
      year: "2025",
      title_ar: "منصّة مُريح للتشغيل السحابي",
      title_en: "Mureeh Cloud Operations Platform",
      problem_ar: "فرق العمليات كانت تدير بيانات العملاء عبر جداول بيانات متفرقة دون رؤية موحّدة للأداء.",
      problem_en: "Operations teams managed customer data across scattered spreadsheets with no unified view of performance.",
      solution_ar: "منصة تشغيل مركزية بلوحة تحكم واحدة، تدمج البيانات وتُبسّط اتخاذ القرار اليومي.",
      solution_en: "A centralized operations platform with a single dashboard that unifies data and simplifies daily decision-making.",
      technology_ar: "بنية متعددة المستأجرين، واجهات برمجية موحّدة، ونظام صلاحيات دقيق لكل فريق.",
      technology_en: "Multi-tenant architecture, unified APIs, and granular role-based permissions for every team.",
      result_ar: "خفض وقت إعداد التقارير من ساعات إلى دقائق معدودة.",
      result_en: "Reduced reporting time from hours to just minutes.",
      result_headline_ar: "النتيجة: تسريع دورة القرار بنسبة 3x — من التقرير الأسبوعي إلى الرؤية اللحظية.",
      result_headline_en: "Result: 3x faster decision cycles — from weekly reports to real-time visibility.",
      image_path: "assets/v2/case-saas.jpg",
      tag_ar: "SaaS / لوحة تحكم",
      tag_en: "SaaS / Dashboard",
      sort_order: 2
    },
    {
      slug: "order-management-app",
      index_no: 3,
      category: "Mobile",
      year: "2024",
      title_ar: "تطبيق الجوال لإدارة الطلبات",
      title_en: "Order Management Mobile App",
      problem_ar: "عملاء يعتمدون على مكالمات هاتفية لتتبع طلباتهم، ما يزيد الأعباء التشغيلية.",
      problem_en: "Customers relied on phone calls to track orders, increasing operational overhead.",
      solution_ar: "تطبيق جوال أصيل يتيح تتبع الطلب لحظيًا، مع إشعارات فورية وتجربة استخدام مبسّطة.",
      solution_en: "A native mobile app enabling real-time order tracking with instant notifications and a simplified UX.",
      technology_ar: "تطبيق متعدد المنصات، إشعارات فورية، وتكامل مباشر مع نظام الأعمال الخلفي.",
      technology_en: "Cross-platform app, push notifications, and direct integration with the backend business system.",
      result_ar: "تراجع كبير في المكالمات الواردة وارتفاع في رضا العملاء.",
      result_en: "A major drop in inbound calls and a rise in customer satisfaction.",
      result_headline_ar: "النتيجة: خفض مكالمات الدعم بنسبة 68٪ خلال أول ثلاثة أشهر.",
      result_headline_en: "Result: 68% fewer support calls within the first three months.",
      image_path: "assets/v2/case-mobile.jpg",
      tag_ar: "iOS / Android",
      tag_en: "iOS / Android",
      sort_order: 3
    },
    {
      slug: "internal-operations-system",
      index_no: 4,
      category: "Business System",
      year: "2024",
      title_ar: "نظام إدارة العمليات الداخلية",
      title_en: "Internal Operations Management System",
      problem_ar: "سير عمل يدوي معقّد بين عدة أقسام أدى إلى تأخير وتكرار في الجهد.",
      problem_en: "A complex manual workflow across departments caused delays and duplicated effort.",
      solution_ar: "نظام مركزي لأتمتة سير العمل بين الأقسام مع تتبّع كامل لكل مرحلة من المشروع.",
      solution_en: "A centralized system automating cross-department workflow with full visibility into every project stage.",
      technology_ar: "محرك سير عمل قابل للتخصيص، صلاحيات متدرجة، وتقارير تلقائية دورية.",
      technology_en: "Configurable workflow engine, tiered permissions, and automated recurring reports.",
      result_ar: "تقليص زمن إنجاز العمليات الداخلية بشكل ملحوظ.",
      result_en: "Significantly reduced internal process completion time.",
      result_headline_ar: "النتيجة: توفير أكثر من 120 ساعة عمل شهريًا عبر الفرق المختلفة.",
      result_headline_en: "Result: Over 120 work-hours saved monthly across teams.",
      image_path: "assets/v2/case-systems.jpg",
      tag_ar: "نظام داخلي",
      tag_en: "Internal System",
      sort_order: 4
    }
  ];

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
      const imgSrc = p.image_path ? (p.image_path.startsWith('/') ? p.image_path : '/' + p.image_path) : "/assets/v2/case-saas.jpg";
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
          ${p.link_url ? `
            <div style="margin-top:20px;">
              <a href="${escapeHtml(p.link_url)}" target="_blank" rel="noopener noreferrer" class="case-visit-link">
                <span>${lang === 'ar' ? 'معاينة المنصة الحية ↗' : 'Visit Live Platform ↗'}</span>
              </a>
            </div>
          ` : ""}
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
      const fetched = await res.json();
      projectsCache = (Array.isArray(fetched) && fetched.length > 0) ? fetched : DEFAULT_PROJECTS;
    } catch (err) {
      console.warn("[mureeh] Falling back: could not load /api/projects", err);
      projectsCache = DEFAULT_PROJECTS;
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
