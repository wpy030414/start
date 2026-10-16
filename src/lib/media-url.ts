/* 背景媒体 URL 解析：blob URL 优先（probe 验证），Safari 失败时回退 data: URL。
 * 模块级强引用 activeBgHash/activeBgType/activeBgSrc 与原单文件版一致，
 * 保证跨组件实例共享同一份「当前显示中的 src」状态。
 */

import { bgHash } from './bg-hash';

let activeBgHash: string | null = null;
let activeBgType: string | null = null;
let activeBgSrc: string | null = null;

export function getActiveBgSrc(): string | null {
  return activeBgSrc;
}

/** 清空模块级 active 状态（背景整体移除时调用；blob 的 revoke 由层栈负责）。 */
export function resetActiveBg(): void {
  activeBgHash = null;
  activeBgType = null;
  activeBgSrc = null;
}

async function fileToBlob(file: File): Promise<Blob> {
  return new Blob([await file.arrayBuffer()], { type: file.type || 'application/octet-stream' });
}

function bufferToDataUrl(buf: ArrayBuffer, type: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(new Blob([buf], { type: type || 'application/octet-stream' }));
  });
}

// 通过临时 img/video 探测 blob URL 是否可用（loadedmetadata/load 成功，2.5s 超时判否）
function probeObjectUrl(url: string, type: string): Promise<boolean> {
  return new Promise(resolve => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout>;
    const done = (ok: boolean) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(ok);
      }
    };
    if (type.startsWith('video/')) {
      const v = document.createElement('video');
      v.muted = true;
      v.preload = 'metadata';
      v.addEventListener('loadedmetadata', () => done(true));
      v.addEventListener('error', () => done(false));
      v.src = url;
      timer = setTimeout(() => done(false), 2500);
    } else {
      const img = new Image();
      img.addEventListener('load', () => done(true));
      img.addEventListener('error', () => done(false));
      img.src = url;
      timer = setTimeout(() => done(false), 2500);
    }
  });
}

export async function resolveBgSrc(file: File): Promise<string> {
  const hash = bgHash(file);
  // 复用前验证 blob URL 是否仍有效（已 revoke 则重建）；data: URL 恒有效
  if (activeBgHash === hash && activeBgSrc) {
    if (!activeBgSrc.startsWith('blob:')) return activeBgSrc;
    const ok = await probeObjectUrl(activeBgSrc, file.type || 'image/png');
    if (ok) return activeBgSrc;
  }
  activeBgHash = hash;
  activeBgType = file.type || 'image/png';

  let url = '';
  try {
    const blob = await fileToBlob(file);
    url = URL.createObjectURL(blob);
    const ok = await probeObjectUrl(url, activeBgType);
    if (ok) {
      activeBgSrc = url;
      return url;
    }
  } catch (err) {
    console.warn('object URL failed:', err);
  }
  if (url) {
    try { URL.revokeObjectURL(url); } catch { /* noop */ }
  }

  // Safari WebKitBlobResource error 1 回退：arrayBuffer + FileReader 生成 data: URL
  try {
    const buf = await file.arrayBuffer();
    const dataUrl = await bufferToDataUrl(buf, file.type);
    activeBgSrc = dataUrl;
    return dataUrl;
  } catch (err) {
    console.warn('data URL fallback failed:', err);
  }

  activeBgSrc = null;
  return '';
}
