// src/sessionStore.js

/**
 * Remembers imported file handles across page reloads using IndexedDB
 * (FileSystemFileHandle objects are structured-cloneable in Chromium, so
 * they can be stored directly — no serialization needed).
 *
 * Entries are tagged with the signed-in DM's email at the time of import
 * (or null for "not signed in"), so reconnecting only offers back the files
 * *that* DM imported — a different Google account on the same browser (or
 * nobody signed in) won't see someone else's remembered session. This is
 * the closest thing to "ownership" this app enforces: it's a UX/organization
 * boundary, not a security one — the browser's own file-permission model is
 * what actually gates read/write access.
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
 * Remembers a record's file handle under a type ('character' | 'shop' |
 * 'enemy' | 'library' | 'tierTemplate'), tagged with the current DM's email
 * (or null if not signed in). Records without a real handle (fallback-
 * browser imports) are skipped — there's nothing to reconnect to.
 */
export async function rememberHandle(type, record, ownerEmail = null) {
  if (!record.handle) return;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put({
      key: `${type}:${record.id}`,
      type,
      id: record.id,
      name: record.name,
      handle: record.handle,
      ownerEmail
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

/**
 * Returns remembered entries, optionally filtered to one type and/or one
 * owner. Pass ownerEmail to scope to a signed-in DM (or null explicitly to
 * scope to "not signed in" entries only) — omit it entirely to get
 * everything regardless of owner, which read_conversation callers generally
 * shouldn't do once sign-in is in play.
 */
export async function getRememberedHandles(type, ownerEmail) {
  const db = await openDb();
  const scopeToOwner = arguments.length >= 2;
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
        let result = entries;
        if (type) result = result.filter((e) => e.type === type);
        if (scopeToOwner) result = result.filter((e) => (e.ownerEmail || null) === (ownerEmail || null));
        resolve(result);
      }
    };
    req.onerror = () => reject(req.error);
  });
}
