// Hình vẽ cho thẻ "Video" (màn hình + nút phát + 2 bong bóng thoại) - tự vẽ, cùng tông xanh Phá Đảo.
export default function VideoArt({ className = '' }) {
    return (
        <svg viewBox="0 0 120 120" className={className} aria-hidden="true">
            <rect x="10" y="22" width="100" height="66" rx="12" fill="#2F7DF6" />
            <rect x="16" y="28" width="88" height="54" rx="8" fill="#E3EEFF" />
            <circle cx="60" cy="55" r="15" fill="#EF4444" />
            <path d="M55 47 L68 55 L55 63 Z" fill="#fff" />
            <rect x="46" y="92" width="28" height="6" rx="3" fill="#2F7DF6" />
            <rect x="36" y="98" width="48" height="6" rx="3" fill="#1E5FD9" />
            <path d="M86 6 h24 a6 6 0 0 1 6 6 v10 a6 6 0 0 1 -6 6 h-14 l-6 6 v-6 h-4 a6 6 0 0 1 -6 -6 v-10 a6 6 0 0 1 6 -6 z" fill="#10B981" />
            <circle cx="92" cy="17" r="2" fill="#fff" /><circle cx="98" cy="17" r="2" fill="#fff" /><circle cx="104" cy="17" r="2" fill="#fff" />
        </svg>
    );
}
