/* 背景持久化：IndexedDB 库 `start` v1，单一仓库 `background`。
 * 键：hash -> { name, type, size, lastModified, buffer }，'order' -> [hash...]。
 *
 * Safari 坑点：直接存 File 再读，其底层 blob 引用会失效（WebKitBlobResource error 1），
 * 因此序列化为纯对象，读取时从 ArrayBuffer 重建 File/Blob。
 *
 * 事务纪律：IndexedDB 事务在相关读写请求之间不得 await 非 store 操作；
 * 写入前先收集全部 ArrayBuffer，再开单个 readwrite 事务同步写入。
 */

import { DB_NAME, ORDER_KEY, STORE_NAME } from './constants';

export interface BgRecord {
  name: string;
  type: string;
  size: number;
  lastModified: number;
  buffer: ArrayBuffer;
}

export interface BgStoreData {
  order: string[];
  files: Map<string, File>;
}

export function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
      // 清理历史版本可能遗留的其他仓库
      const storesToDelete = Array.from(db.objectStoreNames).filter(n => n !== STORE_NAME);
      for (const n of storesToDelete) db.deleteObjectStore(n);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function bgRecordFromFile(file: File): Promise<BgRecord> {
  const buffer = await file.arrayBuffer();
  return {
    name: file.name,
    type: file.type || '',
    size: file.size,
    lastModified: file.lastModified || 0,
    buffer
  };
}

function fileFromRecord(rec: BgRecord): File {
  const blob = new Blob([rec.buffer], { type: rec.type || 'application/octet-stream' });
  return new File([blob], rec.name || 'background', {
    type: rec.type || 'application/octet-stream',
    lastModified: rec.lastModified || Date.now()
  });
}

export async function loadBgStore(): Promise<BgStoreData> {
  try {
    const db = await openDB();
    const order = await new Promise<string[]>((res, rej) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const r = tx.objectStore(STORE_NAME).get(ORDER_KEY);
      r.onsuccess = () => res(r.result || []);
      r.onerror = () => rej(r.error);
    });
    const orderArr = Array.isArray(order) ? order : [];
    const files = new Map<string, File>();
    for (const hash of orderArr) {
      const rec = await new Promise<BgRecord | undefined>((res, rej) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const r = tx.objectStore(STORE_NAME).get(hash);
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      if (rec && rec.buffer) {
        try {
          files.set(hash, fileFromRecord(rec));
        } catch (err) {
          console.warn('背景记录解析失败:', hash, err);
        }
      }
    }
    // 顺序与文件不一致时清理孤儿 hash
    return { order: orderArr.filter(h => files.has(h)), files };
  } catch (err) {
    console.warn('背景存储加载失败:', err);
    return { order: [], files: new Map() };
  }
}

export async function persistBgStore(order: string[], files: Map<string, File>): Promise<void> {
  try {
    // 先收集全部记录（含 ArrayBuffer），再开单事务同步写入，避免事务自动提交
    const records: Array<[string, BgRecord]> = [];
    for (const [hash, file] of files) {
      try {
        records.push([hash, await bgRecordFromFile(file)]);
      } catch (err) {
        console.warn('背景读取失败，跳过持久化:', hash, err);
      }
    }

    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(order, ORDER_KEY);
    for (const [hash, rec] of records) store.put(rec, hash);

    // 同一事务内收集 keys，删除 order 里不存在的 hash
    const allKeys = await new Promise<IDBValidKey[]>((res, rej) => {
      const r = store.getAllKeys();
      r.onsuccess = () => res(r.result || []);
      r.onerror = () => rej(r.error);
    });
    for (const k of allKeys) {
      if (k === ORDER_KEY || files.has(String(k))) continue;
      store.delete(k);
    }

    await new Promise<void>((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
      tx.onabort = () => rej(tx.error);
    });
  } catch (err) {
    console.warn('背景存储同步失败:', err);
  }
}

export async function clearBgStore(): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
    await new Promise<void>(res => {
      tx.oncomplete = () => res();
      tx.onerror = () => res();
      tx.onabort = () => res();
    });
    try { db.close(); } catch { /* noop */ }
  } catch (err) {
    console.warn('重置背景数据失败:', err);
  }
}
