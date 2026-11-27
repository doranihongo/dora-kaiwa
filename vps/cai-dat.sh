#!/usr/bin/env bash
# Cài / cập nhật API sách Kaiwa của Dora Kaiwa trên VPS (chạy lại nhiều lần được). Hướng dẫn: vps/README.md
#   Đặt file này cùng thư mục với kaiwa-server.mjs rồi chạy bằng root:   bash /tmp/cai-dat.sh
# Việc script làm: chép code vào /opt/dora-kaiwa, tạo /etc/dora-kaiwa.env (giữ nguyên nếu đã có), dịch vụ systemd
# "dora-kaiwa" (cổng 3200), thêm đường dẫn /dora-kaiwa/ vào nginx của xh.doranihongo.com (có sao lưu, lỗi thì trả lại).
# KHÔNG sửa, không xóa dữ liệu hay dịch vụ nào đang chạy: dữ liệu Kaiwa chỉ được ĐỌC.
set -euo pipefail

DOMAIN="${DOMAIN:-xh.doranihongo.com}"
APP_DIR=/opt/dora-kaiwa
ENV_FILE=/etc/dora-kaiwa.env
SERVICE=dora-kaiwa
SNIPPET=/etc/nginx/snippets/dora-kaiwa.conf
BACKUP_DIR=/root/dora-kaiwa-backup
# Khóa công khai (anon) của Supabase web Dora Kaiwa - giống public/js/supabaseClient.js
SUPABASE_URL="https://keywwriietabgahtropc.supabase.co"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtleXd3cmlpZXRhYmdhaHRyb3BjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1NDYzNjMsImV4cCI6MjA5ODEyMjM2M30.ZJY9kDoSNdfik40cehCFblXDE4cFb6uUOtj3Q9zv68I"
SRC="$(cd "$(dirname "$0")" && pwd)"

die() { echo "LỖI: $*" >&2; exit 1; }
# đọc 1 biến từ file env (không có thì rỗng)
doc_env() { if [ -f "$2" ]; then sed -n "s/^$1=//p" "$2" | tail -n 1 | tr -d "\"'\r"; fi; }

[ "$(id -u)" = 0 ] || die "cần chạy bằng root"
[ -f "$SRC/kaiwa-server.mjs" ] || die "không thấy $SRC/kaiwa-server.mjs"
NODE=/usr/bin/node
[ -x "$NODE" ] || NODE="$(command -v node || true)"
[ -n "$NODE" ] || die "chưa có Node.js"
[ "$("$NODE" -p 'Number(process.versions.node.split(".")[0])')" -ge 18 ] || die "cần Node 18 trở lên"

# ---------- 1. Thư mục dữ liệu đã có trên VPS ----------
DATA_DIR="$(doc_env DATA_DIR "$ENV_FILE")"
AUDIO_DIR="$(doc_env AUDIO_DIR "$ENV_FILE")"
if [ -z "$DATA_DIR" ]; then
    BAITAP_DIR="$(doc_env BAITAP_DIR /etc/xephang.env)"
    DATA_DIR="${BAITAP_DIR:-/opt/baitap/repo/baitap-data}/khoa"
fi
if [ -z "$AUDIO_DIR" ]; then
    AUDIO_DIR="$(doc_env KAIWA_AUDIO_DIR /etc/xephang.env)"
    AUDIO_DIR="${AUDIO_DIR:-/opt/baitap/kaiwa-audio}"
fi
PORT="$(doc_env PORT "$ENV_FILE")"
PORT="${PORT:-3200}"

echo "== Dữ liệu chữ : $DATA_DIR"
echo "== Audio       : $AUDIO_DIR"
[ -d "$DATA_DIR/sachkaiwa" ] || die "không có thư mục $DATA_DIR/sachkaiwa"
[ -d "$AUDIO_DIR" ] || die "không có thư mục $AUDIO_DIR"
runuser -u nobody -- test -r "$DATA_DIR/sachkaiwa" || die "user nobody không đọc được $DATA_DIR (chạy: chmod -R o+rX $DATA_DIR)"
runuser -u nobody -- test -r "$AUDIO_DIR" || die "user nobody không đọc được $AUDIO_DIR (chạy: chmod -R o+rX $AUDIO_DIR)"

echo "== Kiểm 9 giáo trình"
"$NODE" - "$DATA_DIR" "$AUDIO_DIR" <<'JS'
const fs = require('fs');
const path = require('path');
const [data, audio] = process.argv.slice(2);
const books = [['700caugiaotiepcoban', 91], ['200cumsieungan', 200], ['42baisotrungcap', 42], ['210cumsieungan', 210], ['nameraka', 23],
    ['22baitrungthuongcap', 41], ['180bieudatcamxuc', 180], ['125maucaumorong', 125], ['180cachnoiquenthuoc', 180]];
