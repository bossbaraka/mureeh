/* ==========================================================================
   MUREEH · TEAM TACTICAL SYSTEM — data layer
   --------------------------------------------------------------------------
   Single source of truth for the team. Pure data: no DOM, no rendering.
   Swap this file (or replace `fetchTeam()` with an API/Supabase call) and
   the entire Tactical Board re-renders without touching the UI layer.

   ── EDITING THE TEAM ──────────────────────────────────────────────────────
   • Add a member  -> push an object into `teamMembers`. The Formation Engine
                      places them automatically; no coordinates needed.
   • Change captain-> set `isCaptain: true` on one member.
   • Text fields   -> either a plain string (language-neutral, e.g. "Node.js")
                      or an object { ar: "...", en: "..." }.
   • `position`    -> drives auto-placement. Known values live in
                      formationEngine.js / POSITION_META. An unknown value
                      falls back to keyword-matching on `role`/`specialty`,
                      then to the least-loaded lane. Nothing breaks.

   Two label lengths exist on purpose:
     • `role` / `specialty`  -> long prose, shown in the detail panel
     • `shortRole` / `tag`   -> tight labels sized for the board itself
   Both are optional. If `shortRole`/`tag` are omitted the board falls back
   to `role`/`specialty`, and CSS ellipsis keeps the grid intact — nothing
   breaks, the label just gets shortened.

   NOTE: names/skills below are PLACEHOLDERS (the site intentionally ships
   with no invented personnel data). Replace with real data before launch.
   ========================================================================== */
