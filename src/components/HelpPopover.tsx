import type { RefObject } from 'react';

export default function HelpPopover({
  rootRef,
  open,
}: {
  rootRef: RefObject<HTMLDivElement | null>;
  open: boolean;
}) {
  return (
    <div
      ref={rootRef}
      id="help-popover"
      className={`help-popover${open ? ' open' : ''}`}
      aria-hidden={!open}
    >
      <div className="help-popover-content">
        <strong>常用功能</strong>
        <ul>
          <li><b>搜索</b>：输入关键词后，再次点击当前引擎图标即可搜索；留空点击则进入该引擎首页。</li>
          <li><b>搜索历史</b>：文本框聚焦后按 <kbd>↑</kbd> / <kbd>↓</kbd> 浏览。</li>
          <li><b>快捷链接</b>：按 <kbd>+</kbd> 添加；拖到右下角图标上删除。</li>
          <li><b>背景</b>：快速连续点按空白处 5 次选择图片或视频。</li>
          <li><b>背景历史</b>：按 <kbd>←</kbd> / <kbd>→</kbd> 浏览本地图库；按 <kbd>Enter</kbd> 设为当前项。</li>
        </ul>
      </div>
    </div>
  );
}