let thieu = 0;
for (const [b, n] of books) {
    let d;
    try { d = JSON.parse(fs.readFileSync(path.join(data, 'sachkaiwa', `sachkaiwa${b}.json`), 'utf8')); }
    catch { console.log(`   THIẾU  ${b}: chưa có file chữ`); thieu++; continue; }
    let am = 0, hm = 0;
    for (const l of d) {
        const rel = String(l.audioPath || '').replace(/^\.?\/?data\/filenghesachkaiwa\//, '');
        if (rel && !fs.existsSync(path.join(audio, rel))) am++;
        if (l.hinh && !fs.existsSync(path.join(data, l.hinh))) hm++;
    }
    const ok = d.length >= n && !am && !hm;
    if (!ok) thieu++;
    console.log(`   ${ok ? 'đủ    ' : 'THIẾU '} ${b}: ${d.length}/${n} bài${am ? `, thiếu ${am} file nghe` : ''}${hm ? `, thiếu ${hm} ảnh` : ''}`);
}
if (thieu) console.log(`   -> ${thieu} cuốn chưa đủ: đẩy dữ liệu đó lên VPS như bên Phá Đảo (web đọc ngay, không cần cài lại).`);
JS

# ---------- 2. Code + cấu hình + dịch vụ ----------
if ! systemctl is-active --quiet "$SERVICE" && ss -ltn | awk '{print $4}' | grep -q ":$PORT\$"; then
    die "cổng $PORT đang bị chương trình khác dùng (đặt PORT=<cổng khác> trong $ENV_FILE rồi chạy lại)"
fi
install -d -m 755 "$APP_DIR"
install -m 644 "$SRC/kaiwa-server.mjs" "$APP_DIR/kaiwa-server.mjs"

if [ ! -f "$ENV_FILE" ]; then
    SECRET="$("$NODE" -e 'process.stdout.write(require("crypto").randomBytes(32).toString("hex"))')"
    ( umask 077; cat > "$ENV_FILE" <<EOF
PORT=$PORT
SUPABASE_URL=$SUPABASE_URL
SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY
DATA_DIR=$DATA_DIR
AUDIO_DIR=$AUDIO_DIR
LINK_SECRET=$SECRET
ALLOWED_ORIGINS=https://doranihongo.com,https://www.doranihongo.com,http://localhost:3000
ALLOWED_ROLES=admin,giaovien,hocvien
EOF
    )
fi
chmod 600 "$ENV_FILE"

cat > "/etc/systemd/system/$SERVICE.service" <<EOF
[Unit]
Description=API sach Kaiwa cua Dora Kaiwa
After=network.target

[Service]
EnvironmentFile=$ENV_FILE
ExecStart=$NODE $APP_DIR/kaiwa-server.mjs
Restart=always
RestartSec=3
User=nobody
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --quiet "$SERVICE"
systemctl restart "$SERVICE"

ok=0
for _ in 1 2 3 4 5 6 7 8 9 10; do
    if [ "$(curl -s -m 3 "http://127.0.0.1:$PORT/healthz" || true)" = ok ]; then ok=1; break; fi
    sleep 0.5
done
[ "$ok" = 1 ] || { journalctl -u "$SERVICE" -n 20 --no-pager; die "dịch vụ không chạy"; }
code="$(curl -s -m 5 -o /dev/null -w '%{http_code}' -X POST "http://127.0.0.1:$PORT/data" -d '{"book":"nameraka"}')"
[ "$code" = 401 ] || die "gọi không đăng nhập phải bị chặn (401) nhưng nhận $code"
echo "== Dịch vụ $SERVICE chạy ở cổng $PORT, người chưa đăng nhập bị chặn"

# ---------- 3. nginx: https://$DOMAIN/dora-kaiwa/ ----------
mkdir -p "$(dirname "$SNIPPET")" "$BACKUP_DIR"
cat > "$SNIPPET" <<EOF
location ^~ /dora-kaiwa/ {
    proxy_pass http://127.0.0.1:$PORT/;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
}
EOF

DOM_RE="${DOMAIN//./[.]}"
NAME_RE="server_name[[:space:]]+([^;]*[[:space:]])?${DOM_RE}([[:space:]][^;]*)?;"
mapfile -t CONFS < <( { grep -RlE "^[[:space:]]*$NAME_RE" /etc/nginx/sites-enabled /etc/nginx/conf.d /etc/nginx/nginx.conf 2>/dev/null || true; } | xargs -r -n1 readlink -f | sort -u)
[ "${#CONFS[@]}" -gt 0 ] || die "không tìm thấy cấu hình nginx của $DOMAIN. Thêm dòng 'include snippets/dora-kaiwa.conf;' vào khối server đó rồi: nginx -t && systemctl reload nginx"

STAMP="$(date +%Y%m%d-%H%M%S)"
CHANGED=()
for f in "${CONFS[@]}"; do
    if grep -q 'snippets/dora-kaiwa.conf' "$f"; then continue; fi
    cp -p "$f" "$BACKUP_DIR/$(basename "$f").$STAMP" # sao lưu NGOÀI thư mục nginx
    sed -i -E "s#^([[:space:]]*)($NAME_RE.*)#\1\2\n\1include snippets/dora-kaiwa.conf;#" "$f"
    CHANGED+=("$f")
done
if ! nginx -t; then
    for f in "${CHANGED[@]}"; do cp -p "$BACKUP_DIR/$(basename "$f").$STAMP" "$f"; done
    die "cấu hình nginx lỗi -> đã trả lại như cũ"
fi
systemctl reload nginx
sleep 1

# ---------- 4. Thử qua HTTPS ----------
moi="$(curl -s -m 10 "https://$DOMAIN/dora-kaiwa/healthz" || true)"
cu="$(curl -s -m 10 "https://$DOMAIN/healthz" || true)"
echo "== https://$DOMAIN/dora-kaiwa/healthz -> ${moi:0:40}"
echo "== https://$DOMAIN/healthz (dịch vụ cũ) -> ${cu:0:40}"
[ "$moi" = ok ] || die "đường dẫn /dora-kaiwa/ chưa chạy qua nginx"
echo "XONG."
