# API sách Kaiwa trên VPS

Web vẫn là web tĩnh trên GitHub Pages. Riêng **sách Kaiwa** (chữ, audio của 9 giáo trình) nằm trên VPS
(máy phục vụ `xh.doranihongo.com`) và chỉ phát cho **tài khoản Dora Kaiwa hợp lệ** (role `admin` / `giaovien` / `hocvien`, còn hạn,
token không cũ hơn lần đổi mật khẩu gần nhất). Người chưa đăng nhập và tài khoản `student` của web kanji bị chặn.

- Đường dẫn: `https://xh.doranihongo.com/dora-kaiwa/` (nginx chuyển vào dịch vụ `dora-kaiwa`, cổng 3200).
- Dữ liệu **đọc thẳng** từ thư mục đã có trên VPS (dùng chung với web Phá Đảo, không chép bản thứ hai):
  chữ + ảnh ở `/opt/baitap/repo/baitap-data/khoa/`, audio ở `/opt/baitap/kaiwa-audio/`.
  Bên Phá Đảo cập nhật dữ liệu lên VPS thì web này thấy ngay. **Xóa/đổi các thư mục đó là web này cũng mất theo.**
- Muốn tách bản riêng: chép 2 thư mục đó sang chỗ khác, sửa `DATA_DIR`, `AUDIO_DIR` trong `/etc/dora-kaiwa.env`,
  rồi `systemctl restart dora-kaiwa`.
- Thêm **cuốn mới**: dữ liệu đẩy lên VPS chưa đủ, phải thêm cuốn đó vào web
  (`kaiwa/src/pages/ShadowingPage.tsx`, `kaiwa/src/components/shadowing/kaiwaParts.js`, `KaiwaBookArt.jsx`).

## Cài / cập nhật

Trên máy Windows (PowerShell), đứng ở thư mục dự án (thay `<IP-VPS>` bằng IP của máy):

```powershell
scp vps\kaiwa-server.mjs vps\cai-dat.sh root@<IP-VPS>:/tmp/
```

Trên VPS:

```bash
bash /tmp/cai-dat.sh
```

Dòng cuối phải là `XONG.`. Script in bảng kiểm 9 giáo trình; cuốn nào ghi `THIẾU` thì dữ liệu cuốn đó chưa lên VPS.

**Cài VPS xong rồi mới push web** (push `main` là web tự deploy; deploy trước thì sách Kaiwa không tải được).

## Kiểm tra / gỡ

```bash
systemctl status dora-kaiwa --no-pager
journalctl -u dora-kaiwa -n 30 --no-pager
```

Gỡ hẳn: `systemctl disable --now dora-kaiwa`, xóa dòng `include snippets/dora-kaiwa.conf;` trong cấu hình nginx
(bản gốc ở `/root/dora-kaiwa-backup/`), `nginx -t && systemctl reload nginx`.

Cấu hình (`/etc/dora-kaiwa.env`): `ALLOWED_ORIGINS`, `ALLOWED_ROLES`, `LINK_TTL_SEC` (hạn link audio, mặc định 6 giờ).
Đổi xong thì `systemctl restart dora-kaiwa`.

## Thử

`node vps/test-server.mjs` - chạy API ở máy với Supabase giả: kiểm quyền, chữ ký audio, chặn đường dẫn lạ.
