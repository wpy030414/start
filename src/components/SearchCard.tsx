import { forwardRef, useRef, useState } from 'react';
import { DEFAULT_ENGINE_KEY, searchUrl, type EngineDef } from '../lib/constants';
import { loadDefaultEngineSlot, loadSlotEntries, toEngineDef } from '../lib/engines';
import { useSearchHistory } from '../hooks/useSearchHistory';
import { ENGINE_ICON_MAP } from './icons';

/** 显示引擎图标：预设走内置 SVG；自定义引擎用首字母徽章。 */
function SlotIcon({ def }: { def: EngineDef }) {
  const Icon = def.id ? ENGINE_ICON_MAP[def.id] : undefined;
  if (Icon) return <Icon />;
  return <span className="engine-letter">{def.name.slice(0, 1)}</span>;
}

const SearchCard = forwardRef<HTMLInputElement>(function SearchCard(_, ref) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [slots] = useState(loadSlotEntries);
  const [defaultSlot, setDefaultSlot] = useState(() => loadDefaultEngineSlot(slots));

  // 合并内部 ref 与外部 forwarded ref
  const setRefs = (el: HTMLInputElement | null) => {
    (inputRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
    if (typeof ref === 'function') ref(el);
    else if (ref) ref.current = el;
  };

  /** 发起搜索：有词则以该引擎搜索，留空则进入该引擎首页。 */
  function runEngine(def: EngineDef, q: string) {
    if (q) {
      addHistory(q, def.id || def.name);
      window.location.href = searchUrl(def, q);
    } else {
      window.location.href = def.home;
    }
  }

  /** 回车提交：走当前默认引擎槽位，与「再次点击当前引擎图标」同一语义。 */
  function submit(q: string) {
    const entry = slots[defaultSlot];
    if (entry) runEngine(toEngineDef(entry), q);
  }

  const {
    addHistory, handleFocus, handleBlur, handleInput, handleKeyDown,
    handleCompositionStart, handleCompositionEnd,
  } = useSearchHistory(inputRef, submit);

  function handleEngineClick(i: number) {
    const entry = slots[i];
    if (!entry) return;
    const def = toEngineDef(entry);
    if (i === defaultSlot) {
      runEngine(def, inputRef.current?.value.trim() ?? '');
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
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
          />
          <div className="engine-buttons">
            {slots.map((entry, i) => {
              const def = toEngineDef(entry);
              return (
                <button
                  key={i}
                  type="button"
                  className={`engine-btn${i === defaultSlot ? ' active' : ''}`}
                  data-engine={def.id || `custom-${i}`}
                  title={def.name}
                  aria-label={def.name}
                  onClick={() => handleEngineClick(i)}
                >
                  <SlotIcon def={def} />
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