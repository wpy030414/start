import { forwardRef, useRef, useState } from 'react';
import type { ComponentType } from 'react';
import { DEFAULT_ENGINE_KEY, ENGINE_ORDER, engines } from '../lib/constants';
import type { EngineKey } from '../lib/constants';
import { useSearchHistory } from '../hooks/useSearchHistory';
import { BingIcon, BilibiliIcon, QianwenIcon } from './icons';

const ENGINE_ICONS: Record<EngineKey, ComponentType> = {
  qianwen: QianwenIcon,
  bing: BingIcon,
  bilibili: BilibiliIcon
};

function loadDefaultEngine(): EngineKey {
  const raw = localStorage.getItem(DEFAULT_ENGINE_KEY);
  return raw && (raw in engines) ? (raw as EngineKey) : 'qianwen';
}

const SearchCard = forwardRef<HTMLInputElement>(function SearchCard(_, ref) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [defaultEngine, setDefaultEngine] = useState<EngineKey>(loadDefaultEngine);
  const { addHistory, handleFocus, handleBlur, handleInput, handleKeyDown } = useSearchHistory(inputRef);

  // 合并内部 ref 与外部 forwarded ref
  const setRefs = (el: HTMLInputElement | null) => {
    (inputRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
    if (typeof ref === 'function') ref(el);
    else if (ref) ref.current = el;
  };

  function doSearch(key: EngineKey, q: string) {
    localStorage.setItem(DEFAULT_ENGINE_KEY, key);
    setDefaultEngine(key);
    addHistory(q, key);
    window.location.href = engines[key].url(q);
  }

  function handleEngineClick(key: EngineKey) {
    if (key === defaultEngine) {
      const q = inputRef.current?.value.trim() ?? '';
      if (q) {
        doSearch(key, q);
      } else {
        window.location.href = engines[key].home;
      }
    } else {
      setDefaultEngine(key);
      localStorage.setItem(DEFAULT_ENGINE_KEY, key);
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
            {ENGINE_ORDER.map(key => {
              const Icon = ENGINE_ICONS[key];
              return (
                <button
                  key={key}
                  type="button"
                  className={`engine-btn${key === defaultEngine ? ' active' : ''}`}
                  data-engine={key}
                  title={engines[key].name}
                  onClick={() => handleEngineClick(key)}
                >
                  <Icon />
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