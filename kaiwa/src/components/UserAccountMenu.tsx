import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
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
// Giao diện giữ nguyên: dùng lại y các class account-* trong css/topbar.css.

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
        className="account-btn"
        aria-label="Tài khoản"
        onClick={() => setIsOpen(true)}
      >
        <img className="account-avatar" src={ACCOUNT_AVATAR_URL} alt="Avatar" />
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
    <div className="account-field">
      <label htmlFor={id}>{label}</label>
      <div className="account-field-input-wrap">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          placeholder=" "
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          className="account-toggle-password"
          aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
          onClick={() => setVisible((v) => !v)}
        >
          <i className={`fa-solid ${visible ? 'fa-eye-slash' : 'fa-eye'}`}></i>
        </button>
      </div>
    </div>
  );
}

function AccountPanel({ onClose }: { onClose: () => void }) {
  useBodyScrollLock(true);

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
      className="account-panel-overlay"
      style={{ zIndex: 10000 }}
      // Bấm vào nền tối (ngoài bảng) thì đóng.
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="account-panel">
        <div className="account-panel-header">
          <h2>
            <i className="fa-solid fa-user"></i> Tài khoản của tôi
          </h2>
          <button type="button" className="account-panel-close" aria-label="Đóng" onClick={onClose}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div className="account-panel-body">
          {showSuccess && (
            <div className="account-success-popup">
              <div className="account-success-card">
                <div className="account-success-icon">
                  <i className="fa-solid fa-circle-check"></i>
                </div>
                <h3>Thành công!</h3>
                <p>Mật khẩu của bạn đã được thay đổi.</p>
              </div>
            </div>
          )}

          {view === 'info' ? (
            <div>
              <div className="account-field">
                <label>TÀI KHOẢN</label>
                <div className="account-field-value">{info.displayName}</div>
              </div>
              <div className="account-field">
                <label>Vai trò</label>
                <div className="account-field-value">{info.role}</div>
              </div>
              <div className="account-field">
                <label>Số lượng thiết bị</label>
                <div className="account-field-value">{info.deviceCount}</div>
              </div>
              <div className="account-field">
                <label>Hạn sử dụng</label>
                <div className="account-field-value">{info.expiresAt}</div>
              </div>
              <button
                type="button"
                className="account-secondary-btn"
                onClick={() => setView('password')}
              >
                <i className="fa-solid fa-key"></i> Đổi mật khẩu
              </button>
            </div>
          ) : (
            <div>
              <div className="account-panel-subheader">
                <h3>Đổi mật khẩu</h3>
                <button type="button" onClick={showInfoView}>
                  Quay lại
                </button>
              </div>
              <div className={`account-error${error ? ' is-visible' : ''}`} role="alert">
                {error}
              </div>
              <form noValidate onSubmit={handleSubmit}>
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
                <button type="submit" className="account-primary-btn" disabled={submitting}>
                  {submitting ? 'ĐANG XỬ LÝ...' : 'Lưu thay đổi'}
                </button>
              </form>
            </div>
          )}
        </div>

        <div className="account-panel-footer">
          <button type="button" className="account-logout-btn" onClick={handleLogout}>
            <i className="fa-solid fa-right-from-bracket"></i> Đăng xuất
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
