/* 背景文件哈希：FNV-1a 风格，依据「文件名 | 大小 | 类型 | 最后修改时间」，base32 输出。 */

export function bgHash(file: File): string {
  const raw = [file.name, String(file.size), file.type || '', String(file.lastModified || 0)].join('|');
  let h = 0x811c9dc5;
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(32);
}
