require("dotenv").config();

const path = require("path");
const crypto = require("crypto");
const express = require("express");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const bcrypt = require("bcryptjs");
const compression = require("compression");

const { query, initSchema, seedAdmin, seedProjectsIfEmpty } = require("./db");
const storage = require("./storage");

const ROOT = path.join(__dirname, ".."); // mureeh-site/

const PORT = process.env.PORT || 4000;
// NOTE ON AUTH TRANSPORT: this app is frequently viewed through a hosted
// preview that embeds it in a cross-site <iframe> (a different top-level
// domain than the one serving this app). Modern browsers increasingly block
// third-party cookies outright in that situation — no cookie flag
// combination (SameSite=None; Secure included) reliably survives that,
// because "block all third-party cookies" is now a default in many browsers
// regardless of flags. So instead of a server-side session cookie, auth here
// uses a signed JWT that the client stores in localStorage and sends back as
// an `Authorization: Bearer <token>` header. localStorage is same-origin
// scoped to the iframe's own origin, not a "third-party" concept, so it is
// never blocked by third-party cookie policies.
if (!process.env.JWT_SECRET) {
  console.warn(
    "[mureeh] WARNING: JWT_SECRET not set — using a random secret generated at boot. " +
    "This invalidates all sessions on every restart/deploy. Set JWT_SECRET in your environment for production."
  );
}
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString("hex");
const JWT_EXPIRES_IN = "8h";

const ADMIN_USERNAME = process.env.MUREEH_ADMIN_USER || "abodybaraka059@gmail.com";
const ADMIN_PASSWORD = process.env.MUREEH_ADMIN_PASS || "16112004Abody@$@";

