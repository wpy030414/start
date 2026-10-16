import type { RefObject } from 'react';

export default function SettingsPopover({
  rootRef,
  open,
  children,
}: {
  rootRef: RefObject<HTMLDivElement | null>;
  open: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      ref={rootRef}
      id="settings-popover"
      className={`help-popover settings-popover${open ? ' open' : ''}`}
      aria-hidden={!open}
    >
      <div className="help-popover-content">
        <strong>设置</strong>
        <div className="settings-list">{children}</div>
      </div>
    </div>
  );
}
