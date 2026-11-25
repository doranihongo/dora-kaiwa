import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { CircleCheck, Eye, EyeOff, KeyRound, LogOut, User, X } from 'lucide-react';
import useBodyScrollLock from '../hooks/useBodyScrollLock';
import {
  clearAccountCache,
  fetchProfileWithRetry,
  getAuthUser,
  getSupabase,
  loginUrl,
  readCache,
  writeCache,
} from '../utils/authGlobals';

// Nút tài khoản (avatar) + bảng "Tài khoản của tôi" trượt từ phải vào.
//
// Trước đây là HTML tĩnh ngoài #root (kaiwa/index.html) + public/js/accountPanel.js
// điều khiển bằng DOM thuần: tự khóa/mở khóa <body> riêng, và App.tsx/Home.tsx
// phải tự tay ẩn/hiện nút bằng style.display mỗi lần mở khóa học/popup - 3 nơi
// cùng đụng vào style body/nút nên rất dễ lệch nhau. Giờ làm đúng kiểu
// UserAccountMenu.jsx của web Phá Đảo Tiếng Nhật:
//   - là 1 component nằm TRONG thanh điều hướng (Home.tsx), không còn nút nổi
//     position:fixed bên ngoài => khóa học/buổi học/popup (z cao hơn) tự đè lên
//     nút, không cần ai ẩn/hiện nó nữa;
//   - bảng render qua Portal ra thẳng <body> - thanh điều hướng có
//     backdrop-blur (backdrop-filter) nên mọi phần tử `fixed` nằm bên trong nó
//     bị "nhốt" vào đúng khung thanh đó chứ không phủ được cả màn hình;
//   - khóa cuộn nền qua useBodyScrollLock dùng chung (có đếm lượt).
// Giao diện SÁNG như UserAccountMenu.jsx của web Phá Đảo Tiếng Nhật: nút avatar tròn
// viền #D3E4FC trên thanh công cụ sáng (SiteNav), bảng trượt từ phải nền trắng/#F0F6FF.
// Toàn bộ kiểu dáng viết bằng class Tailwind ngay trong file này (trước đây nằm ở
// css/topbar.css, file CSS ngoài chỉ nạp ở bản build nên rất khó soát bằng dev server).
const NO_TAP = { WebkitTapHighlightColor: 'transparent' } as const;

// Avatar icon tài khoản - CỐ ĐỊNH, luôn là ảnh này.
const ACCOUNT_AVATAR_URL = 'https://api.dicebear.com/9.x/thumbs/svg?seed=ghm0gmgl';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Quản trị viên',
  giaovien: 'Giáo viên',
  hocvien: 'Học viên',
};

export default function UserAccountMenu() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        id="accountBtn"
        type="button"
        // "account-btn" giữ lại làm móc cho test/chụp ảnh; kiểu dáng là các class Tailwind bên cạnh.
        className="account-btn h-10 w-10 shrink-0 overflow-hidden rounded-full border-2 border-[#D3E4FC] bg-white shadow-sm outline-none transition-all hover:border-[#2F7DF6] focus-visible:border-[#2F7DF6] active:scale-95"
        style={NO_TAP}
        aria-label="Tài khoản"
        onClick={() => setIsOpen(true)}
      >
        <img className="account-avatar block h-full w-full rounded-full object-cover" src={ACCOUNT_AVATAR_URL} alt="Avatar" />
      </button>
      {isOpen && <AccountPanel onClose={() => setIsOpen(false)} />}
    </>
  );
}

type InfoState = {
  displayName: string;
  role: string;
  deviceCount: string;
  expiresAt: string;
};

const EMPTY_INFO: InfoState = { displayName: '-', role: '-', deviceCount: '-', expiresAt: '-' };

function roleLabel(role: string | undefined) {
  return (role && ROLE_LABELS[role]) || role || '-';
}

