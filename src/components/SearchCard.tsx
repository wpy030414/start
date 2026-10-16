import { forwardRef, useRef, useState } from 'react';
import type { ComponentType } from 'react';
import {
  BUILTIN_ENGINE_ICONS,
  DEFAULT_ENGINE_KEY,
  faviconUrl,
  searchUrl,
  type EngineDef,
} from '../lib/constants';
import { loadDefaultEngineSlot, loadEngineSlots } from '../lib/engines';
import { useSearchHistory } from '../hooks/useSearchHistory';
import { BingIcon, BilibiliIcon, QianwenIcon } from './icons';

const ENGINE_ICONS: Record<string, ComponentType> = {
  qianwen: QianwenIcon,
  bing: BingIcon,
  bilibili: BilibiliIcon,
};

/** 非内置引擎图标：直连域名 favicon（no-referrer），失败时隐藏 img 并以首字母覆盖（img 保持挂载避免布局抖动）。 */
function EngineFavicon({ def, fallbackClass }: { def: EngineDef; fallbackClass: string }) {
  const [failed, setFailed] = useState(false);
  const src = faviconUrl(def);
  if (!src) {
    return <span className={fallbackClass} aria-hidden="true">{def.name.slice(0, 1)}</span>;
  }
  return (
    <>
      <img
        className="engine-favicon"
        src={src}
        alt={def.name}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        style={failed ? { display: 'none' } : undefined}
      />
      {failed && <span className={fallbackClass} aria-hidden="true">{def.name.slice(0, 1)}</span>}
    </>
  );
}

const SearchCard = forwardRef<HTMLInputElement>(function SearchCard(_, ref) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [slots] = useState(loadEngineSlots);
  const [defaultSlot, setDefaultSlot] = useState(() => loadDefaultEngineSlot(slots));
  const { addHistory, handleFocus, handleBlur, handleInput, handleKeyDown } = useSearchHistory(inputRef);

  // 合并内部 ref 与外部 forwarded ref
  const setRefs = (el: HTMLInputElement | null) => {
    (inputRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
    if (typeof ref === 'function') ref(el);
    else if (ref) ref.current = el;
  };

  function doSearch(def: EngineDef, q: string) {
    addHistory(q, def.id);
    window.location.href = searchUrl(def, q);
  }

  function handleEngineClick(i: number) {
    const def = slots[i];
    if (!def) return;
    if (i === defaultSlot) {
      const q = inputRef.current?.value.trim() ?? '';
      if (q) {
        doSearch(def, q);
      } else {
        window.location.href = def.home;
      }
    } else {
      setDefaultSlot(i);
      localStorage.setItem(DEFAULT_ENGINE_KEY, String(i));
      inputRef.current?.focus();
    }
  }

  return (
    <section id="top-third">
      <div className="search-shell" id="search-shell">
        <div className="search-card" id="search-card">
          <div className="search-card-bg" />
          <input
            ref={setRefs}
            type="text"
            id="search-input"
            placeholder="搜索..."
            autoComplete="off"
            onFocus={handleFocus}
            onBlur={handleBlur}
            onInput={handleInput}
            onKeyDown={handleKeyDown}
          />
          <div className="engine-buttons">
            {slots.map((def, i) => {
              const Icon = BUILTIN_ENGINE_ICONS.has(def.id) ? ENGINE_ICONS[def.id] : undefined;
              return (
                <button
                  key={i}
                  type="button"
                  className={`engine-btn${i === defaultSlot ? ' active' : ''}`}
                  data-engine={def.id}
                  title={def.name}
                  aria-label={def.name}
                  onClick={() => handleEngineClick(i)}
                >
                  {Icon
                    ? <Icon />
                    : <EngineFavicon def={def} fallbackClass="engine-letter" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
});

export default SearchCard;
