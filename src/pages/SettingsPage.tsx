import { useEffect, useRef, useState } from 'react';
import type { BgStoreState } from '../hooks/useBackgroundStore';
import { navigateTo } from '../hooks/useRoute';
import { clearBgStore } from '../lib/db';
import {
  HISTORY_KEY,
  MAX_CYCLE_INTERVAL,
  MIN_CYCLE_INTERVAL,
} from '../lib/constants';

interface SettingsPageProps {
  /** 背景域 state（非 ref）：store 变更驱动网格重渲染。 */
  bgState: BgStoreState;
  addBackgroundFiles: (files: FileList | File[]) => Promise<void>;
  setCurrentBackground: (hash: string) => void;
  removeBackground: (hash: string) => void;
  /* 背景循环设置：受控，源在 App（localStorage 持久化 + useBgCycle 实时生效）。 */
  cycleEnabled: boolean;
  cycleIsolated: boolean;
  cycleIntervalSec: number;
  onCycleEnabledChange: (v: boolean) => void;
  onCycleIsolatedChange: (v: boolean) => void;
  onCycleIntervalChange: (sec: number) => void;
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

/** /settings：背景管理（添加/设为当前/删除）+ 背景循环设置 + 重置。 */
export default function SettingsPage({
  bgState,
  addBackgroundFiles,
  setCurrentBackground,
  removeBackground,
  cycleEnabled,
  cycleIsolated,
  cycleIntervalSec,
  onCycleEnabledChange,
  onCycleIsolatedChange,
  onCycleIntervalChange,
}: SettingsPageProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

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
          <h3>背景管理</h3>
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
        </section>

        <section className="settings-section">
          <h3>背景循环</h3>
          <div className="settings-list">
            <div className="setting-row">
              <span className="setting-label">循环播放</span>
              <button
                type="button"
                className="toggle"
                role="switch"
                aria-checked={cycleEnabled}
                aria-label="循环播放"
                data-setting="cycle"
                onClick={() => onCycleEnabledChange(!cycleEnabled)}
              >
                <span className="toggle-knob" />
              </button>
            </div>
            <div className="setting-row">
              <span className="setting-label">循环类型隔离</span>
              <button
                type="button"
                className="toggle"
                role="switch"
                aria-checked={cycleIsolated}
                aria-label="循环类型隔离"
                data-setting="cycleTypeIsolated"
                onClick={() => onCycleIsolatedChange(!cycleIsolated)}
              >
                <span className="toggle-knob" />
              </button>
            </div>
            <div className="setting-row setting-slider-row">
              <span className="setting-label">
                <span>切换周期</span>
                <span className="setting-value"><span>{cycleIntervalSec}s</span></span>
              </span>
              <input
                type="range"
                id="cycle-interval"
                className="setting-slider"
                min={MIN_CYCLE_INTERVAL}
                max={MAX_CYCLE_INTERVAL}
                step={1}
                value={String(cycleIntervalSec)}
                onChange={e => onCycleIntervalChange(parseInt(e.target.value, 10))}
                aria-label="切换周期"
              />
            </div>
            <button type="button" className="setting-reset" id="setting-reset" onClick={handleReset}>
              重置
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
