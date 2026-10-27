import { useEffect, useId, useRef, useState } from 'react';

export interface CustomEngineValues {
  name: string;
  urlTemplate: string;
  home: string;
}

/**
 * 自定义引擎表单：替代原先连续三次的原生 prompt()。
 * 三字段一次填完，并把原流程缺失的校验补上（{q} 占位符）。
 */
export default function CustomEngineDialog({
  open,
  initial,
  onCancel,
  onSubmit,
}: {
  open: boolean;
  /** 打开瞬间的初值快照；仅在开合时读取。 */
  initial: CustomEngineValues;
  onCancel: () => void;
  onSubmit: (values: CustomEngineValues) => void;
}) {
  const titleId = useId();
  const nameRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef(onCancel);
  cancelRef.current = onCancel;

  const [name, setName] = useState('');
  const [urlTemplate, setUrlTemplate] = useState('');
  const [home, setHome] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setName(initial.name);
    setUrlTemplate(initial.urlTemplate);
    setHome(initial.home);
    setError('');
    nameRef.current?.focus();
    // 只在开合时重置；initial 取打开那一次渲染的快照
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancelRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  function handleSubmit() {
    const n = name.trim();
    const t = urlTemplate.trim();
    if (!n) return setError('请填写名称');
    if (!t) return setError('请填写搜索 URL');
    if (!t.includes('{q}')) return setError('搜索 URL 需要包含 {q} 占位符，例如 https://example.com/search?q={q}');
    // 首页留空则回退为模板去掉占位符（与旧 prompt 流程的默认值一致）
    const h = home.trim() || t.replace('{q}', '');
    onSubmit({ name: n, urlTemplate: t, home: h });
  }

  return (
    <div
      className={`modal-mask${open ? ' open' : ''}`}
      aria-hidden={!open}
      onClick={(e) => {
        if (e.target === e.currentTarget) cancelRef.current();
      }}
    >
      <form
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
      >
        <h3 className="modal-title" id={titleId}>
          自定义搜索引擎
        </h3>
        <label className="modal-field">
          <span>名称</span>
          <input
            ref={nameRef}
            id="custom-engine-name"
            className="modal-input"
            type="text"
            autoComplete="off"
            placeholder="例如：知乎"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="modal-field">
          <span>搜索 URL</span>
          <input
            id="custom-engine-url"
            className="modal-input"
            type="text"
            autoComplete="off"
            placeholder="https://example.com/search?q={q}"
            value={urlTemplate}
            onChange={(e) => setUrlTemplate(e.target.value)}
          />
        </label>
        <label className="modal-field">
          <span>首页 URL（留空则由搜索 URL 推导）</span>
          <input
            id="custom-engine-home"
            className="modal-input"
            type="text"
            autoComplete="off"
            placeholder="https://example.com/"
            value={home}
            onChange={(e) => setHome(e.target.value)}
          />
        </label>
        {error && (
          <p className="modal-error" id="custom-engine-error">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button type="button" className="modal-btn" id="custom-engine-cancel" onClick={() => cancelRef.current()}>
            取消
          </button>
          <button type="submit" className="modal-btn modal-btn-primary" id="custom-engine-confirm">
            确定
          </button>
        </div>
      </form>
    </div>
  );
}
