/* ==========================================================================
   MUREEH — interaction layer
   ========================================================================== */
document.addEventListener("DOMContentLoaded", () => {

  /* ---------- dynamic header height (keeps fixed header from ever
     overlapping content, regardless of how many lines it wraps to
     on narrow screens or in either language) ---------- */
  const ribbonEl = document.querySelector(".top-ribbon");
  const headerEl = document.querySelector("header");

  function updateHeaderMetrics() {
    const ribbonH = ribbonEl ? ribbonEl.getBoundingClientRect().height : 0;
    const headerH = headerEl ? headerEl.getBoundingClientRect().height : 0;
    document.documentElement.style.setProperty("--ribbon-h", `${ribbonH}px`);
    document.documentElement.style.setProperty("--header-total", `${ribbonH + headerH}px`);

    // keep anchor-scroll targets clear of the fixed header
    const offset = ribbonH + headerH + 16;
    document.querySelectorAll("section[id]").forEach((sec) => {
      sec.style.scrollMarginTop = `${offset}px`;
    });
  }

  updateHeaderMetrics();
  window.addEventListener("resize", updateHeaderMetrics);
  // re-measure after fonts load / language switch (text width can change wrap)
  document.addEventListener("mureeh:langchange", () => setTimeout(updateHeaderMetrics, 60));
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(updateHeaderMetrics);
  }
  window.addEventListener("orientationchange", () => setTimeout(updateHeaderMetrics, 200));

  /* ---------- mobile nav ---------- */
  const menuToggle = document.getElementById("menuToggle");
  const navLinks = document.getElementById("navLinks");
  menuToggle?.addEventListener("click", () => {
    const isOpen = navLinks.classList.toggle("mobile-open");
    menuToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    document.body.classList.toggle("nav-open-lock", isOpen);
    if (isOpen) updateHeaderMetrics();
  });
  navLinks?.querySelectorAll("a").forEach(a =>
    a.addEventListener("click", () => {
      navLinks.classList.remove("mobile-open");
      menuToggle?.setAttribute("aria-expanded", "false");
      document.body.classList.remove("nav-open-lock");
    })
  );

  /* ---------- scroll reveal ---------- */
  const revealEls = document.querySelectorAll(".reveal");
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("in");
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  revealEls.forEach(el => io.observe(el));

  /* ---------- ==================== BRIEFING FLOW ==================== ---------- */
  const steps = Array.from(document.querySelectorAll(".brief-step"));
  const progressWrap = document.getElementById("briefProgress");
  const nextBtn = document.getElementById("briefNext");
  const backBtn = document.getElementById("briefBack");
  const summaryEl = document.getElementById("briefSummary");
  let current = 0;
  const answers = {};

  if (progressWrap) {
    steps.forEach(() => {
      const bar = document.createElement("i");
      progressWrap.appendChild(bar);
    });
  }

  function updateProgress() {
    const bars = progressWrap.querySelectorAll("i");
    bars.forEach((b, i) => {
      b.classList.toggle("done", i < current);
      b.classList.toggle("active", i === current);
    });
  }

  function collectFieldsFromStep(stepEl) {
    // chips
    stepEl.querySelectorAll(".chip-row").forEach(row => {
      const field = row.dataset.field;
      const selected = row.querySelector(".chip.selected");
      if (selected) answers[field] = selected.textContent;
    });
    // text inputs / textarea
    stepEl.querySelectorAll("[data-field]").forEach(el => {
      if (el.classList.contains("chip-row")) return;
      const field = el.dataset.field;
      if (el.value) answers[field] = el.value;
    });
  }

  function buildSummary() {
    const rows = [
      ["نوع المشروع", answers.buildType || "—"],
      ["المشكلة", answers.problem || "—"],
      ["المستخدمون المستهدفون", answers.users || "—"],
      ["المنصة", answers.platform || "—"],
      ["الجدول الزمني", answers.timeline || "—"],
      ["الميزانية التقديرية", answers.budget || "—"],
      ["الاسم", answers.name || "—"],
      ["رقم التواصل", answers.phone || "—"],
    ];
    summaryEl.innerHTML = rows.map(([label, val]) =>
      `<div class="bs-row"><span>${label}</span><b>${val}</b></div>`
    ).join("");
  }

  function showStep(i) {
    steps.forEach((s, idx) => s.classList.toggle("active", idx === i));
    updateProgress();
    backBtn.style.visibility = i === 0 ? "hidden" : "visible";
    if (i === steps.length - 1) {
      buildSummary();
      nextBtn.textContent = "إرسال المشروع إلى مُريح ←";
    } else {
      nextBtn.textContent = "التالي ←";
    }
  }

  // chip selection (single-select per row)
  document.querySelectorAll(".chip-row").forEach(row => {
    row.addEventListener("click", (e) => {
      const chip = e.target.closest(".chip");
      if (!chip) return;
      row.querySelectorAll(".chip").forEach(c => c.classList.remove("selected"));
      chip.classList.add("selected");
    });
  });

  nextBtn?.addEventListener("click", () => {
    const activeStep = steps[current];
    collectFieldsFromStep(activeStep);

    if (current === steps.length - 1) {
      // final submit -> whatsapp handoff
      const text = encodeURIComponent(
        `مرحباً مُريح، لدي ملخص مشروع جديد:\n` +
        `نوع المشروع: ${answers.buildType || "-"}\n` +
        `المشكلة: ${answers.problem || "-"}\n` +
        `المستخدمون: ${answers.users || "-"}\n` +
        `المنصة: ${answers.platform || "-"}\n` +
        `الجدول الزمني: ${answers.timeline || "-"}\n` +
        `الميزانية: ${answers.budget || "-"}\n` +
        `الاسم: ${answers.name || "-"}\n` +
        `الهاتف: ${answers.phone || "-"}`
      );
      window.open(`https://wa.me/970593498909?text=${text}`, "_blank");
      return;
    }
    current = Math.min(current + 1, steps.length - 1);
    showStep(current);
  });

  backBtn?.addEventListener("click", () => {
    current = Math.max(current - 1, 0);
    showStep(current);
  });

  showStep(0);

  /* ---------- ==================== MUREEH SIGNATURE ORB -> CHAT ==================== ---------- */
  const orb = document.getElementById("mureehOrb");
  const chat = document.getElementById("mureehChat");
  const chatClose = document.getElementById("chatClose");
  const chatBody = document.getElementById("chatBody");
  const chatInput = document.getElementById("chatInput");
  const chatSend = document.getElementById("chatSend");

  function openChat() {
    chat.classList.add("open");
    orb.style.opacity = "0";
    orb.style.pointerEvents = "none";
  }
  function closeChat() {
    chat.classList.remove("open");
    orb.style.opacity = "1";
    orb.style.pointerEvents = "all";
  }

  orb?.addEventListener("click", openChat);
  chatClose?.addEventListener("click", closeChat);

  const botReplies = {
    "لدي فكرة مشروع": "رائع! أخبرني أكثر — هل فكرتك أقرب لمنصة SaaS، تطبيق جوال، أم نظام أعمال داخلي؟ يمكنك أيضًا إكمال نموذج الإحاطة أدناه في قسم التواصل لملخص أدق.",
    "أريد بناء منصة SaaS": "ممتاز. منصات SaaS تحتاج تخطيطًا دقيقًا للبنية والتسعير من البداية. هل لديك فكرة عن عدد المستخدمين المتوقع أو نموذج الاشتراك؟",
    "أريد تطبيقًا لمشروعي": "جيد! هل تحتاج تطبيقًا لنظام iOS، Android، أم كليهما؟ وهل هناك تطبيق مشابه تحب أن نستلهم منه تجربة الاستخدام؟",
    "أحتاج نظام إدارة": "أنظمة الإدارة الداخلية من أقوى مجالاتنا. صف لي العملية التي تريد أتمتتها بجملة أو جملتين وسأقترح عليك المسار المناسب.",
    "أريد حلًا بالذكاء الاصطناعي": "نعمل على دمج نماذج ذكاء اصطناعي حقيقية ضمن المنتجات — من الأتمتة إلى المساعدات الذكية. ما المهمة التي تريد أتمتتها بالذكاء الاصطناعي؟",
  };

  function addMsg(text, who) {
    const div = document.createElement("div");
    div.className = `chat-msg ${who}`;
    div.textContent = text;
    chatBody.appendChild(div);
    chatBody.scrollTop = chatBody.scrollHeight;
  }

  document.querySelectorAll(".chat-prompt-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      const text = chip.textContent;
      addMsg(text, "user");
      setTimeout(() => {
        addMsg(botReplies[text] || "شكرًا لمشاركتك! فريقنا سيتواصل معك لمناقشة التفاصيل بدقة أكبر. يمكنك أيضًا إكمال ملخص المشروع في قسم التواصل بالأسفل.", "bot");
      }, 500);
    });
  });

  function sendUserMessage() {
    const val = chatInput.value.trim();
    if (!val) return;
    addMsg(val, "user");
    chatInput.value = "";
    setTimeout(() => {
      addMsg("شكرًا لتوضيحك! لضمان دقة أعلى، يفضّل أن تُكمل نموذج ملخص المشروع في الأسفل ليصل تفصيليًا لفريقنا الهندسي مباشرة.", "bot");
    }, 500);
  }
  chatSend?.addEventListener("click", sendUserMessage);
  chatInput?.addEventListener("keydown", (e) => { if (e.key === "Enter") sendUserMessage(); });

});
