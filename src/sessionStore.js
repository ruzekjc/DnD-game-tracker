// src/sessionStore.js

/**
 * Remembers imported file handles across page reloads using IndexedDB
 * (FileSystemFileHandle objects are structured-cloneable in Chromium, so
 * they can be stored directly — no serialization needed).
 *
 * This does NOT bypass the browser's permission model: a remembered handle
 * still needs requestPermission() re-granted after a reload before it can
 * be read/written again. What this saves the DM is re-running the file
 * picker and re-finding the right files — not the permission prompts
 * themselves.
 */

const DB_NAME = 'dnd-tracker';
const DB_VERSION = 1;
const STORE_NAME = 'handles';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_NAME)) {
        req.result.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Remembers a record's file handle under a type ('character' | 'shop' | 'enemy').
 * Records without a real handle (fallback-browser imports) are skipped —
 * there's nothing to reconnect to.
 */
export async function rememberHandle(type, record) {
  if (!record.handle) return;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put({
      key: `${type}:${record.id}`,
      type,
      id: record.id,
      name: record.name,
      handle: record.handle
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function forgetHandle(type, id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(`${type}:${id}`);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function forgetAllHandles() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Returns remembered entries, optionally filtered to one type. */
export async function getRememberedHandles(type) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const entries = [];
    const req = tx.objectStore(STORE_NAME).openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        entries.push(cursor.value);
        cursor.continue();
      } else {
        resolve(type ? entries.filter((e) => e.type === type) : entries);
      }
    };
    req.onerror = () => reject(req.error);
  });
}
