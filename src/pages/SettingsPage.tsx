import { useEffect, useRef, useState } from 'react';
import type { BgStoreState } from '../hooks/useBackgroundStore';
import { navigateTo } from '../hooks/useRoute';
import { clearBgStore } from '../lib/db';
import {
  BUILTIN_ENGINE_ICONS,
  CYCLE_MODES,
  ENGINE_PRESETS,
  HISTORY_KEY,
  faviconUrl,
  type CycleMode,
  type EngineDef,
} from '../lib/constants';
import { loadDefaultEngineSlot, loadEngineSlots, saveEngineSlots } from '../lib/engines';
import { BingIcon, BilibiliIcon, QianwenIcon } from '../components/icons';

interface SettingsPageProps {
  /** 背景域 state（非 ref）：store 变更驱动网格重渲染。 */
  bgState: BgStoreState;
  addBackgroundFiles: (files: FileList | File[]) => Promise<void>;
  setCurrentBackground: (hash: string) => void;
  removeBackground: (hash: string) => void;
  /* 背景循环档位：受控，源在 App（localStorage 持久化 + useBgCycle 实时生效）。 */
  cycleMode: CycleMode;
  onCycleModeChange: (mode: CycleMode) => void;
}

function isPlainLeftClick(e: React.MouseEvent): boolean {
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
}

/** 缩略图：每项自管 objectURL（mount 建 / unmount revoke），StrictMode 安全。
 *  Safari 从 IDB 重建的 File 建 objectURL 可能失败 → 类型徽章降级。
 *  注意不复用 resolveBgSrc——其模块级 active 状态属于主背景。 */
function BgThumb({ file }: { file: File }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let u = '';
    try {
      u = URL.createObjectURL(file);
    } catch {
      setFailed(true);
      return;
    }
    setUrl(u);
    return () => {
      try { URL.revokeObjectURL(u); } catch { /* noop */ }
    };
  }, [file]);

  const isVideo = (file.type || '').startsWith('video/');
  if (failed || !url) {
    return <div className="bg-thumb bg-thumb-fallback">{isVideo ? '视频' : '图片'}</div>;
  }
  if (isVideo) {
    return (
      <video
        className="bg-thumb"
        src={url}
        muted
        playsInline
        preload="metadata"
        onLoadedMetadata={e => {
          try { e.currentTarget.currentTime = 0.1; } catch { /* noop */ } // Chromium 出首帧
        }}
        onError={() => setFailed(true)}
      />
    );
  }
  return <img className="bg-thumb" src={url} alt={file.name} onError={() => setFailed(true)} />;
}

const ENGINE_ICONS: Record<string, typeof QianwenIcon> = {
  qianwen: QianwenIcon,
  bing: BingIcon,
  bilibili: BilibiliIcon,
};

/** 引擎槽位图标：内置 SVG 保持原色；其余直连域名 favicon（no-referrer），失败以首字母覆盖。 */
function EngineSlotIcon({ def }: { def: EngineDef }) {
  const [failed, setFailed] = useState(false);
  const Icon = BUILTIN_ENGINE_ICONS.has(def.id) ? ENGINE_ICONS[def.id] : undefined;
  if (Icon) return <Icon />;
  const src = faviconUrl(def);
  if (!src) {
    return <span className="engine-letter" aria-hidden="true">{def.name.slice(0, 1)}</span>;
  }
  return (
    <span className="engine-favicon-wrap">
      <img
        className="engine-favicon"
        src={src}
        alt={def.name}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        style={failed ? { display: 'none' } : undefined}
      />
      {failed && <span className="engine-letter" aria-hidden="true">{def.name.slice(0, 1)}</span>}
    </span>
  );
}

