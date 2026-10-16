import type { RefObject } from 'react';
import { GearIcon } from './icons';

export default function SettingsButton({
  rootRef,
  onClick,
}: {
  rootRef: RefObject<HTMLButtonElement | null>;
  onClick: () => void;
}) {
  return (
    <button
      ref={rootRef}
      type="button"
      id="settings-btn"
      className="help-btn settings-btn"
      title="设置"
      aria-label="设置"
      onClick={onClick}
    >
      <span className="help-btn-icon">
        <GearIcon />
      </span>
    </button>
  );
}