async function boot() {
  await initSchema();
  await seedAdmin(ADMIN_USERNAME, ADMIN_PASSWORD);
  await seedProjectsIfEmpty();

  const app = express();
  app.set("trust proxy", 1);
  app.use(compression());
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true }));

  // ---------- static assets ----------
  // The site root is this app's parent folder, so `express.static` alone
  // would happily hand out the server's own source (which embeds the
  // fallback admin credentials) and the deploy blueprint. Block that
  // before the static middleware ever sees the request.
  const FORBIDDEN_STATIC = [/^\/server(\/|$)/, /^\/render\.yaml$/i, /^\.(?:git|env)/];
  app.use((req, res, next) => {
    let p;
    try {
      p = decodeURIComponent(req.path);
    } catch (err) {
      return res.status(400).end();
    }
    if (FORBIDDEN_STATIC.some((re) => re.test(p))) return res.status(404).end();
    next();
  });

  app.use(express.static(ROOT, {
    index: false,
    maxAge: "1d",
    setHeaders: (res, filePath) => {
      if (filePath.endsWith(".html")) res.setHeader("Cache-Control", "no-cache");
    }
  }));

  // Only needed when NOT using Supabase Storage (local dev fallback).
  // On Render this path is ephemeral, which is exactly why production
  // should always have SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY configured.
  if (!storage.isRemote) {
    app.use("/uploads", express.static(storage.UPLOADS_DIR));
  }

  // ---------- multer (image upload, in-memory — forwarded to storage.js) ----------
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 6 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      if (/^image\/(jpeg|png|webp)$/.test(file.mimetype)) cb(null, true);
      else cb(new Error("INVALID_FILE_TYPE"));
    }
  });

  // ============================================================
  // AUTH HELPERS (JWT bearer token, role-aware)
  // ============================================================
  function signToken(user) {
    return jwt.sign(
      { sub: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
  }

  function getTokenFromReq(req) {
    const header = req.headers.authorization || "";
    const [scheme, token] = header.split(" ");
    if (scheme === "Bearer" && token) return token;
    return null;
  }

  async function attachUser(req, res, next) {
    const token = getTokenFromReq(req);
    if (!token) return next();
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      const result = await query(
        "SELECT id, username, role, display_name FROM users WHERE id = $1",
        [payload.sub]
      );
      if (result.rows[0]) req.user = result.rows[0];
    } catch (err) {
      // invalid/expired token -> treated as anonymous
    }
    next();
  }
  app.use((req, res, next) => { attachUser(req, res, next).catch(next); });

  function requireAuth(req, res, next) {
    if (req.user) return next();
    return res.status(401).json({ error: "UNAUTHORIZED" });
  }

  function requireRole(...roles) {
    return (req, res, next) => {
      if (!req.user) return res.status(401).json({ error: "UNAUTHORIZED" });
      if (!roles.includes(req.user.role)) return res.status(403).json({ error: "FORBIDDEN" });
      next();
    };
  }

  // simple in-memory rate limiter for login/signup
  const attemptTracker = new Map(); // key -> {count, resetAt}
  function rateLimit(prefix, max) {
    return (req, res, next) => {
      const key = `${prefix}:${req.ip}`;
      const now = Date.now();
      const rec = attemptTracker.get(key) || { count: 0, resetAt: now + 15 * 60 * 1000 };
      if (now > rec.resetAt) { rec.count = 0; rec.resetAt = now + 15 * 60 * 1000; }
      if (rec.count >= max) {
        return res.status(429).json({ error: "TOO_MANY_ATTEMPTS" });
      }
      rec.count += 1;
      attemptTracker.set(key, rec);
      next();
    };
  }

  function slugify(str) {
    return String(str)
      .toLowerCase()
      .trim()
      .replace(/[^\u0621-\u064Aa-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 80) || `project-${Date.now()}`;
  }

  function publicUser(u) {
    if (!u) return null;
    return { id: u.id, username: u.username, role: u.role, display_name: u.display_name };
  }

  function asyncRoute(fn) {
    return (req, res, next) => fn(req, res, next).catch(next);
  }

  // ============================================================
  // AUTH ROUTES
  // ============================================================
  app.post("/api/auth/login", rateLimit("login", 10), asyncRoute(async (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: "MISSING_FIELDS" });

    const result = await query("SELECT * FROM users WHERE username = $1", [username]);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: "INVALID_CREDENTIALS" });

    const ok = bcrypt.compareSync(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: "INVALID_CREDENTIALS" });

    const token = signToken(user);
    res.json({ ok: true, token, user: publicUser(user) });
  }));

  // Member self-registration. New accounts are always role='member' — there
  // is no client-controlled way to create an admin account through this route.
  app.post("/api/auth/register", rateLimit("register", 8), asyncRoute(async (req, res) => {
    const { username, password, display_name } = req.body || {};
    if (!username || !password || password.length < 8) {
      return res.status(400).json({ error: "INVALID_INPUT" });
    }
    const cleanUsername = String(username).trim().toLowerCase();
    if (!/^[a-z0-9_.-]{3,32}$/.test(cleanUsername)) {
      return res.status(400).json({ error: "INVALID_USERNAME" });
    }
    const existing = await query("SELECT id FROM users WHERE username = $1", [cleanUsername]);
    if (existing.rows[0]) return res.status(409).json({ error: "USERNAME_TAKEN" });

    const hash = bcrypt.hashSync(password, 10);
    const inserted = await query(
      `INSERT INTO users (username, password_hash, role, display_name)
       VALUES ($1, $2, 'member', $3)
       RETURNING id, username, role, display_name`,
      [cleanUsername, hash, (display_name || cleanUsername).slice(0, 60)]
    );
    const user = inserted.rows[0];
    const token = signToken(user);
    res.status(201).json({ ok: true, token, user: publicUser(user) });
  }));

  app.post("/api/auth/logout", (req, res) => {
    // Stateless JWT — logout is a client-side action (discard the token).
    res.json({ ok: true });
  });

  app.get("/api/auth/me", requireAuth, (req, res) => {
    res.json({ authenticated: true, user: publicUser(req.user) });
  });

  app.post("/api/auth/change-password", requireAuth, asyncRoute(async (req, res) => {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: "INVALID_INPUT" });
    }
    const result = await query("SELECT * FROM users WHERE id = $1", [req.user.id]);
    const user = result.rows[0];
    if (!user || !bcrypt.compareSync(currentPassword, user.password_hash)) {
      return res.status(401).json({ error: "INVALID_CURRENT_PASSWORD" });
    }
    const newHash = bcrypt.hashSync(newPassword, 10);
    await query("UPDATE users SET password_hash = $1 WHERE id = $2", [newHash, user.id]);
    res.json({ ok: true });
  }));

  // ============================================================
  // PUBLIC PROJECTS API (used by the public website)
  // Only ever returns projects that are BOTH published=1 AND approval_status
  // = 'approved'. A member's pending/rejected submissions never leak here.
  // ============================================================
  app.get("/api/projects", asyncRoute(async (req, res) => {
    const result = await query(`
      SELECT * FROM projects
      WHERE published = 1 AND approval_status = 'approved'
      ORDER BY sort_order ASC, index_no ASC
    `);
    res.json(result.rows);
  }));

  app.get("/api/projects/:slug", asyncRoute(async (req, res) => {
    const result = await query(`
      SELECT * FROM projects WHERE slug = $1 AND published = 1 AND approval_status = 'approved'
    `, [req.params.slug]);
    if (!result.rows[0]) return res.status(404).json({ error: "NOT_FOUND" });
    res.json(result.rows[0]);
  }));

  // ============================================================
  // SHARED PROJECT WRITE HELPERS
  // ============================================================
  function buildProjectFields(b, existing) {
    return {
      category: b.category ?? existing?.category ?? "",
      year: b.year ?? existing?.year ?? String(new Date().getFullYear()),
      title_ar: b.title_ar ?? existing?.title_ar,
      title_en: b.title_en ?? existing?.title_en,
      problem_ar: b.problem_ar ?? existing?.problem_ar ?? "",
      problem_en: b.problem_en ?? existing?.problem_en ?? "",
      solution_ar: b.solution_ar ?? existing?.solution_ar ?? "",
      solution_en: b.solution_en ?? existing?.solution_en ?? "",
      technology_ar: b.technology_ar ?? existing?.technology_ar ?? "",
      technology_en: b.technology_en ?? existing?.technology_en ?? "",
      result_ar: b.result_ar ?? existing?.result_ar ?? "",
      result_en: b.result_en ?? existing?.result_en ?? "",
      result_headline_ar: b.result_headline_ar ?? existing?.result_headline_ar ?? "",
      result_headline_en: b.result_headline_en ?? existing?.result_headline_en ?? "",
      tag_ar: b.tag_ar ?? existing?.tag_ar ?? "",
      tag_en: b.tag_en ?? existing?.tag_en ?? "",
    };
  }

  // ============================================================
  // ADMIN + MEMBER PROJECTS API (protected — role-scoped)
  // ============================================================

  // List projects. Admins see everything; members see only their own.
  app.get("/api/admin/projects", requireAuth, asyncRoute(async (req, res) => {
    let result;
    if (req.user.role === "admin") {
      result = await query(`
        SELECT p.*, u.username AS owner_username FROM projects p
        LEFT JOIN users u ON u.id = p.owner_id
        ORDER BY
          CASE p.approval_status WHEN 'pending' THEN 0 ELSE 1 END,
          p.sort_order ASC, p.index_no ASC
      `);
    } else {
      result = await query(`
        SELECT * FROM projects WHERE owner_id = $1 ORDER BY sort_order ASC, index_no ASC
      `, [req.user.id]);
    }
    res.json(result.rows);
  }));

  app.post("/api/admin/projects", requireAuth, upload.single("image"), asyncRoute(async (req, res) => {
    const b = req.body;
    if (!b.title_ar || !b.title_en) {
      return res.status(400).json({ error: "TITLE_REQUIRED" });
    }

    let slug = slugify(b.slug || b.title_en || b.title_ar);
    const existsRes = await query("SELECT id FROM projects WHERE slug = $1", [slug]);
    if (existsRes.rows[0]) slug = `${slug}-${crypto.randomBytes(2).toString("hex")}`;

    const maxRes = await query("SELECT COALESCE(MAX(index_no),0) AS m, COALESCE(MAX(sort_order),0) AS s FROM projects");
    const maxIndex = maxRes.rows[0].m;
    const maxSort = maxRes.rows[0].s;

    let image_path = b.image_path_existing || null;
    if (req.file) {
      image_path = await storage.uploadImage(req.file.buffer, req.file.originalname, req.file.mimetype);
    }

    const fields = buildProjectFields(b, null);

    // RESPONSIBILITY SPLIT: admins publish immediately (approval_status =
    // 'approved'); members ALWAYS start at 'pending' regardless of what the
    // client sends — an admin must review and approve before it appears on
    // the public site. Enforced here server-side, never trusted from the
    // request body.
    const approval_status = req.user.role === "admin" ? "approved" : "pending";
    const published = req.user.role === "admin" ? (b.published === "0" ? 0 : 1) : 1;

    const inserted = await query(`
      INSERT INTO projects (
        slug, index_no, category, year, title_ar, title_en,
        problem_ar, problem_en, solution_ar, solution_en,
        technology_ar, technology_en, result_ar, result_en,
        result_headline_ar, result_headline_en, image_path, tag_ar, tag_en,
        published, sort_order, owner_id, approval_status
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
      RETURNING *
    `, [
      slug, maxIndex + 1, fields.category, fields.year, fields.title_ar, fields.title_en,
      fields.problem_ar, fields.problem_en, fields.solution_ar, fields.solution_en,
      fields.technology_ar, fields.technology_en, fields.result_ar, fields.result_en,
      fields.result_headline_ar, fields.result_headline_en, image_path, fields.tag_ar, fields.tag_en,
      published, maxSort + 1, req.user.id, approval_status
    ]);

    res.status(201).json(inserted.rows[0]);
  }));

  app.put("/api/admin/projects/:id", requireAuth, upload.single("image"), asyncRoute(async (req, res) => {
    const existingRes = await query("SELECT * FROM projects WHERE id = $1", [req.params.id]);
    const existing = existingRes.rows[0];
    if (!existing) return res.status(404).json({ error: "NOT_FOUND" });

    const isOwner = existing.owner_id === req.user.id;
    if (req.user.role !== "admin" && !isOwner) {
      return res.status(403).json({ error: "FORBIDDEN" });
    }

    const b = req.body;
    let image_path = b.image_path_existing || existing.image_path;
    if (req.file) {
      image_path = await storage.uploadImage(req.file.buffer, req.file.originalname, req.file.mimetype);
      // best-effort cleanup of the old image once the new one is stored
      if (existing.image_path && existing.image_path !== image_path) {
        storage.deleteImage(existing.image_path);
      }
    }

    const fields = buildProjectFields(b, existing);

    let published = existing.published;
    let approval_status = existing.approval_status;
    let rejection_reason = existing.rejection_reason;

    if (req.user.role === "admin") {
      published = b.published === undefined ? existing.published : (b.published === "0" || b.published === 0 ? 0 : 1);
    } else {
      // A member editing their own project (even an already-approved one)
      // sends it back for re-review.
      approval_status = "pending";
      rejection_reason = null;
      published = 1;
    }

    const updated = await query(`
      UPDATE projects SET
        category=$1, year=$2, title_ar=$3, title_en=$4,
        problem_ar=$5, problem_en=$6,
        solution_ar=$7, solution_en=$8,
        technology_ar=$9, technology_en=$10,
        result_ar=$11, result_en=$12,
        result_headline_ar=$13, result_headline_en=$14,
        image_path=$15, tag_ar=$16, tag_en=$17,
        published=$18, approval_status=$19, rejection_reason=$20,
        updated_at=NOW()
      WHERE id=$21
      RETURNING *
    `, [
      fields.category, fields.year, fields.title_ar, fields.title_en,
      fields.problem_ar, fields.problem_en, fields.solution_ar, fields.solution_en,
      fields.technology_ar, fields.technology_en, fields.result_ar, fields.result_en,
      fields.result_headline_ar, fields.result_headline_en,
      image_path, fields.tag_ar, fields.tag_en,
      published, approval_status, rejection_reason,
      req.params.id
    ]);

    res.json(updated.rows[0]);
  }));

  app.delete("/api/admin/projects/:id", requireAuth, asyncRoute(async (req, res) => {
    const existingRes = await query("SELECT * FROM projects WHERE id = $1", [req.params.id]);
    const existing = existingRes.rows[0];
    if (!existing) return res.status(404).json({ error: "NOT_FOUND" });

    const isOwner = existing.owner_id === req.user.id;
    if (req.user.role !== "admin" && !isOwner) {
      return res.status(403).json({ error: "FORBIDDEN" });
    }

    await query("DELETE FROM projects WHERE id = $1", [req.params.id]);
    storage.deleteImage(existing.image_path);
    res.json({ ok: true });
  }));

  app.post("/api/admin/projects/reorder", requireAuth, requireRole("admin"), asyncRoute(async (req, res) => {
    const { order } = req.body || {}; // array of {id, sort_order}
    if (!Array.isArray(order)) return res.status(400).json({ error: "INVALID_INPUT" });
    for (const item of order) {
      await query("UPDATE projects SET sort_order = $1 WHERE id = $2", [item.sort_order, item.id]);
    }
    res.json({ ok: true });
  }));

  // ---- Admin-only moderation endpoints ----
  app.post("/api/admin/projects/:id/approve", requireAuth, requireRole("admin"), asyncRoute(async (req, res) => {
    const existingRes = await query("SELECT id FROM projects WHERE id = $1", [req.params.id]);
    if (!existingRes.rows[0]) return res.status(404).json({ error: "NOT_FOUND" });
    const updated = await query(`
      UPDATE projects SET approval_status='approved', rejection_reason=NULL, published=1, updated_at=NOW()
      WHERE id = $1 RETURNING *
    `, [req.params.id]);
    res.json(updated.rows[0]);
  }));

  app.post("/api/admin/projects/:id/reject", requireAuth, requireRole("admin"), asyncRoute(async (req, res) => {
    const existingRes = await query("SELECT id FROM projects WHERE id = $1", [req.params.id]);
    if (!existingRes.rows[0]) return res.status(404).json({ error: "NOT_FOUND" });
    const reason = ((req.body && req.body.reason) || "").slice(0, 500);
    const updated = await query(`
      UPDATE projects SET approval_status='rejected', rejection_reason=$1, published=0, updated_at=NOW()
      WHERE id = $2 RETURNING *
    `, [reason, req.params.id]);
    res.json(updated.rows[0]);
  }));

  // Admin: list member accounts (read-only listing + role info).
  app.get("/api/admin/users", requireAuth, requireRole("admin"), asyncRoute(async (req, res) => {
    const result = await query(`
      SELECT id, username, role, display_name, created_at,
        (SELECT COUNT(*)::int FROM projects WHERE owner_id = users.id) AS project_count,
        (SELECT COUNT(*)::int FROM projects WHERE owner_id = users.id AND approval_status='pending') AS pending_count
      FROM users ORDER BY created_at DESC
    `);
    res.json(result.rows);
  }));

  // ---------- health check (useful for Render) ----------
  app.get("/healthz", (req, res) => res.json({ ok: true }));

  // ---------- error handler ----------
  app.use((err, req, res, next) => {
    if (err && err.message === "INVALID_FILE_TYPE") {
      return res.status(400).json({ error: "INVALID_FILE_TYPE" });
    }
    if (err && err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "FILE_TOO_LARGE" });
    }
    console.error(err);
    res.status(500).json({ error: "SERVER_ERROR" });
  });

  // ---------- SPA-ish fallback for admin routes ----------
  app.get("/admin", (req, res) => {
    res.sendFile(path.join(ROOT, "admin", "index.html"));
  });
  app.get("/admin/*", (req, res) => {
    res.sendFile(path.join(ROOT, "admin", "index.html"));
  });
  app.get("/", (req, res) => {
    res.sendFile(path.join(ROOT, "index.html"));
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[mureeh] Server running on http://0.0.0.0:${PORT}`);
    console.log(`[mureeh] Admin login -> username: ${ADMIN_USERNAME}`);
    console.log(`[mureeh] Image storage: ${storage.isRemote ? "Supabase Storage" : "local disk (dev only)"}`);
  });
}

boot().catch((err) => {
  console.error("[mureeh] Fatal error during startup:", err);
  process.exit(1);
});