/** /settings：背景（管理 + 循环档位）+ 搜索引擎（槽位替换）+ 通用（重置）。 */
export default function SettingsPage({
  bgState,
  addBackgroundFiles,
  setCurrentBackground,
  removeBackground,
  cycleMode,
  onCycleModeChange,
}: SettingsPageProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 引擎槽位（本页自治：localStorage 读写；首页 SearchCard 挂载时读取）
  const [engineSlots, setEngineSlots] = useState(loadEngineSlots);
  const [defaultSlot] = useState(() => loadDefaultEngineSlot(engineSlots));

  function replaceSlot(i: number, id: string) {
    const preset = ENGINE_PRESETS.find(p => p.id === id);
    if (!preset) return;
    setEngineSlots(prev => {
      const next = prev.map((s, idx) => (idx === i ? preset : s));
      saveEngineSlots(next);
      return next;
    });
  }

  const handleReset = () => {
    if (!confirm('确定清除所有搜索历史和背景吗？快捷链接与默认引擎会保留。')) return;
    try { localStorage.removeItem(HISTORY_KEY); } catch { /* noop */ }
    void clearBgStore().then(() => location.reload());
  };

  return (
    <div id="settings-page" className="settings-page">
      <div className="settings-panel">
        <div className="settings-header">
          <a
            id="settings-back"
            href="/"
            onClick={e => {
              if (!isPlainLeftClick(e)) return;
              e.preventDefault();
              navigateTo('/');
            }}
          >
            ← 返回
          </a>
          <h2>设置</h2>
        </div>

        <section className="settings-section">
          <h3>背景</h3>
          <button type="button" id="add-bg-btn" onClick={() => fileInputRef.current?.click()}>
            添加背景
          </button>
          <input
            ref={fileInputRef}
            id="bg-file-input"
            type="file"
            hidden
            multiple
            accept="image/*,video/*"
            onChange={e => {
              const fs = e.target.files;
              if (fs && fs.length) void addBackgroundFiles(fs);
              e.target.value = ''; // 允许重复选择同一文件
            }}
          />
          {bgState.loaded && bgState.order.length === 0 && <p className="bg-empty">暂无背景</p>}
          <div className="bg-grid">
            {bgState.order.map(hash => {
              const file = bgState.files.get(hash);
              if (!file) return null;
              const isCurrent = bgState.currentHash === hash;
              return (
                <div
                  key={hash}
                  className={`bg-item${isCurrent ? ' current' : ''}`}
                  data-hash={hash}
                  title={file.name}
                >
                  <BgThumb file={file} />
                  <div className="bg-item-actions">
                    <button
                      type="button"
                      className="bg-item-btn bg-apply"
                      disabled={isCurrent}
                      onClick={() => setCurrentBackground(hash)}
                    >
                      {isCurrent ? '当前' : '设为当前'}
                    </button>
                    <button
                      type="button"
                      className="bg-item-btn bg-delete"
                      aria-label={`删除 ${file.name}`}
                      onClick={() => removeBackground(hash)}
                    >
                      删除
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="setting-row setting-slider-row cycle-row">
            <span className="setting-label">循环播放周期</span>
            <input
              type="range"
              id="cycle-mode"
              className="setting-slider"
              min={0}
              max={CYCLE_MODES.length - 1}
              step={1}
              value={CYCLE_MODES.indexOf(cycleMode)}
              onChange={e => onCycleModeChange(CYCLE_MODES[Number(e.target.value)] ?? 'off')}
              aria-label="循环播放周期"
            />
            <div className="slider-ticks" aria-hidden="true">
              <span>6s</span>
              <span>30s</span>
              <span>不循环</span>
            </div>
          </div>
          <p className="setting-hint">视频总是等待播放完再切换；「不循环」下视频重复播放</p>
        </section>

        <section className="settings-section">
          <h3>搜索引擎</h3>
          <div className="engine-slots">
            {engineSlots.map((def, i) => (
              <div className="engine-slot" key={i} data-slot={i}>
                <span className="engine-slot-icon"><EngineSlotIcon def={def} /></span>
                <span className="engine-slot-name">{def.name}</span>
                {i === defaultSlot && <span className="engine-slot-badge">默认</span>}
                <select
                  className="engine-select"
                  aria-label={`替换第 ${i + 1} 个搜索引擎`}
                  value={def.id}
                  onChange={e => replaceSlot(i, e.target.value)}
                >
                  {ENGINE_PRESETS.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </section>

        <section className="settings-section">
          <h3>通用</h3>
          <button type="button" className="setting-reset" id="setting-reset" onClick={handleReset}>
            重置
          </button>
        </section>
      </div>
    </div>
  );
}
