import { GlassSurface } from '@glass-sdk/liquid-glass';
import type { GlassAppearance, GlassMaterial, GlassRadius } from '@glass-sdk/liquid-glass';

/**
 * 玻璃「材质层」：绝对铺满父级、不吃指针事件，只负责让库在父级矩形内绘制液态玻璃。
 *
 * 为什么不把父级元素本身做成 surface：父级带着 hover/focus 的 transform 与扫光伪元素，
 * 拆出一个纯视觉子层后，原有 DOM 与 CSS 零改动，材质只换「谁来画」。
 *
 * 无 WebGPU 时库不给 surface 写 clip-path，库自带的
 * `.lg-surface:not([style*="clip-path"]) { visibility: hidden }` 会把它藏起来 ——
 * 父级因此完整保留原先手写的 backdrop-filter 玻璃，天然就是降级外观。
 *
 * 目前用在：`.search-card-bg`（胶囊）、三颗 `.engine-btn`（圆形）、右上角 `.settings-btn`、
 * 左上角 `.add-btn`、每颗 `.shortcut-item`（13px 连续圆角）。材质图是按矩形 + 圆角缓存的，
 * 同尺寸的引擎按钮 / 快捷链接会共用同一份，重复项不会线性增加成本。
 */
export default function GlassBackdrop({
  className,
  radius,
  material,
  appearance,
  refraction,
  tint,
  fluid,
}: {
  /** 附加类名（沿用原背景层的类名，降级时同一套 CSS 直接生效）。 */
  className?: string;
  radius: GlassRadius;
  material?: GlassMaterial;
  appearance?: GlassAppearance;
  refraction?: number;
  /** 六位十六进制色，如 `"#1a1a1e"`；不传即不着色。 */
  tint?: string;
  /** 父级布局盒变化时让玻璃轮廓弹性跟随（左上角 + 变垃圾桶胶囊靠它）。 */
  fluid?: boolean;
}) {
  return (
    <GlassSurface
      aria-hidden="true"
      className={className ? `glass-backdrop ${className}` : 'glass-backdrop'}
      radius={radius}
      material={material}
      appearance={appearance}
      refraction={refraction}
      tint={tint}
      fluid={fluid}
    />
  );
}
