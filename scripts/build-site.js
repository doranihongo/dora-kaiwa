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
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const esbuild = require("esbuild");

const root = path.join(__dirname, "..");
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
    <script>location.replace("/");</script>
  </head>
  <body></body>
</html>
`,
);
fs.writeFileSync(path.join(siteDir, ".nojekyll"), "");

console.log("[build:site] Xong -> site/");