function PasswordField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-semibold uppercase tracking-wider text-[#5B6B85]">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
          // text-base = 16px: iOS Safari tự phóng to trang nếu ô nhập nhỏ hơn 16px.
          className="w-full rounded-xl border-2 border-[#D3E4FC] bg-white px-4 py-3 pr-12 text-base font-medium text-[#1A2A54] outline-none transition-colors focus:border-[#2F7DF6]"
        />
        {/* Chỉ hiện con mắt khi ô đã có chữ. */}
        {value && (
          <button
            type="button"
            style={NO_TAP}
            className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-[#8B9BB8] transition-colors hover:text-[#2F7DF6]"
            aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            onClick={() => setVisible((v) => !v)}
          >
            {visible ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        )}
      </div>
    </div>
  );
}

function AccountPanel({ onClose }: { onClose: () => void }) {
  useBodyScrollLock(true);

  // Trượt vào từ phải: bảng bắt đầu nằm ngoài màn hình (translateX(100%)) rồi chuyển về 0.
  // Dùng "rAF đôi" (2 requestAnimationFrame lồng nhau) để trình duyệt kịp vẽ trạng thái
  // ban đầu trước khi đổi - 1 rAF thôi thì lần mở đầu tiên có thể bị gộp vào cùng 1 lần
  // commit style và mất hiệu ứng (giống SidePanel của UserAccountMenu.jsx bên web Phá Đảo).
  const [slidIn, setSlidIn] = useState(false);
  useEffect(() => {
    let innerId = 0;
    const outerId = requestAnimationFrame(() => {
      innerId = requestAnimationFrame(() => setSlidIn(true));
    });
    return () => {
      cancelAnimationFrame(outerId);
      if (innerId) cancelAnimationFrame(innerId);
    };
  }, []);

  const [view, setView] = useState<'info' | 'password'>('info');
  const [info, setInfo] = useState<InfoState>(EMPTY_INFO);

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Bảng có thể bị đóng/unmount khi đang chờ mạng - các lời gọi bất đồng bộ
  // dưới đây kiểm tra cờ này trước khi setState.
  const aliveRef = useRef(true);
  const successTimerRef = useRef<number | null>(null);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      if (successTimerRef.current !== null) window.clearTimeout(successTimerRef.current);
    };
  }, []);

  // Điền thông tin tài khoản mỗi lần mở bảng: hiện ngay dữ liệu đã có ở
  // window.__authUser, rồi lấy lại bản mới nhất từ Supabase (admin sửa trực
  // tiếp trên Supabase thì lần mở sau thấy ngay, không cần tải lại trang).
  // Dùng lại cache 5 phút của authGuard (fetchProfileWithRetry) nên không
  // thêm request mỗi lần mở. Lỗi mạng thì im lặng giữ dữ liệu cũ.
  useEffect(() => {
    const user = getAuthUser();
    if (!user) return; // authGuard đang chuyển về trang đăng nhập

    setInfo({
      displayName: user.displayName,
      role: roleLabel(user.role),
      deviceCount: '-',
      expiresAt: '-',
    });

    (async () => {
      const { data: profile, error: profileError } = await fetchProfileWithRetry(user.id);
      if (!profileError && profile) {
        user.role = profile.role;
        user.displayName = profile.display_name || user.displayName;
        user.maxDevices = profile.max_devices;
        user.expiresAt = profile.expires_at;
      }

      const maxDevices = user.maxDevices || 1;
      let deviceCount: string;
      // admin miễn giới hạn thiết bị - không có dữ liệu theo dõi thật cho role này.
      if (user.role === 'admin') {
        deviceCount = `1/${maxDevices}`;
      } else {
        const countKey = `acct_devcount_${user.id}`;
        let activeCount = readCache(countKey);
        if (activeCount === null) {
          const { data: devices, error: devicesError } = await getSupabase()
            .from('user_devices')
            .select('id')
            .eq('user_id', user.id);
          activeCount = devicesError ? 1 : devices?.length || 1;
          if (!devicesError) writeCache(countKey, activeCount);
        }
        deviceCount = `${activeCount}/${maxDevices}`;
      }

      if (!aliveRef.current) return;
      setInfo({
        displayName: user.displayName,
        role: roleLabel(user.role),
        deviceCount,
        expiresAt: user.expiresAt ? new Date(user.expiresAt).toLocaleDateString('vi-VN') : 'Vĩnh viễn',
      });
    })().catch(() => {
      /* giữ nguyên dữ liệu đã hiện */
    });
  }, []);

  const showInfoView = () => {
    setView('info');
    setError('');
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!oldPassword) return setError('Vui lòng nhập mật khẩu hiện tại.');
    if (newPassword.length < 6) return setError('Mật khẩu mới phải có ít nhất 6 ký tự.');
    if (newPassword !== confirmPassword) return setError('Mật khẩu không khớp.');

    setSubmitting(true);
    try {
      const supabase = getSupabase();
      const user = getAuthUser();
      const email = user?.email;
      if (!user || !email) throw new Error('Không tìm thấy thông tin tài khoản.');

      // Xác thực mật khẩu cũ trước khi cho đổi.
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email,
        password: oldPassword,
      });
      if (verifyError) throw new Error('Mật khẩu hiện tại không đúng.');

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;

      // Đánh dấu mốc đổi mật khẩu - giống luồng bắt buộc lần đầu (login.js),
      // để các phiên cũ ở thiết bị khác bị thu hồi (xem authGuard ở common.js).
      const { error: markChangedError } = await supabase
        .from('profiles')
        .update({ password_changed_at: new Date().toISOString() })
        .eq('id', user.id);
      if (markChangedError) {
        console.warn(
          'Không cập nhật được password_changed_at (có thể do RLS):',
          markChangedError.message,
        );
      }

      // Làm mới token của chính thiết bị này - nếu không, lần authGuard tiếp
      // theo sẽ tưởng token hiện tại (cấp từ trước lúc đổi) là phiên cũ rồi
      // tự đăng xuất.
      await supabase.auth.refreshSession();
      clearAccountCache();

      if (!aliveRef.current) return;
      // Popup "Thành công!" 2.5s rồi quay lại màn thông tin.
      setShowSuccess(true);
      successTimerRef.current = window.setTimeout(() => {
        setShowSuccess(false);
        showInfoView();
      }, 2500);
    } catch (err: any) {
      if (!aliveRef.current) return;
      const msg: string = err?.message || '';
      if (msg.toLowerCase().includes('different from the old password')) {
        setError('Mật khẩu mới phải khác mật khẩu cũ.');
      } else {
        setError(msg || 'Có lỗi xảy ra khi đổi mật khẩu.');
      }
    } finally {
      if (aliveRef.current) setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await getSupabase().auth.signOut();
    clearAccountCache();
    window.location.href = loginUrl();
  };

  return createPortal(
    <div
      className="account-panel-overlay fixed inset-0 z-[10000] flex justify-end overscroll-contain bg-[#1A2A54]/40"
      // Bấm vào nền mờ (ngoài bảng) thì đóng.
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="account-panel flex h-full w-full flex-col border-l-0 border-[#D3E4FC] bg-white shadow-2xl sm:max-w-[400px] sm:border-l"
        style={{
          transition: 'transform 300ms cubic-bezier(0.16, 1, 0.3, 1)',
          transform: slidIn ? 'translateX(0)' : 'translateX(100%)',
        }}
      >
        <div className="flex flex-shrink-0 items-center justify-between border-b border-[#D3E4FC] bg-[#F0F6FF] p-6">
          <h2 className="flex items-center gap-2 text-xl font-bold text-[#1A2A54]">
            <User className="h-6 w-6 text-[#2F7DF6]" />
            Tài khoản của tôi
          </h2>
          <button
            type="button"
            style={NO_TAP}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E3EEFF] text-[#8B9BB8] shadow-sm outline-none transition-all hover:bg-red-50 hover:text-red-600"
            aria-label="Đóng"
            onClick={onClose}
          >
            <X className="h-6 w-6" strokeWidth={2.5} />
          </button>
        </div>

        <div className="relative flex flex-1 flex-col gap-6 overflow-y-auto p-6">
          {showSuccess && (
            <div className="absolute inset-0 z-[5] flex items-center justify-center bg-white/85 p-6 backdrop-blur-sm animate-in fade-in duration-300">
              <div className="flex w-full max-w-[290px] flex-col items-center rounded-2xl border border-[#D3E4FC] bg-white p-6 text-center shadow-xl">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-50 text-green-500">
                  <CircleCheck className="h-9 w-9" strokeWidth={2.2} />
                </div>
                <h3 className="mb-1 text-lg font-bold text-[#1A2A54]">Thành công!</h3>
                <p className="text-sm text-[#5B6B85]">Mật khẩu của bạn đã được thay đổi.</p>
              </div>
            </div>
          )}

          {view === 'info' ? (
            <>
              <div className="flex flex-col items-center pb-1">
                <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-full border-2 border-[#D3E4FC] bg-white">
                  <img className="block h-full w-full object-cover" src={ACCOUNT_AVATAR_URL} alt="Avatar" />
                </div>
              </div>
              <InfoRow label="TÀI KHOẢN" value={info.displayName} />
              <InfoRow label="Vai trò" value={info.role} />
              <InfoRow label="Số lượng thiết bị" value={info.deviceCount} />
              <InfoRow label="Hạn sử dụng" value={info.expiresAt} />
              <button
                type="button"
                style={NO_TAP}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#E3EEFF] px-4 py-3 font-bold text-[#2F7DF6] transition-colors hover:bg-[#D3E4FC]"
                onClick={() => setView('password')}
              >
                <KeyRound className="h-4 w-4" />
                Đổi mật khẩu
              </button>
            </>
          ) : (
            <div>
              <div className="mb-5 flex items-center justify-between">
                <h3 className="text-base font-bold text-[#1A2A54]">Đổi mật khẩu</h3>
                <button
                  type="button"
                  style={NO_TAP}
                  className="text-sm font-semibold text-[#5B6B85] transition-colors hover:text-[#2F7DF6]"
                  onClick={showInfoView}
                >
                  Quay lại
                </button>
              </div>
              {error && (
                <div
                  className="mb-4 rounded-xl border border-red-100 bg-red-50 p-3 text-center text-sm font-bold text-red-600"
                  role="alert"
                >
                  {error}
                </div>
              )}
              <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
                <PasswordField
                  id="accountOldPassword"
                  label="Mật khẩu hiện tại"
                  value={oldPassword}
                  onChange={setOldPassword}
                />
                <PasswordField
                  id="accountNewPassword"
                  label="Mật khẩu mới"
                  value={newPassword}
                  onChange={setNewPassword}
                />
                <PasswordField
                  id="accountConfirmPassword"
                  label="Nhập lại mật khẩu mới"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                />
                <button
                  type="submit"
                  disabled={submitting}
                  style={NO_TAP}
                  className="mt-1 w-full rounded-xl bg-[#2F7DF6] py-3.5 font-bold text-white transition-all hover:bg-[#1E5FD9] active:scale-[0.98] disabled:cursor-wait disabled:opacity-60"
                >
                  {submitting ? 'ĐANG XỬ LÝ...' : 'Lưu thay đổi'}
                </button>
              </form>
            </div>
          )}
        </div>

        {/* pb tính cả vùng an toàn dưới của iPhone (thanh vuốt về màn hình chính). */}
        <div className="flex-shrink-0 border-t border-[#D3E4FC] bg-[#F0F6FF] p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          <button
            type="button"
            style={NO_TAP}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-100 py-3.5 font-bold text-red-600 transition-all hover:bg-red-200 active:scale-[0.98]"
            onClick={handleLogout}
          >
            <LogOut className="h-5 w-5" />
            Đăng xuất
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// Một hàng thông tin dạng thẻ (nhãn nhỏ viết hoa + ô giá trị nền #F0F6FF viền #D3E4FC).
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label className="text-sm font-semibold uppercase tracking-wider text-[#5B6B85]">{label}</label>
      {/* min-w-0 + truncate: tên dài hiện "..." thay vì tràn khung; title để xem đủ khi rê chuột. */}
      <div
        className="min-w-0 truncate rounded-xl border border-[#D3E4FC] bg-[#F0F6FF] px-4 py-3 font-medium text-[#1A2A54]"
        title={value}
      >
        {value}
      </div>
    </div>
  );
}
