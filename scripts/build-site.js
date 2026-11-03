/**
 * Build web TĨNH để đưa lên GitHub Pages (không còn server Node).
 *
 *   npm run build   ->   site/
 *
 * Các bước:
 *   1. build-kaiwa.js: vite build app React trong kaiwa/ rồi chép vào public/kaiwa/
 *   2. Chép toàn bộ public/ sang site/ (trừ public/dist cũ của server)
 *   3. site/index.html = trang kaiwa (trước đây server trả file này cho "/")
 *   4. Minify site/js/*.js và site/css/*.css tại chỗ (esbuild transform, giữ
 *      nguyên tên biến top-level vì các script cổ điển dùng chung global)
 *   5. 404.html (về trang chủ, giống catch-all cũ của server) + .nojekyll
 *
 * "/login" -> GitHub Pages tự phục vụ login.html (không cần đuôi .html).
 *
 * SITE_BASE (biến môi trường, mặc định "/"): đường dẫn gốc của web. Domain riêng
 * (doranihongo.com) hoặc chạy local -> "/". GitHub Pages dạng project page
 * (https://<user>.github.io/<repo>/) -> "/<repo>/" (workflow lấy từ configure-pages).
 * Khác "/" thì mọi đường dẫn tuyệt đối trong HTML/manifest được thêm tiền tố này, và
 * <head> được chèn `window.SITE_BASE` cho JS (xem public/js/common.js).
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const esbuild = require("esbuild");

const root = path.join(__dirname, "..");

// Chuẩn hóa SITE_BASE thành "/" hoặc "/tên/" - đặt lại vào env để vite (build-kaiwa) đọc đúng.
const siteBaseTrimmed = (process.env.SITE_BASE || "/").replace(/^\/+|\/+$/g, "");
const SITE_BASE = siteBaseTrimmed ? `/${siteBaseTrimmed}/` : "/";
process.env.SITE_BASE = SITE_BASE;
console.log(`[build:site] SITE_BASE = ${SITE_BASE}`);
const publicDir = path.join(root, "public");
const siteDir = path.join(root, "site");

console.log("[build:site] Build kaiwa...");
execSync("node scripts/build-kaiwa.js", { cwd: root, stdio: "inherit" });

console.log("[build:site] Chép public/ -> site/ ...");
fs.rmSync(siteDir, { recursive: true, force: true });
fs.cpSync(publicDir, siteDir, {
  recursive: true,
  filter: (src) => {
    const rel = path.relative(publicDir, src).replace(/\\/g, "/");
    return rel !== "dist" && !rel.startsWith("dist/") && !rel.startsWith("kaiwa-files");
  },
});

const kaiwaIndex = path.join(siteDir, "kaiwa", "index.html");
if (!fs.existsSync(kaiwaIndex)) {
  console.error("[build:site] Thiếu site/kaiwa/index.html - build kaiwa lỗi?");
  process.exit(1);
}
fs.copyFileSync(kaiwaIndex, path.join(siteDir, "index.html"));

/** Thêm tiền tố SITE_BASE cho đường dẫn tuyệt đối trong HTML (bỏ qua đường dẫn đã có tiền tố). */
function prefixAbsolute(p) {
  return SITE_BASE === "/" || p.startsWith(SITE_BASE) ? p : SITE_BASE + p.slice(1);
}

function rewriteHtml(file) {
  let html = fs.readFileSync(file, "utf8");
  if (SITE_BASE !== "/") {
    // href="/x" | src="/x" (không phải "//x")
    html = html.replace(/\b(href|src)="(\/(?!\/)[^"]*)"/g, (_, attr, p) => `${attr}="${prefixAbsolute(p)}"`);
    // manifest nhúng dạng data: URI trong kaiwa/index.html
    html = html
      .replace(/"start_url":"\/"/g, `"start_url":"${SITE_BASE}"`)
      .replace(/"src":"\/images\//g, `"src":"${SITE_BASE}images/`);
  }
  if (!html.includes("<head>")) throw new Error(`Không thấy <head> trong ${file}`);
  html = html.replace("<head>", `<head>
    <script>window.SITE_BASE=${JSON.stringify(SITE_BASE)};</script>`);
  fs.writeFileSync(file, html);
}

for (const f of ["index.html", "kaiwa/index.html", "login.html"]) rewriteHtml(path.join(siteDir, f));

const manifestFile = path.join(siteDir, "manifest.json");
if (SITE_BASE !== "/" && fs.existsSync(manifestFile)) {
  const m = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
  for (const k of ["start_url", "scope", "id"]) if (typeof m[k] === "string") m[k] = prefixAbsolute(m[k]);
  for (const icon of m.icons || []) icon.src = prefixAbsolute(icon.src);
  fs.writeFileSync(manifestFile, JSON.stringify(m, null, 2));
}

let before = 0;
let after = 0;
for (const [sub, loader] of [
  ["js", "js"],
  ["css", "css"],
]) {
  const dir = path.join(siteDir, sub);
  if (!fs.existsSync(dir)) continue;
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith("." + loader))) {
    const filePath = path.join(dir, file);
    const src = fs.readFileSync(filePath, "utf8");
    const out = esbuild.transformSync(src, { loader, minify: true, legalComments: "none" }).code;
    fs.writeFileSync(filePath, out);
    before += Buffer.byteLength(src);
    after += Buffer.byteLength(out);
  }
}
console.log(`[build:site] Minify js/css: ${before} -> ${after} bytes`);

fs.writeFileSync(
  path.join(siteDir, "404.html"),
  `<!doctype html>
<html lang="vi">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>DORA KAIWA</title>
    <script>location.replace(${JSON.stringify(SITE_BASE)});</script>
  </head>
  <body></body>
</html>
`,
);
fs.writeFileSync(path.join(siteDir, ".nojekyll"), "");

console.log("[build:site] Xong -> site/");
