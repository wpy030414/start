import type { RefObject } from 'react';

export default function ShortcutsModal({
  titleRef,
  urlRef,
}: {
  titleRef: RefObject<HTMLInputElement | null>;
  urlRef: RefObject<HTMLInputElement | null>;
}) {
  return (
    <div id="shortcuts-modal">
      <div className="shortcuts-panel">
        <div className="shortcuts-form">
          <input
            ref={titleRef}
            type="text"
            id="shortcut-title"
            placeholder="标题（可选）"
            autoComplete="off"
          />
          <input
            ref={urlRef}
            type="text"
            id="shortcut-url"
            placeholder="链接，例如 https://example.com"
            autoComplete="off"
          />
          <button type="button" className="shortcuts-add" id="shortcut-add">添加</button>
        </div>
      </div>
    </div>
  );
}