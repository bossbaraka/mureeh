const { Pool } = require("pg");
const bcrypt = require("bcryptjs");

// ---------------------------------------------------------------------------
// DATABASE CONNECTION (Postgres — works with Supabase Postgres in production,
// or any local/self-hosted Postgres for development).
//
// Expected env var: DATABASE_URL="postgresql://user:pass@host:port/db"
// Supabase gives you this exact string under
// Project Settings -> Database -> Connection string -> URI.
// ---------------------------------------------------------------------------
if (!process.env.DATABASE_URL) {
  throw new Error(
    "[mureeh] Missing DATABASE_URL environment variable. " +
    "Set it to your Supabase (or other Postgres) connection string. See .env.example."
  );
}

// Supabase (and most managed Postgres hosts) require SSL. Allow opting out
// for local/self-hosted Postgres via PGSSL=disable.
const useSSL = process.env.PGSSL !== "disable";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSSL ? { rejectUnauthorized: false } : false,
  max: parseInt(process.env.PG_POOL_MAX || "10", 10),
});

pool.on("error", (err) => {
  console.error("[mureeh] Unexpected Postgres pool error:", err);
});

async function query(text, params) {
  return pool.query(text, params);
}

// ---------------------------------------------------------------------------
// SCHEMA
// users: unified table for BOTH admins and members, distinguished by `role`.
//   role = 'admin'  -> full control: manage all projects, approve/reject
//                      member submissions, manage own account.
//   role = 'member' -> can submit/edit ONLY their own projects; every new
//                      project (or edit to an existing one) goes back to
//                      'pending' and only becomes publicly visible once an
//                      admin approves it. Enforced server-side on every
//                      write, never trusted from the client.
// ---------------------------------------------------------------------------
async function initSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin','member')),
      display_name TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS projects (
      id SERIAL PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      index_no INTEGER,
      category TEXT,
      year TEXT,
      title_ar TEXT NOT NULL,
      title_en TEXT NOT NULL,
      problem_ar TEXT,
      problem_en TEXT,
      solution_ar TEXT,
      solution_en TEXT,
      technology_ar TEXT,
      technology_en TEXT,
      result_ar TEXT,
      result_en TEXT,
      result_headline_ar TEXT,
      result_headline_en TEXT,
      image_path TEXT,
      tag_ar TEXT,
      tag_en TEXT,
      published INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      approval_status TEXT NOT NULL DEFAULT 'approved' CHECK (approval_status IN ('approved','pending','rejected')),
      rejection_reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // ---- lightweight, idempotent migrations for DBs created by earlier
  // versions of this schema (keeps existing Supabase projects working
  // when the app gains new columns across versions) ----
  await query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL;`);
  await query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'approved';`);
  await query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS rejection_reason TEXT;`);

  // Migrate a legacy single-table `admins` schema (from the very first
  // version of this app, SQLite-era) into `users`, if it's still present.
  const legacy = await query(`SELECT to_regclass('public.admins') AS exists_check;`);
  if (legacy.rows[0] && legacy.rows[0].exists_check) {
    await query(`
      INSERT INTO users (username, password_hash, role, created_at)
      SELECT username, password_hash, 'admin', created_at FROM admins
      ON CONFLICT (username) DO NOTHING;
    `);
    await query(`DROP TABLE admins;`);
    console.log("[mureeh] Migrated legacy 'admins' table into 'users'.");
  }
}

async function seedAdmin(username, plainPassword) {
  const hash = bcrypt.hashSync(plainPassword, 10);
  const existing = await query("SELECT id, role FROM users WHERE username = $1", [username]);
  if (existing.rows.length > 0) {
    await query("UPDATE users SET role='admin', password_hash=$1 WHERE id = $2", [hash, existing.rows[0].id]);
    return;
  }
  await query(
    "INSERT INTO users (username, password_hash, role, display_name) VALUES ($1, $2, 'admin', $3)",
    [username, hash, "Mureeh Admin"]
  );
  console.log(`[mureeh] Seeded admin user: ${username}`);
}

async function seedProjectsIfEmpty() {
  const countRes = await query("SELECT COUNT(*)::int AS c FROM projects");
  if (countRes.rows[0].c > 0) return;

  const seed = [
    {
      slug: "mureeh-cloud-platform",
      index_no: 1,
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
      sort_order: 1
    },
    {
      slug: "order-management-app",
      index_no: 2,
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
      sort_order: 2
    },
    {
      slug: "internal-operations-system",
      index_no: 3,
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
      sort_order: 3
    }
  ];

  for (const p of seed) {
    await query(
      `INSERT INTO projects (
        slug, index_no, category, year, title_ar, title_en,
        problem_ar, problem_en, solution_ar, solution_en,
        technology_ar, technology_en, result_ar, result_en,
        result_headline_ar, result_headline_en, image_path, tag_ar, tag_en, sort_order,
        approval_status
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,'approved')`,
      [
        p.slug, p.index_no, p.category, p.year, p.title_ar, p.title_en,
        p.problem_ar, p.problem_en, p.solution_ar, p.solution_en,
        p.technology_ar, p.technology_en, p.result_ar, p.result_en,
        p.result_headline_ar, p.result_headline_en, p.image_path, p.tag_ar, p.tag_en, p.sort_order
      ]
    );
  }
  console.log("[mureeh] Seeded initial projects.");
}

module.exports = { pool, query, initSchema, seedAdmin, seedProjectsIfEmpty };
