import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { BgLayer } from '../hooks/useBackgroundMedia';

/* ---------- 默认背景波点 ---------- */

const DEFAULT_DOT_PALETTE = ['#3ec27a', '#ff79a6', '#ff9d3d'];

interface Dot {
  x: number;
  y: number;
  mul: number;
}

// 波点排布在边长 48px 的等边三角形顶点上，越向下越小，到 2/3 vh 处消失
function computeDots(w: number, h: number): Dot[] {
  const side = 48;
  const rowHeight = side * Math.sin(Math.PI / 3);
  const endPx = (h * (200 / 3)) / 100;
  const cols = Math.ceil(w / side) + 1;
  const rows = Math.ceil(endPx / rowHeight) + 1;
  const dots: Dot[] = [];
  for (let r = 0; r < rows; r++) {
    const y = r * rowHeight;
    const yFrac = endPx > 0 ? Math.min(1, y / endPx) : 0;
    const mul = 1 - yFrac;
    const shift = (r % 2) * (side / 2);
    for (let c = 0; c < cols; c++) {
      dots.push({ x: shift + c * side, y, mul });
    }
  }
  return dots;
}

/* ---------- 单个背景媒体层 ---------- */

function BgMedia({
  layer,
  onSettled,
  videoRefCb,
}: {
  layer: BgLayer;
  onSettled: (key: string) => void;
  videoRefCb: (key: string, el: HTMLVideoElement | null) => void;
}) {
  const localRef = useRef<HTMLImageElement | HTMLVideoElement | null>(null);

  // 自包含生命周期：load/loadeddata → reveal（2s 淡入），transitionend(opacity) → settle
  useLayoutEffect(() => {
    const el = localRef.current;
    if (!el) return;
    let revealed = false;
    let settled = false;
    const reveal = () => {
      if (revealed) return;
      revealed = true;
      el.style.transition = 'opacity 2s ease';
      // 强制 reflow：让起始透明度 0 先被浏览器采纳，否则起始值与目标值合并 → 瞬切
      void el.offsetWidth;
      el.style.opacity = '1';
    };
    const settle = () => {
      if (settled) return;
      settled = true;
      onSettled(layer.key);
    };
    const onTe = (evt: Event) => {
      if ((evt as TransitionEvent).propertyName !== 'opacity') return;
      el.removeEventListener('transitionend', onTe);
      settle();
    };
    const loadEvt = layer.kind === 'video' ? 'loadeddata' : 'load';
    el.addEventListener(loadEvt, reveal);
    el.addEventListener('transitionend', onTe);
    // 缓存命中时 load 事件可能在监听器挂载前完成，双保险检查
    if (el instanceof HTMLImageElement && el.complete && el.naturalWidth > 0) reveal();
    if (el instanceof HTMLVideoElement && el.readyState >= 2) reveal();
    const t1 = setTimeout(reveal, 800); // 兜底 reveal
    const t2 = setTimeout(settle, 3500); // 兜底 cleanup（transitionend 可能不触发）
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      el.removeEventListener(loadEvt, reveal);
      el.removeEventListener('transitionend', onTe);
    };
  }, [layer.key, layer.kind, onSettled]);

  if (layer.kind === 'video') {
    return (
      <video
        ref={(el) => {
          localRef.current = el;
          videoRefCb(layer.key, el);
          return () => {
            localRef.current = null;
            videoRefCb(layer.key, null);
          };
        }}
        src={layer.src}
        autoPlay
        loop
        muted
        playsInline
        style={{ opacity: 0 }}
      />
    );
  }
  return (
    <img
      ref={(el) => {
        localRef.current = el;
        return () => {
          localRef.current = null;
        };
      }}
      src={layer.src}
      alt="background"
      style={{ opacity: 0 }}
    />
  );
}

/* ---------- 背景层容器 ---------- */

export default function BackgroundLayer({
  layers,
  isDefault,
  onSettled,
  videoRefCb,
}: {
  layers: BgLayer[];
  isDefault: boolean;
  onSettled: (key: string) => void;
  videoRefCb: (key: string, el: HTMLVideoElement | null) => void;
}) {
  const [viewport, setViewport] = useState(() => ({
    w: window.innerWidth,
    h: window.innerHeight,
  }));

  // 默认背景在窗口尺寸变化时防抖重绘（与原实现 200ms 一致）
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onResize = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        setViewport({ w: window.innerWidth, h: window.innerHeight });
      }, 200);
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      if (timer) clearTimeout(timer);
    };
  }, []);

  // 每次重绘随机选色（含 resize 重绘，与原实现一致）
  const color = useMemo(
    () => DEFAULT_DOT_PALETTE[Math.floor(Math.random() * DEFAULT_DOT_PALETTE.length)],
    [viewport.w, viewport.h],
  );
  const dots = useMemo(() => (isDefault ? computeDots(viewport.w, viewport.h) : []), [isDefault, viewport]);

  return (
    <div
      id="bg-layer"
      className={isDefault ? 'default-bg' : undefined}
      style={isDefault ? ({ background: '#333333', '--dot-color': color } as CSSProperties) : undefined}
    >
      {dots.map((d, i) => (
        <div
          key={i}
          className="default-dot"
          style={{ left: `${d.x}px`, top: `${d.y}px`, '--mul': d.mul.toFixed(3) } as CSSProperties}
        />
      ))}
      {layers.map((l) => (
        <BgMedia key={l.key} layer={l} onSettled={onSettled} videoRefCb={videoRefCb} />
      ))}
    </div>
  );
}
