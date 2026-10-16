/* localStorage 设置项读写：布尔（'1'/'0'）与钳制整数。 */

export function loadBoolSetting(key: string): boolean {
  return localStorage.getItem(key) === '1';
}

export function saveBoolSetting(key: string, v: boolean): void {
  localStorage.setItem(key, v ? '1' : '0');
}

export function loadIntSetting(key: string, fallback: number, min: number, max: number): number {
  const raw = parseInt(localStorage.getItem(key)!, 10);
  return Math.max(min, Math.min(max, Number.isFinite(raw) ? raw : fallback));
}
