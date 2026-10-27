/**
 * 玻璃渲染模式（由库的就绪信号驱动，不做特性探测）：
 * - `webgpu`：@glass-sdk/liquid-glass 已把材质图画好，搜索框的材质层自己绘制液态玻璃；
 * - `css`：回退到原先手写的 backdrop-filter 玻璃，保证无 WebGPU 时外观不塌。
 */

export type GlassMode = 'css' | 'webgpu';

const MODE_ATTR = 'data-glass';

function setMode(mode: GlassMode): void {
  const root = document.documentElement;
  if (root.getAttribute(MODE_ATTR) !== mode) root.setAttribute(MODE_ATTR, mode);
}

/**
 * 初始一律按 CSS 玻璃渲染（首帧绝不空白），随后按库自己的就绪信号决定是否升级：
 * - 场景里的材质层（`.lg-surface`）至少有一颗，且场景根节点 `data-glass-ready="true"`
 *   —— 后者等价于「所有 surface 都已拿到材质图」，是唯一可以撤掉手写玻璃的时机；
 * - 根节点派发的 `glass:diagnostic` 带 `detail.error`：WebGPU 适配器缺失 / 滤镜图超限，
 *   永久回退 CSS 玻璃（后续成功诊断仍可再升级）。
 *
 * 一个坑：没有任何 surface 时库同样会把 `data-glass-ready` 报成 "true"（0 个 surface 全部就绪）。
 * 所以必须用「有材质层」当前置条件，否则从 /settings（无搜索框）直接进首页时，会在材质图还没
 * 生成的一瞬把搜索框的手写玻璃撤掉，留下一个看不见的空框。
 *
 * 返回清理函数（App 卸载时断开 observer 与监听）。
 */
export function initGlassMode(scene: HTMLElement | null): () => void {
  setMode('css');
  if (!scene) return () => {};

  let upgraded = false;

  const sync = () => {
    const hasSurface = scene.querySelector('.lg-surface') !== null;
    if (!hasSurface) {
      // 没有材质层就没有真玻璃可言，退回 CSS 玻璃（路由切走时搜索框会卸载）
      upgraded = false;
      setMode('css');
      return;
    }
    if (upgraded || scene.dataset.glassReady !== 'true') return;
    upgraded = true;
    setMode('webgpu');
  };

  const onDiagnostic = (event: Event) => {
    const detail = (event as CustomEvent<{ error?: string }>).detail;
    if (detail?.error) {
      upgraded = false;
      setMode('css');
      return;
    }
    sync();
  };

  const observer = new MutationObserver(sync);
  observer.observe(scene, {
    attributes: true,
    attributeFilter: ['data-glass-ready'],
    childList: true, // 搜索框挂载/卸载会增删 surface，需要跟着重新判定
    subtree: true,
  });
  scene.addEventListener('glass:diagnostic', onDiagnostic);
  sync();

  return () => {
    observer.disconnect();
    scene.removeEventListener('glass:diagnostic', onDiagnostic);
  };
}
