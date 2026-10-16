import { useEffect, useRef, useState } from 'react';
import type { BgStoreState } from '../hooks/useBackgroundStore';
import { navigateTo } from '../hooks/useRoute';
import { clearBgStore } from '../lib/db';
import {
  CYCLE_MODES,
  DB_NAME,
  ENGINE_SLOTS,
  type CycleMode,
  type EngineSlotEntry,
} from '../lib/constants';
import { loadSlotEntries, saveSlotEntries } from '../lib/engines';
import { ENGINE_ICON_MAP } from '../components/icons';

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

const ENGINE_ICONS = ENGINE_ICON_MAP;

/** 引擎槽位图标：预设用内置 SVG；自定义用首字母徽章。 */
function EngineSlotIcon({ entry }: { entry: EngineSlotEntry }) {
  const Icon = entry.id ? ENGINE_ICONS[entry.id] : undefined;
  if (Icon) return <Icon />;
  return <span className="engine-letter">{entry.name.slice(0, 1)}</span>;
}

/**
 * 清除站点全部数据：本地存储 + 背景库（及其他遗留 IndexedDB）+ 外壳缓存 + SW 注册。
 * - 背景库走 clear() 而非 deleteDatabase()：库连接常驻，删除请求会被 blocked 卡住。
 * - 顺序：先清缓存再注销 SW，背景库放最后 —— 压缩「清完又被内存态写回」的窗口。
 * - 缓存清空后即使用户仍被旧 SW 控页，刷新也会回落到网络，拿到全新外壳。
 */
async function wipeAllSiteData(): Promise<void> {
  try { localStorage.clear(); } catch { /* noop */ }

  try {
    if ('caches' in window) {
      for (const key of await caches.keys()) await caches.delete(key);
    }
  } catch { /* noop */ }

  try {
    if ('serviceWorker' in navigator) {
      for (const reg of await navigator.serviceWorker.getRegistrations()) await reg.unregister();
    }
  } catch { /* noop */ }

  await clearBgStore();

  // 遗留库（如旧 SW 的 sw_main_meta）一并删除；背景库已 clear，跳过
  try {
    for (const info of await indexedDB.databases()) {
      if (info.name && info.name !== DB_NAME) indexedDB.deleteDatabase(info.name);
    }
  } catch { /* noop */ }
}

/** /settings：背景（管理 + 循环档位）+ 搜索引擎（槽位替换）+ 标题行「清除所有数据」。 */
export default function SettingsPage({
  bgState,
  addBackgroundFiles,
  setCurrentBackground,
  removeBackground,
  cycleMode,
  onCycleModeChange,
}: SettingsPageProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 引擎槽位（本页自治：localStorage 读写；首页 SearchCard 挂载时读盘）
  const [slots, setSlots] = useState<EngineSlotEntry[]>(loadSlotEntries);

  function selectPreset(i: number, entry: EngineSlotEntry) {
    setSlots(prev => {
      const next = prev.map((s, idx) => (idx === i ? entry : s));
      saveSlotEntries(next);
      return next;
    });
  }

  function setCustom(i: number, name: string, urlTemplate: string, home: string) {
    const entry: EngineSlotEntry = { id: '', name, urlTemplate, home };
    setSlots(prev => {
      const next = prev.map((s, idx) => (idx === i ? entry : s));
      saveSlotEntries(next);
      return next;
    });
  }

  const handleReset = () => {
    if (!confirm(
      '确定清除所有数据吗？\n\n'
      + '将删除：搜索历史、快捷链接、引擎设置、循环设置、全部背景，'
      + '以及离线缓存与 Service Worker 注册。\n\n'
      + '此操作不可恢复。',
    )) return;
    void wipeAllSiteData().then(() => location.reload());
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
          <button type="button" className="setting-reset" id="setting-reset" onClick={handleReset}>
            清除所有数据
          </button>
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
            {ENGINE_SLOTS.map((slotDef, i) => {
              const entry = slots[i];
              const isCustom = !entry.id;
              const def = entry;
              return (
                <div className="engine-slot" key={i} data-slot={i}>
                  <span className="engine-slot-icon"><EngineSlotIcon entry={entry} /></span>
                  <span className="engine-slot-name">{def.name}</span>
                  {i === 0 && <span className="engine-slot-badge">默认</span>}
                  <select
                    className="engine-select"
                    aria-label={`替换第 ${i + 1} 个搜索引擎`}
                    value={isCustom ? '__custom__' : def.id}
                    onChange={e => {
                      const v = e.target.value;
                      if (v === '__custom__') {
                        const name = prompt('搜索引擎名称');
                        if (!name || !name.trim()) return;
                        const urlTemplate = prompt('搜索 URL（{q} 为关键词占位）', 'https://example.com/search?q={q}');
                        if (!urlTemplate || !urlTemplate.trim()) return;
                        const home = prompt('首页 URL', urlTemplate.replace(/{q}/, ''));
                        if (!home || !home.trim()) return;
                        setCustom(i, name.trim(), urlTemplate.trim(), home.trim());
                      } else {
                        const preset = slotDef.presets.find(p => p.id === v);
                        if (!preset) return;
                        selectPreset(i, { id: preset.id, name: preset.name, urlTemplate: preset.urlTemplate, home: preset.home });
                      }
                    }}
                  >
                    {slotDef.presets.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                    <option value="__custom__">{isCustom ? `${def.name}（自定义）` : '自定义...'}</option>
                  </select>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
