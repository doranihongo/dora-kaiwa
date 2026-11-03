/**
 * Server tĩnh tối thiểu để chạy thử thư mục site/ ở máy local, mô phỏng cách
 * GitHub Pages phục vụ file (không phải server của app - app không còn
 * backend):
 *   /login        -> login.html
 *   /kaiwa/       -> kaiwa/index.html
 *   không có file -> 404.html (status 404)
 *   /slides/...   -> ảnh slide, nằm sẵn trong site/slides (từ public/slides)
 *
 * Chạy: npm start   (PORT=3001 npm start để đổi cổng)
 */

const http = require("http");
const fs = require("fs");
const path = require("path");

const siteDir = path.join(__dirname, "..", "site");
const port = Number(process.env.PORT) || 3000;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".mp3": "audio/mpeg",
  ".txt": "text/plain; charset=utf-8",
};

function isFile(p) {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

function resolveFile(urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  const target = path.join(siteDir, path.normalize(decoded));
  // Chặn thoát khỏi site/ (../)
  if (target !== siteDir && !target.startsWith(siteDir + path.sep)) return null;

  const candidates = decoded.endsWith("/")
    ? [path.join(target, "index.html")]
    : [target, target + ".html", path.join(target, "index.html")];
  return candidates.find(isFile) || null;
}

if (!fs.existsSync(path.join(siteDir, "index.html"))) {
  console.error("Chưa có site/ - chạy `npm run build` trước.");
  process.exit(1);
}

http
  .createServer((req, res) => {
    const { pathname } = new URL(req.url, "http://localhost");
    let file = resolveFile(pathname);
    let status = 200;
    if (!file) {
      file = path.join(siteDir, "404.html");
      status = 404;
    }
    res.writeHead(status, {
      "Content-Type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    if (req.method === "HEAD") return res.end();
    fs.createReadStream(file).pipe(res);
  })
  .listen(port, () => {
    console.log(`Web tĩnh đang chạy: http://localhost:${port}`);
  });
