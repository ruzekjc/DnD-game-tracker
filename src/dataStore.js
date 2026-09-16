// src/dataStore.js

/**
 * The data layer: importing .json files, assigning unique IDs so re-imports
 * of the same file are recognized instead of creating duplicates, and
 * saving changes back to the source file with a one-generation backup/rollback.
 *
 * Real in-place saving requires the File System Access API (Chrome/Edge
 * only) since that's the only way a browser can hand back a writable file
 * handle. Elsewhere, import still works via a plain <input type="file">,
 * and "save" falls back to downloading a fresh copy of the JSON instead of
 * writing in place — the DM swaps it in manually.
 */

export function isFileSystemAccessSupported() {
  return typeof window !== 'undefined' && 'showOpenFilePicker' in window;
}

function generateId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function writeToHandle(handle, data) {
  const writable = await handle.createWritable();
  await writable.write(JSON.stringify(data, null, 2));
  await writable.close();
}

function downloadAsFile(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'data.json';
  a.click();
  URL.revokeObjectURL(url);
}

async function buildRecord(file, text, validate, handle) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (err) {
    return { error: `${file.name}: not valid JSON (${err.message})` };
  }

  const errors = validate(data);
  if (errors.length) {
    return { error: `${file.name}: ${errors.join('; ')}` };
  }

  let assignedNewId = false;
  if (!data.id) {
    data.id = generateId();
    assignedNewId = true;
  }

  const record = {
    id: data.id,
    handle, // null when using the <input type="file"> fallback
    name: file.name,
    data,
    backup: JSON.parse(JSON.stringify(data))
  };

  // Persist a freshly-assigned ID back to the source file right away, so a
  // future re-import of this same file is recognized even if the handle
  // itself isn't remembered across sessions.
  if (assignedNewId && handle) {
    try {
      await writeToHandle(handle, data);
      record.backup = JSON.parse(JSON.stringify(data));
    } catch (err) {
      record.saveWarning = `Assigned a new ID but couldn't write it back to ${file.name} yet — it'll save next time you hit Save.`;
    }
  }

  return record;
}

async function pickWithFileSystemAccess(validate) {
  let handles;
  try {
    handles = await window.showOpenFilePicker({
      multiple: true,
      types: [{ description: 'JSON files', accept: { 'application/json': ['.json'] } }]
    });
  } catch (err) {
    if (err.name === 'AbortError') return []; // user cancelled the picker
    throw err;
  }

  const records = [];
  for (const handle of handles) {
    const file = await handle.getFile();
    records.push(await buildRecord(file, await file.text(), validate, handle));
  }
  return records;
}

function pickWithFileInput(validate) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.multiple = true;
    input.addEventListener('change', async () => {
      const files = Array.from(input.files || []);
      const records = [];
      for (const file of files) {
        records.push(await buildRecord(file, await file.text(), validate, null));
      }
      resolve(records);
    });
    input.click();
  });
}

/**
 * Re-reads a previously-remembered handle (see sessionStore.js) — requests
 * permission again (required after a reload, browsers don't persist write
 * access across sessions) and rebuilds a record from its current content.
 */
export async function requestPermissionAndRead(handle, validate) {
  let permission;
  try {
    permission = await handle.requestPermission({ mode: 'readwrite' });
  } catch (err) {
    return { error: `${handle.name}: ${err.message || err}` };
  }
  if (permission !== 'granted') {
    return { error: `${handle.name}: permission not granted` };
  }

  const file = await handle.getFile();
  return buildRecord(file, await file.text(), validate, handle);
}

/**
 * Opens a file picker (native or fallback), reads + validates every picked
 * file, and returns an array of records — or { error } entries for files
 * that failed to parse/validate, so the caller can show those separately.
 *
 * @param {Function} validate - (data) => string[] of error messages (empty = valid)
 */
export function pickAndImportFiles(validate) {
  return isFileSystemAccessSupported()
    ? pickWithFileSystemAccess(validate)
    : pickWithFileInput(validate);
}

/**
 * Merges a newly-imported record into an existing records array, keyed by
 * the file's `id` — this is the re-import detection: the same character
 * re-imported (same id) replaces its old record in place rather than
 * appearing as a duplicate card.
 */
export function upsertRecord(records, newRecord) {
  const existingIndex = records.findIndex((r) => r.id === newRecord.id);
  if (existingIndex === -1) {
    records.push(newRecord);
    return { isNew: true, index: records.length - 1 };
  }
  records[existingIndex] = newRecord;
  return { isNew: false, index: existingIndex };
}

/**
 * Rolls a record's live data back to its last-known-good backup, in place —
 * mutating nested arrays/objects by content rather than replacing them, so
 * any UI still holding a reference to e.g. character.inventory keeps working
 * off the same array after a rollback.
 */
function rollback(record) {
  const live = record.data;
  const backup = record.backup;

  Object.keys(live).forEach((key) => {
    const liveVal = live[key];
    const backupVal = backup[key];

    if (Array.isArray(liveVal) && Array.isArray(backupVal)) {
      liveVal.length = 0;
      liveVal.push(...JSON.parse(JSON.stringify(backupVal)));
    } else if (
      liveVal && typeof liveVal === 'object' &&
      backupVal && typeof backupVal === 'object'
    ) {
      Object.keys(liveVal).forEach((k) => delete liveVal[k]);
      Object.assign(liveVal, JSON.parse(JSON.stringify(backupVal)));
    } else {
      live[key] = backupVal;
    }
  });
}

/**
 * Saves a record's current data back to its source file. On success, the
 * backup advances to this new state (the new rollback point). On failure,
 * the live data is rolled back to the last successful save and the caller
 * should tell the DM to redo anything since then, per the spec's save-safety
 * rule. When there's no writable handle (fallback browsers), this instead
 * downloads a fresh copy of the JSON.
 */
export async function saveRecord(record) {
  if (!record.handle) {
    downloadAsFile(record.name, record.data);
    return { ok: true, downloaded: true };
  }

  try {
    await writeToHandle(record.handle, record.data);
    record.backup = JSON.parse(JSON.stringify(record.data));
    return { ok: true };
  } catch (err) {
    rollback(record);
    return { ok: false, error: err.message || String(err) };
  }
}
