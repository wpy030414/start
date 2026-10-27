import GlassBackdrop from './GlassBackdrop';
import { GearIcon } from './icons';
import { navigateTo } from '../hooks/useRoute';

/**
 * 右上角设置入口：真链接（支持中键/⌘点击新开标签），左键单击拦截为 pushState 导航。
 *
 * 玻璃由 @glass-sdk/liquid-glass 绘制（第 5 颗材质层）：材质层是绝对铺满的子层，
 * 父级保留手写 backdrop-filter 作为无 WebGPU 时的降级外观（见 styles/glass.css）。
 */
export default function SettingsButton() {
  return (
    <a
      id="settings-btn"
      className="corner-btn settings-btn"
      href="/settings"
      title="设置"
      aria-label="设置"
      onClick={e => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        navigateTo('/settings');
      }}
    >
      <GlassBackdrop className="corner-btn-bg" radius="circle" refraction={14} />
      <span className="corner-btn-icon">
        <GearIcon />
      </span>
    </a>
  );
}
