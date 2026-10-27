import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { usePopover } from '../hooks/usePopover';
import type { EngineDef } from '../lib/constants';

/** 菜单末位的伪条目值（自定义引擎）。 */
export const CUSTOM_OPTION_VALUE = '__custom__';

/**
 * 主题化下拉：替代原生 <select>。
 *
 * 菜单经 createPortal 挂到 body：.settings-panel 自带 backdrop-filter，按规范会成为后代的
 * backdrop root，菜单若留在面板内，模糊只能取到面板内部内容、取不到面板背后的壁纸
 * （实测高对比背景会原样透出，菜单文字与背景糊成一片）。脱离面板后取样范围才是整页。
 *
 * 外点 / Escape 关闭复用 usePopover（多实例天然互斥）；键盘对齐原生 select 的基本能力。
 */
export default function EngineSelect({
  options,
  value,
  label,
  ariaLabel,
  dataSlot,
  onSelect,
  onCustom,
}: {
  options: EngineDef[];
  /** 当前预设 id；自定义引擎为空串。 */
  value: string;
  /** 触发器显示文本（由调用方拼装，含自定义后缀）。 */
  label: string;
  ariaLabel: string;
  /** 供 e2e 定位菜单（菜单已 portal 出槽位容器）。 */
  dataSlot?: number;
  onSelect: (preset: EngineDef) => void;
  onCustom: () => void;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const { open, setOpen } = usePopover({ buttonRef, popoverRef: menuRef });
  const [activeIndex, setActiveIndex] = useState(-1);
  // 固定定位的视口坐标（菜单脱离文档流，无法再靠 .engine-slot 定位）
  const [menuRect, setMenuRect] = useState({ top: 0, left: 0, width: 0 });

  const itemCount = options.length + 1; // 末位是「自定义…」
  const presetIndex = value ? options.findIndex((o) => o.id === value) : -1;
  // 自定义引擎（或预设已下线）时，当前项落在末位的「自定义…」上
  const currentIndex = presetIndex >= 0 ? presetIndex : options.length;

  useEffect(() => {
    if (!open) return;
    // 菜单是 fixed 定位，页面滚动会与触发器错位；直接收起，与原生 select 行为一致
    const onScroll = () => setOpen(false);
    window.addEventListener('scroll', onScroll, true);
    return () => window.removeEventListener('scroll', onScroll, true);
  }, [open, setOpen]);

  function choose(i: number) {
    if (i < options.length) {
      const preset = options[i];
      if (preset) onSelect(preset);
    } else {
      onCustom();
    }
    setOpen(false);
  }

  function toggle() {
    if (!open) {
      const r = buttonRef.current?.getBoundingClientRect();
      if (r) setMenuRect({ top: r.bottom + 6, left: r.left, width: r.width });
      setActiveIndex(currentIndex);
    }
    setOpen(!open);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (!open) return; // 未打开时交给原生（Enter/Space 触发 click）
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const delta = e.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex((i) => ((i < 0 ? currentIndex : i) + delta + itemCount) % itemCount);
    } else if (e.key === 'Enter') {
      e.preventDefault(); // 阻断原生 click，避免打开态的 Enter 把菜单关掉
      choose(activeIndex >= 0 ? activeIndex : currentIndex);
    }
  }

  function optionClass(i: number, selected: boolean) {
    const isCustom = i >= options.length;
    return `engine-option${selected ? ' selected' : ''}${i === activeIndex ? ' active' : ''}${isCustom ? ' engine-option-custom' : ''}`;
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="engine-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={toggle}
        onKeyDown={handleKeyDown}
      >
        <span className="engine-trigger-label">{label}</span>
        <span className="engine-caret" aria-hidden="true" />
      </button>
      {createPortal(
        <div
          ref={menuRef}
          className={`engine-menu${open ? ' open' : ''}`}
          role="listbox"
          aria-label={ariaLabel}
          data-slot={dataSlot}
          style={{ top: menuRect.top, left: menuRect.left, width: menuRect.width }}
        >
          {options.map((o, i) => (
            <button
              key={o.id}
              type="button"
              role="option"
              aria-selected={o.id === value}
              data-value={o.id}
              className={optionClass(i, o.id === value)}
              onClick={() => choose(i)}
            >
              {o.name}
            </button>
          ))}
          <button
            type="button"
            role="option"
            aria-selected={!value}
            data-value={CUSTOM_OPTION_VALUE}
            className={optionClass(options.length, !value)}
            onClick={() => choose(options.length)}
          >
            自定义…
          </button>
        </div>,
        document.body,
      )}
    </>
  );
}