(function (ns) {
  "use strict";

  /* --------------------------------------------------------------------
     STATUS VOCABULARY
     Deliberately encodes the state THREE ways (label + glyph + colour) so
     status is never communicated by colour alone — accessibility rule.
     -------------------------------------------------------------------- */
  const STATUSES = {
    available: {
      glyph: "●",
      label: { ar: "متاح", en: "Available" },
    },
    focused: {
      glyph: "◐",
      label: { ar: "في مهمّة مركّزة", en: "Deep focus" },
    },
    review: {
      glyph: "◍",
      label: { ar: "في مراجعة", en: "In review" },
    },
    off: {
      glyph: "○",
      label: { ar: "خارج الدوام", en: "Off shift" },
    },
  };

  /* --------------------------------------------------------------------
     POSITION TAXONOMY
     `family` groups positions into tactical lanes. `keywords` let the
     Formation Engine classify a member whose `position` it has never seen.
     -------------------------------------------------------------------- */
  const POSITION_META = {
    strategy: {
      family: "command",
      accent: "copper",
      label: { ar: "القيادة", en: "Command" },
      keywords: ["lead", "captain", "founder", "cto", "manager", "قائد", "مدير"],
    },
    backend: {
      family: "engineering",
      accent: "cobalt",
      label: { ar: "الخلفية", en: "Backend" },
      keywords: ["backend", "node", "api", "database", "postgres", "خلفية", "قواعد بيانات"],
    },
    frontend: {
      family: "engineering",
      accent: "cobalt",
      label: { ar: "الواجهة", en: "Frontend" },
      keywords: ["frontend", "react", "vue", "ui engineer", "واجهة", "react"],
    },
    mobile: {
      family: "engineering",
      accent: "cobalt",
      label: { ar: "الجوال", en: "Mobile" },
      keywords: ["mobile", "ios", "android", "flutter", "جوال", "تطبيقات"],
    },
    ai: {
      family: "intelligence",
      accent: "cyan",
      label: { ar: "الذكاء الاصطناعي", en: "AI" },
      keywords: ["ai", "ml", "llm", "data", "ذكاء", "بيانات"],
    },
    design: {
      family: "creative",
      accent: "copper",
      label: { ar: "التصميم", en: "Design" },
      keywords: ["design", "ux", "ui", "brand", "تصميم", "تجربة"],
    },
    infrastructure: {
      family: "platform",
      accent: "graphite",
      label: { ar: "البنية التحتية", en: "Platform" },
      keywords: ["devops", "cloud", "infra", "sre", "بنية", "سحابة"],
    },
    growth: {
      family: "growth",
      accent: "cobalt",
      label: { ar: "النمو", en: "Growth" },
      keywords: ["growth", "marketing", "product", "نمو", "تسويق", "منتج"],
    },
  };

  /* --------------------------------------------------------------------
     SENIORITY — used to rank members inside a lane and to break ties
     when the engine decides who sits closest to the Captain.
     -------------------------------------------------------------------- */
  const SENIORITY = {
    lead: 4,
    senior: 3,
    mid: 2,
    junior: 1,
  };

  /* ====================================================================
     THE CAPTAIN
     ==================================================================== */
  const captain = {
    id: "captain",
    name: { ar: "عبد الرحمن", en: "Abdelrhman" },
    role: { ar: "مهندس برمجيات / قائد الفريق", en: "Software Engineer / Team Lead" },
    shortRole: { ar: "قائد الفريق", en: "Team Lead" },
    tag: { ar: "معمارية وقيادة", en: "Architecture & Lead" },
    specialty: { ar: "معمارية الأنظمة وقيادة الفريق الهندسي", en: "Systems architecture & engineering leadership" },
    experience: { ar: "قائد الفريق", en: "Team Lead" },
    seniority: "lead",
    status: "available",
    avatar: "",
    position: "strategy",
    skills: [
      "System Architecture",
      "Technical Leadership",
      "Node.js",
      "PostgreSQL",
      "Cloud Infrastructure",
    ],
    projects: [
      { name: { ar: "منصّة مريح للتشغيل", en: "Mureeh Operations Platform" }, role: { ar: "قائد المشروع", en: "Project Lead" } },
      { name: { ar: "معمارية المنصّات متعدّدة المستأجرين", en: "Multi-tenant Platform Architecture" }, role: { ar: "معماري", en: "Architect" } },
    ],
    connections: ["backend", "frontend", "mobile", "ai", "design", "infrastructure"],
  };

  /* ====================================================================
     THE TEAM — 6 specialists.
     Add or remove freely; the Formation Engine re-flows automatically.
     ==================================================================== */
  const teamMembers = [
    {
      id: "tm-01",
      name: { ar: "أحمد هـ.", en: "Ahmed H." },
      role: { ar: "مهندس خلفية", en: "Backend Engineer" },
    shortRole: { ar: "خلفية", en: "Backend" },
    tag: { ar: "واجهات وبيانات", en: "APIs & Data" },
      specialty: { ar: "أنظمة الخلفية وواجهات برمجة التطبيقات", en: "Backend systems & API design" },
      experience: { ar: "أوّل", en: "Senior" },
      seniority: "senior",
      status: "available",
      avatar: "",
      position: "backend",
      skills: ["Node.js", "TypeScript", "REST APIs", "PostgreSQL"],
      projects: [
        { name: { ar: "محرك الفوترة والاشتراكات", en: "Billing & Subscription Engine" }, role: { ar: "المطوّر الرئيسي", en: "Lead Developer" } },
      ],
      connections: ["ai", "frontend"],
    },
    {
      id: "tm-02",
      name: { ar: "سارة خ.", en: "Sara K." },
      role: { ar: "مهندسة واجهات", en: "Frontend Engineer" },
    shortRole: { ar: "واجهة", en: "Frontend" },
    tag: { ar: "أنظمة تصميم", en: "Design Systems" },
      specialty: { ar: "أنظمة التصميم وواجهات الويب التفاعلية", en: "Design systems & interactive interfaces" },
      experience: { ar: "أوّل", en: "Senior" },
      seniority: "senior",
      status: "focused",
      avatar: "",
      position: "frontend",
      skills: ["React", "TypeScript", "Motion Design", "Accessibility"],
      projects: [
        { name: { ar: "نظام مريح للتصميم", en: "Mureeh Design System" }, role: { ar: "المسؤولة التقنية", en: "Tech Owner" } },
      ],
      connections: ["design", "backend"],
    },
    {
      id: "tm-03",
      name: { ar: "عمر ت.", en: "Omar T." },
      role: { ar: "مهندس تطبيقات جوال", en: "Mobile Engineer" },
    shortRole: { ar: "جوال", en: "Mobile" },
    tag: { ar: "iOS و Android", en: "iOS & Android" },
      specialty: { ar: "تطبيقات iOS و Android الأصلية", en: "Native iOS & Android applications" },
      experience: { ar: "متوسّط", en: "Mid-level" },
      seniority: "mid",
      status: "available",
      avatar: "",
      position: "mobile",
      skills: ["Swift", "Kotlin", "Flutter", "Offline-first"],
      projects: [
        { name: { ar: "تطبيق إدارة الميدان", en: "Field Operations App" }, role: { ar: "مطوّر الجوال", en: "Mobile Developer" } },
      ],
      connections: ["backend"],
    },
    {
      id: "tm-04",
      name: { ar: "لينا ب.", en: "Lina B." },
      role: { ar: "مهندسة ذكاء اصطناعي", en: "AI Engineer" },
    shortRole: { ar: "ذكاء اصطناعي", en: "AI" },
    tag: { ar: "نماذج وأتمتة", en: "LLM & Automation" },
      specialty: { ar: "النماذج اللغوية وأتمتة العمليات", en: "Language models & process automation" },
      experience: { ar: "متوسّط", en: "Mid-level" },
      seniority: "mid",
      status: "review",
      avatar: "",
      position: "ai",
      skills: ["LLM Integration", "Python", "RAG", "Evaluation"],
      projects: [
        { name: { ar: "مساعد مريح الذكي", en: "Mureeh Smart Assistant" }, role: { ar: "مهندسة النماذج", en: "Model Engineer" } },
      ],
      connections: ["backend", "design"],
    },
    {
      id: "tm-05",
      name: { ar: "يوسف م.", en: "Yousef M." },
      role: { ar: "مصمّم منتجات", en: "Product Designer" },
    shortRole: { ar: "تصميم", en: "Design" },
    tag: { ar: "تجربة وواجهة", en: "UX & Interface" },
      specialty: { ar: "بحث تجربة المستخدم وأنظمة الواجهات", en: "UX research & interface systems" },
      experience: { ar: "أوّل", en: "Senior" },
      seniority: "senior",
      status: "available",
      avatar: "",
      position: "design",
      skills: ["UX Research", "Interface Design", "Prototyping", "Design Tokens"],
      projects: [
        { name: { ar: "تجربة لوحة تحكّم العميل", en: "Client Dashboard Experience" }, role: { ar: "المصمّم الرئيسي", en: "Lead Designer" } },
      ],
      connections: ["frontend", "growth"],
    },
    {
      id: "tm-06",
      name: { ar: "دانا أ.", en: "Dana A." },
      role: { ar: "مهندسة بنية تحتية", en: "Platform Engineer" },
    shortRole: { ar: "بنية تحتية", en: "Platform" },
    tag: { ar: "سحابة ونشر", en: "Cloud & Delivery" },
      specialty: { ar: "السحابة وخطوط النشر المستمر", en: "Cloud infrastructure & delivery pipelines" },
      experience: { ar: "متوسّط", en: "Mid-level" },
      seniority: "mid",
      status: "off",
      avatar: "",
      position: "infrastructure",
      skills: ["Docker", "CI/CD", "Observability", "PostgreSQL Ops"],
      projects: [
        { name: { ar: "منصّة النشر والمراقبة", en: "Delivery & Observability Platform" }, role: { ar: "مسؤولة المنصّة", en: "Platform Owner" } },
      ],
      connections: ["backend"],
    },
  ];

  /* ====================================================================
     PUBLIC API
     `fetchTeam()` is the single seam for a future backend. Today it
     resolves local data; later it can `fetch("/api/team")` or read from
     Supabase and nothing else in the feature has to change.
     ==================================================================== */

  function normalizeMember(raw) {
    return Object.assign(
      {
        id: "",
        name: "",
        role: "",
        shortRole: "",
        specialty: "",
        tag: "",
        experience: "",
        seniority: "mid",
        status: "available",
        avatar: "",
        position: "growth",
        skills: [],
        projects: [],
        connections: [],
        isCaptain: false,
      },
      raw
    );
  }

  function fetchTeam() {
    // Future: return fetch("/api/team").then(r => r.json())
    const members = teamMembers.map((m) => normalizeMember(m));
    return Promise.resolve({
      captain: normalizeMember(Object.assign({ isCaptain: true }, captain)),
      members,
    });
  }

  /** Resolve a bilingual field for the active language. */
  function t(value, lang) {
    if (value == null) return "";
    if (typeof value === "string") return value;
    return value[lang] || value.en || value.ar || "";
  }

  ns.POSITION_META = POSITION_META;
  ns.SENIORITY = SENIORITY;
  ns.STATUSES = STATUSES;
  ns.fetchTeam = fetchTeam;
  ns.t = t;
})(window.MureehTeam = window.MureehTeam || {});
