import type { KeyValueStore } from './types';

const DB_NAME = 'restroom911';
const STORE = 'kv';
const LOCAL_PREFIX = 'rr911.kv.';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB failed to open'));
  });
}

function idbGet(key: string): Promise<unknown | null> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly');
        const request = tx.objectStore(STORE).get(key);
        request.onsuccess = () => resolve(request.result ?? null);
        request.onerror = () => reject(request.error);
        tx.oncomplete = () => db.close();
        tx.onerror = () => db.close();
      }),
  );
}

function idbSet(key: string, value: unknown): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        const request = tx.objectStore(STORE).put(value, key);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
        tx.oncomplete = () => db.close();
        tx.onerror = () => {
          db.close();
          reject(tx.error ?? new Error('IndexedDB write failed'));
        };
      }),
  );
}

function idbDelete(key: string): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        const request = tx.objectStore(STORE).delete(key);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
        tx.oncomplete = () => db.close();
        tx.onerror = () => db.close();
      }),
  );
}

function localGet(key: string): unknown | null {
  const raw = localStorage.getItem(LOCAL_PREFIX + key);
  if (raw == null) return null;
  return JSON.parse(raw) as unknown;
}

/** IndexedDB for submissions and edits, with localStorage if IndexedDB is unavailable. */
export function createBrowserStore(): KeyValueStore {
  let prefer: 'idb' | 'local' | null = null;

  async function backend(): Promise<'idb' | 'local'> {
    if (prefer) return prefer;
    try {
      await idbSet('__ping', 1);
      prefer = 'idb';
    } catch {
      prefer = 'local';
    }
    return prefer;
  }

  return {
    async get(key) {
      if ((await backend()) === 'idb') return idbGet(key);
      return localGet(key);
    },
    async set(key, value) {
      if ((await backend()) === 'idb') {
        await idbSet(key, value);
        return;
      }
      localStorage.setItem(LOCAL_PREFIX + key, JSON.stringify(value));
    },
    async delete(key) {
      if ((await backend()) === 'idb') {
        await idbDelete(key);
        return;
      }
      localStorage.removeItem(LOCAL_PREFIX + key);
    },
  };
}
