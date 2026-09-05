/* ==========================================================================
   IMAGE STORAGE ABSTRACTION
   Render's filesystem is EPHEMERAL — anything written to local disk
   (including multer's default destination) is wiped on every deploy/restart.
   So project images must live in Supabase Storage in production.

   This module picks a backend automatically:
     - If SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set -> Supabase Storage
       (bucket name from SUPABASE_STORAGE_BUCKET, default "project-images").
     - Otherwise -> local disk under mureeh-site/uploads (fine for local
       dev, NOT recommended for Render/production).

   Public API:
     uploadImage(buffer, originalFilename, mimetype) -> Promise<string url_or_relative_path>
     deleteImage(pathOrUrl) -> Promise<void>  (best-effort, never throws)
     isRemote -> boolean (true if using Supabase Storage)
   ========================================================================== */

const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "project-images";

const useSupabase = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);

let supabase = null;
if (useSupabase) {
  const { createClient } = require("@supabase/supabase-js");
  // This module only ever uses Supabase Storage (file uploads), never the
  // Realtime (websocket) feature — but supabase-js still eagerly constructs
  // its Realtime client, which throws at startup on Node < 22 runtimes
  // (Render's default Node images included) unless a WebSocket
  // implementation is explicitly provided. The "ws" package supplies that.
  const WebSocketImpl = require("ws");
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
    realtime: { transport: WebSocketImpl },
  });
}

const ROOT = path.join(__dirname, "..");
const UPLOADS_DIR = path.join(ROOT, "uploads");
if (!useSupabase && !fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

function safeExt(originalFilename) {
  const ext = path.extname(originalFilename || "").toLowerCase();
  return [".jpg", ".jpeg", ".png", ".webp"].includes(ext) ? ext : ".jpg";
}

function randomName(originalFilename) {
  return `project-${Date.now()}-${crypto.randomBytes(4).toString("hex")}${safeExt(originalFilename)}`;
}

/**
 * Uploads an in-memory image buffer.
 * Returns:
 *   - a full public URL (Supabase Storage), or
 *   - a relative path like "uploads/xyz.jpg" (local disk fallback)
 * Both forms are stored as-is in projects.image_path; the frontend already
 * handles both (absolute http(s) URLs are used directly, relative paths are
 * resolved against the site root).
 */
async function uploadImage(buffer, originalFilename, mimetype) {
  const filename = randomName(originalFilename);

  if (useSupabase) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .upload(filename, buffer, {
        contentType: mimetype || "image/jpeg",
        upsert: false,
      });
    if (error) throw error;
    const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
    return publicUrlData.publicUrl;
  }

  // local disk fallback (dev only)
  const filePath = path.join(UPLOADS_DIR, filename);
  fs.writeFileSync(filePath, buffer);
  return `uploads/${filename}`;
}

/**
 * Best-effort delete. Never throws — a failed cleanup shouldn't block a
 * project delete/update from succeeding.
 */
async function deleteImage(pathOrUrl) {
  try {
    if (!pathOrUrl) return;

    if (useSupabase && /^https?:\/\//.test(pathOrUrl)) {
      // extract the storage object path from a Supabase public URL:
      // https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>
      const marker = `/object/public/${BUCKET}/`;
      const idx = pathOrUrl.indexOf(marker);
      if (idx === -1) return;
      const objectPath = decodeURIComponent(pathOrUrl.slice(idx + marker.length));
      await supabase.storage.from(BUCKET).remove([objectPath]);
      return;
    }

    if (!useSupabase && pathOrUrl.startsWith("uploads/")) {
      const filePath = path.join(ROOT, pathOrUrl);
      fs.unlink(filePath, () => {});
    }
  } catch (err) {
    console.warn("[mureeh] Non-fatal: failed to delete old image:", err.message);
  }
}

module.exports = { uploadImage, deleteImage, isRemote: useSupabase, UPLOADS_DIR };
