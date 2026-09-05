/* ==========================================================================
   MUREEH ADMIN / MEMBER DASHBOARD
   Auth: JWT bearer token stored in localStorage (NOT a cookie/session).
   Why: this app is often viewed inside a cross-site <iframe> (a hosted
   preview on a different top-level domain). Browsers increasingly block
   third-party cookies outright regardless of SameSite/Secure flags, which
   breaks cookie-based sessions in that context (login "succeeds" but the
   session cookie never gets stored, so every subsequent request looks
   logged-out). localStorage is scoped to the iframe's own origin and isn't
   subject to third-party cookie blocking, so it works reliably everywhere.
   ========================================================================== */
(function () {
  "use strict";

  const API = ""; // same-origin
  const TOKEN_KEY = "mureeh_admin_token";
  let currentProjects = [];
  let currentUser = null;
  let editingId = null;
  let selectedImageFile = null;

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }
  function setToken(token) {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  }

  function showToast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 2600);
  }

  async function api(path, opts = {}) {
    const token = getToken();
    const headers = { ...(opts.headers || {}) };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(API + path, { ...opts, headers });
    if (res.status === 401) {
      setToken(null);
      showLogin();
      throw new Error("UNAUTHORIZED");
    }
    return res;
  }

  /* ---------------- AUTH TABS (login / register) ---------------- */
  $$(".auth-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      $$(".auth-tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      const which = tab.dataset.authTab;
      $$(".auth-panel").forEach((p) => p.classList.remove("active"));
      $(`[data-auth-panel="${which}"]`).classList.add("active");
    });
  });

  /* ---------------- AUTH ---------------- */
  function showLogin() {
    $("#loginScreen").style.display = "flex";
    $("#dash").classList.remove("active");
  }

  function applyRoleUI(user) {
    const isAdmin = user.role === "admin";
    $("#sbRoleBadge").textContent = isAdmin ? "مسؤول Admin" : "عضو Member";
    $("#navMembersBtn").style.display = isAdmin ? "flex" : "none";
    $("#memberNotice").style.display = isAdmin ? "none" : "block";
    $("#modalMemberNotice").style.display = isAdmin ? "none" : "block";
    $("#publishedFieldWrap").style.display = isAdmin ? "block" : "none";
    $("#projectsHeading").textContent = isAdmin ? "إدارة المشاريع" : "مشاريعي";
    $("#projectsSub").textContent = isAdmin
      ? 'أضف، عدّل، وافق أو ارفض المشاريع المعروضة في قسم "أعمالنا" على الموقع.'
      : "أضف مشاريعك الخاصة — تظهر على الموقع العام بعد موافقة فريق مُريح.";

    const head = $("#projectsTableHead");
    if (isAdmin) {
      head.classList.remove("no-owner-col");
      head.innerHTML = `
        <span>الصورة</span><span>المشروع</span><span>صاحب المشروع</span>
        <span>التصنيف</span><span>السنة</span><span>الحالة</span><span></span>`;
    } else {
      head.classList.add("no-owner-col");
      head.innerHTML = `
        <span>الصورة</span><span>المشروع</span>
        <span>التصنيف</span><span>السنة</span><span>الحالة</span><span></span>`;
    }
  }

  function showDash(user) {
    currentUser = user;
    $("#loginScreen").style.display = "none";
    $("#dash").classList.add("active");
    $("#whoUser").textContent = user.display_name || user.username || "—";
    applyRoleUI(user);
    loadProjects();
  }

  async function checkAuth() {
    const token = getToken();
    if (!token) return showLogin();
    try {
      const res = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { setToken(null); return showLogin(); }
      const data = await res.json();
      if (data.authenticated) showDash(data.user);
      else showLogin();
    } catch (err) {
      showLogin();
    }
  }

  $("#loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = $("#loginUser").value.trim();
    const password = $("#loginPass").value;
    $("#loginError").style.display = "none";
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        $("#loginError").textContent = "اسم المستخدم أو كلمة المرور غير صحيحة.";
        $("#loginError").style.display = "block";
        return;
      }
      const data = await res.json();
      setToken(data.token);
      showDash(data.user);
    } catch (err) {
      $("#loginError").textContent = "حدث خطأ في الاتصال بالخادم.";
      $("#loginError").style.display = "block";
    }
  });

  $("#registerForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const display_name = $("#regDisplayName").value.trim();
    const username = $("#regUser").value.trim();
    const password = $("#regPass").value;
    $("#registerError").style.display = "none";
    $("#registerSuccess").style.display = "none";

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, display_name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msgs = {
          USERNAME_TAKEN: "اسم المستخدم هذا مستخدم بالفعل.",
          INVALID_USERNAME: "اسم المستخدم يجب أن يكون أحرف/أرقام إنجليزية فقط (3-32 حرفًا).",
          INVALID_INPUT: "يرجى إدخال بيانات صحيحة (كلمة مرور 8 أحرف على الأقل).",
          TOO_MANY_ATTEMPTS: "محاولات كثيرة جدًا، حاول لاحقًا.",
        };
        $("#registerError").textContent = msgs[data.error] || "تعذّر إنشاء الحساب.";
        $("#registerError").style.display = "block";
        return;
      }
      $("#registerSuccess").style.display = "block";
      setToken(data.token);
      setTimeout(() => showDash(data.user), 600);
    } catch (err) {
      $("#registerError").textContent = "حدث خطأ في الاتصال بالخادم.";
      $("#registerError").style.display = "block";
    }
  });

  $("#logoutBtn").addEventListener("click", async () => {
    try { await api("/api/auth/logout", { method: "POST" }); } catch (e) {}
    setToken(null);
    currentUser = null;
    showLogin();
  });

  /* ---------------- SIDEBAR NAV ---------------- */
  $$(".sb-nav button[data-view]").forEach((btn) => {
    btn.addEventListener("click", () => {
      $$(".sb-nav button[data-view]").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const view = btn.dataset.view;
      $("#viewProjects").style.display = view === "projects" ? "block" : "none";
      $("#viewMembers").style.display = view === "members" ? "block" : "none";
      $("#viewSettings").style.display = view === "settings" ? "block" : "none";
      if (view === "members") loadMembers();
      closeSidebar();
    });
  });

  /* ---------------- MOBILE SIDEBAR TOGGLE ---------------- */
  function openSidebar() {
    $("#sidebar")?.classList.add("open");
    $("#sidebarOverlay")?.classList.add("open");
    $("#sidebarToggle")?.setAttribute("aria-expanded", "true");
  }
  function closeSidebar() {
    $("#sidebar")?.classList.remove("open");
    $("#sidebarOverlay")?.classList.remove("open");
    $("#sidebarToggle")?.setAttribute("aria-expanded", "false");
  }
  $("#sidebarToggle")?.addEventListener("click", openSidebar);
  $("#sidebarCloseBtn")?.addEventListener("click", closeSidebar);
  $("#sidebarOverlay")?.addEventListener("click", closeSidebar);

  /* ---------------- CHANGE PASSWORD ---------------- */
  $("#changePassForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const currentPassword = $("#currentPass").value;
    const newPassword = $("#newPass").value;
    const res = await api("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    if (res.ok) {
      showToast("تم تحديث كلمة المرور بنجاح ✓");
      e.target.reset();
    } else {
      const data = await res.json().catch(() => ({}));
      showToast(data.error === "INVALID_CURRENT_PASSWORD" ? "كلمة المرور الحالية غير صحيحة" : "حدث خطأ، حاول مجددًا");
    }
  });

  /* ---------------- MEMBERS LIST (admin only) ---------------- */
  async function loadMembers() {
    if (!currentUser || currentUser.role !== "admin") return;
    try {
      const res = await api("/api/admin/users");
      const users = await res.json();
      const body = $("#membersTableBody");
      body.innerHTML = "";
      users.forEach((u) => {
        const row = document.createElement("div");
        row.className = "table-row";
        row.innerHTML = `
          <span>${escapeHtml(u.display_name || u.username)}<br><small style="color:var(--graphite-2);">@${escapeHtml(u.username)}</small></span>
          <span>${u.role === "admin" ? "مسؤول" : "عضو"}</span>
          <span>${u.project_count}</span>
          <span>${u.pending_count > 0 ? `<span class="badge pending">${u.pending_count} قيد المراجعة</span>` : "—"}</span>
        `;
        body.appendChild(row);
      });
    } catch (err) {}
  }

  /* ---------------- PROJECTS LIST ---------------- */
  async function loadProjects() {
    const res = await api("/api/admin/projects");
    currentProjects = await res.json();
    renderProjects();
  }

  const STATUS_LABEL = {
    approved: "منشور",
    pending: "قيد المراجعة",
    rejected: "مرفوض",
  };

  function renderProjects() {
    const body = $("#projectsTableBody");
    body.innerHTML = "";
    const isAdmin = currentUser && currentUser.role === "admin";

    if (currentProjects.length === 0) {
      body.innerHTML = `<div style="padding:40px; text-align:center; color:var(--graphite-2);">${
        isAdmin ? "لا توجد مشاريع بعد — أضف أول مشروع الآن." : "لم تضف أي مشروع بعد — أضف أول مشروع الآن."
      }</div>`;
      return;
    }

    currentProjects.forEach((p) => {
      const row = document.createElement("div");
      row.className = "table-row" + (isAdmin ? "" : " no-owner-col");
      const imgSrc = p.image_path ? `/${p.image_path}` : "";
      const status = p.approval_status || "approved";
      const statusBadge = `<span class="badge ${status}">${STATUS_LABEL[status] || status}</span>`;
      const draftBadge = p.published === 0 && status === "approved" ? `<span class="badge draft">مسودة</span>` : "";

      let actionsHtml = `
        <button class="icon-btn" data-edit="${p.id}" title="تعديل">✎</button>
        <button class="icon-btn danger" data-delete="${p.id}" title="حذف">🗑</button>
      `;
      if (isAdmin && status === "pending") {
        actionsHtml = `
          <button class="icon-btn approve" data-approve="${p.id}" title="موافقة">✓</button>
          <button class="icon-btn reject" data-reject="${p.id}" title="رفض">✕</button>
        ` + actionsHtml;
      }

      const ownerCell = isAdmin ? `<span class="row-owner">${escapeHtml(p.owner_username || "—")}</span>` : "";

      row.innerHTML = `
        <img class="row-thumb" src="${imgSrc}" onerror="this.style.opacity=0" alt="">
        <div class="row-title">${escapeHtml(p.title_ar)}<small>${escapeHtml(p.title_en)}</small>
          ${status === "rejected" && p.rejection_reason ? `<div class="reject-reason">سبب الرفض: ${escapeHtml(p.rejection_reason)}</div>` : ""}
        </div>
        ${ownerCell}
        <span>${escapeHtml(p.category || "—")}</span>
        <span>${escapeHtml(p.year || "—")}</span>
        <span>${statusBadge} ${draftBadge}</span>
        <div class="row-actions">${actionsHtml}</div>
      `;
      body.appendChild(row);
    });

    $$("[data-edit]").forEach((btn) =>
      btn.addEventListener("click", () => openModal(parseInt(btn.dataset.edit, 10)))
    );
    $$("[data-delete]").forEach((btn) =>
      btn.addEventListener("click", () => deleteProject(parseInt(btn.dataset.delete, 10)))
    );
    $$("[data-approve]").forEach((btn) =>
      btn.addEventListener("click", () => approveProject(parseInt(btn.dataset.approve, 10)))
    );
    $$("[data-reject]").forEach((btn) =>
      btn.addEventListener("click", () => rejectProject(parseInt(btn.dataset.reject, 10)))
    );
  }

  function escapeHtml(str) {
    if (!str) return "";
    return str.replace(/[&<>"']/g, (m) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[m]));
  }

  async function deleteProject(id) {
    if (!confirm("هل أنت متأكد من حذف هذا المشروع؟ لا يمكن التراجع عن هذا الإجراء.")) return;
    const res = await api(`/api/admin/projects/${id}`, { method: "DELETE" });
    if (res.ok) {
      showToast("تم حذف المشروع");
      loadProjects();
    } else {
      showToast("تعذّر حذف المشروع");
    }
  }

  async function approveProject(id) {
    const res = await api(`/api/admin/projects/${id}/approve`, { method: "POST" });
    if (res.ok) {
      showToast("تمت الموافقة على المشروع ونشره ✓");
      loadProjects();
    } else {
      showToast("تعذّرت الموافقة");
    }
  }

  async function rejectProject(id) {
    const reason = prompt("سبب الرفض (اختياري):", "");
    if (reason === null) return; // cancelled
    const res = await api(`/api/admin/projects/${id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    if (res.ok) {
      showToast("تم رفض المشروع");
      loadProjects();
    } else {
      showToast("تعذّر رفض المشروع");
    }
  }

  /* ---------------- MODAL: ADD / EDIT ---------------- */
  const modal = $("#projectModal");

  $("#btnAddProject").addEventListener("click", () => openModal(null));
  $("#modalClose").addEventListener("click", closeModal);
  $("#cancelForm").addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });

  function openModal(id) {
    editingId = id;
    selectedImageFile = null;
    $("#projectForm").reset();
    $("#imagePreview").style.display = "none";
    $("#imageDropText").textContent = "اضغط لرفع صورة (JPG / PNG / WebP، أقصى 6MB)";

    if (id) {
      const p = currentProjects.find((x) => x.id === id);
      $("#modalTitle").textContent = "تعديل المشروع";
      $("#title_ar").value = p.title_ar || "";
      $("#title_en").value = p.title_en || "";
      $("#problem_ar").value = p.problem_ar || "";
      $("#problem_en").value = p.problem_en || "";
      $("#solution_ar").value = p.solution_ar || "";
      $("#solution_en").value = p.solution_en || "";
      $("#technology_ar").value = p.technology_ar || "";
      $("#technology_en").value = p.technology_en || "";
      $("#result_headline_ar").value = p.result_headline_ar || "";
      $("#result_headline_en").value = p.result_headline_en || "";
      $("#tag_ar").value = p.tag_ar || "";
      $("#tag_en").value = p.tag_en || "";
      $("#category").value = p.category || "";
      $("#year").value = p.year || "";
      $("#published").value = String(p.published);
      if (p.image_path) {
        $("#imagePreview").src = `/${p.image_path}`;
        $("#imagePreview").style.display = "block";
        $("#imageDropText").textContent = "اضغط لتغيير الصورة";
      }
    } else {
      $("#modalTitle").textContent = "إضافة مشروع جديد";
      $("#published").value = "1";
    }
    modal.classList.add("open");
  }

  function closeModal() {
    modal.classList.remove("open");
    editingId = null;
  }

  /* image upload preview */
  const imageDrop = $("#imageDrop");
  const imageInput = $("#imageInput");
  imageDrop.addEventListener("click", () => imageInput.click());
  imageInput.addEventListener("change", () => {
    const file = imageInput.files[0];
    if (!file) return;
    selectedImageFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      $("#imagePreview").src = e.target.result;
      $("#imagePreview").style.display = "block";
      $("#imageDropText").textContent = file.name;
    };
    reader.readAsDataURL(file);
  });

  /* language tabs inside modal */
  $$("[data-lang-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      $$("[data-lang-tab]").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const lang = btn.dataset.langTab;
      $$("[data-lang-content]").forEach((c) => c.classList.remove("active"));
      $(`[data-lang-content="${lang}"]`).classList.add("active");
    });
  });

  /* submit form (create or update) */
  $("#projectForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = $("#submitProjectBtn");
    submitBtn.disabled = true;
    submitBtn.textContent = "جارِ الحفظ...";

    const fd = new FormData();
    const fields = [
      "title_ar", "title_en", "problem_ar", "problem_en",
      "solution_ar", "solution_en", "technology_ar", "technology_en",
      "result_headline_ar", "result_headline_en", "tag_ar", "tag_en",
      "category", "year", "published"
    ];
    fields.forEach((f) => fd.append(f, $(`#${f}`).value));
    if (selectedImageFile) fd.append("image", selectedImageFile);

    try {
      const url = editingId ? `/api/admin/projects/${editingId}` : "/api/admin/projects";
      const method = editingId ? "PUT" : "POST";
      const res = await api(url, { method, body: fd });
      if (res.ok) {
        const isAdmin = currentUser && currentUser.role === "admin";
        showToast(
          editingId
            ? (isAdmin ? "تم تحديث المشروع ✓" : "تم إرسال التعديل لمراجعة الفريق ✓")
            : (isAdmin ? "تم إضافة المشروع ✓" : "تم إرسال مشروعك لمراجعة الفريق ✓")
        );
        closeModal();
        loadProjects();
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.error === "TITLE_REQUIRED" ? "يرجى إدخال عنوان المشروع باللغتين" : "حدث خطأ أثناء الحفظ");
      }
    } catch (err) {
      // handled by api() redirect on 401
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "حفظ المشروع";
    }
  });

  /* ---------------- INIT ---------------- */
  checkAuth();
})();
