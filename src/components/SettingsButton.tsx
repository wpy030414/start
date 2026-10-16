import { GearIcon } from './icons';
import { navigateTo } from '../hooks/useRoute';

/** 左下角设置入口：真链接（支持中键/⌘点击新开标签），左键单击拦截为 pushState 导航。 */
export default function SettingsButton() {
  return (
    <a
      id="settings-btn"
      className="help-btn settings-btn"
      href="/settings"
      title="设置"
      aria-label="设置"
      onClick={e => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        navigateTo('/settings');
      }}
    >
      <span className="help-btn-icon">
        <GearIcon />
      </span>
    </a>
  );
}
