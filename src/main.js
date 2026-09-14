import { createCharacterCard } from './CharacterCard.js';
import { createInventoryList } from './InventoryList.js';
import { createShopEnemyPanel } from './ShopEnemyPanel.js';
import { createBottomPanel } from './Bottompanel.js';
import { pickAndImportFiles, upsertRecord, saveRecord, isFileSystemAccessSupported } from './dataStore.js';
import { initGoogleSignIn, getCurrentUser, signOut } from './auth.js';
import { showModal } from './modal.js';

// --- Validation ---
// Catches malformed/invalid files at import with a dismissible popup instead
// of a silent failure or crash, per the spec. Kept intentionally light —
// this isn't a full schema check, just the fields the app actually depends on.
function validateCharacter(character) {
  const errors = [];
  if (!character || typeof character !== 'object') errors.push('file is not a valid JSON object');
  else {
    if (!character.name) errors.push('missing "name"');
    if (character.dice && typeof character.dice !== 'object') errors.push('"dice" must be an object');
    if (character.inventory && !Array.isArray(character.inventory)) errors.push('"inventory" must be an array');
  }
  return errors;
}

function validateShop(shop) {
  const errors = [];
  if (!shop || typeof shop !== 'object') errors.push('file is not a valid JSON object');
  else {
    if (!shop.name) errors.push('missing "name"');
    if (shop.inventory && !Array.isArray(shop.inventory)) errors.push('"inventory" must be an array');
  }
  return errors;
}

function validateEnemy(enemy) {
  const errors = [];
  if (!enemy || typeof enemy !== 'object') errors.push('file is not a valid JSON object');
  else {
    if (!enemy.name) errors.push('missing "name"');
    if (!enemy.tier) errors.push('missing "tier"');
    if (enemy.dice && typeof enemy.dice !== 'object') errors.push('"dice" must be an object');
  }
  return errors;
}

// --- Module-level state ---
// A single running session's worth of imported data. Records (not raw data)
// so characters/shops/enemies can be saved back to their source file and
// re-imports of the same file can be detected via `id`.
const characterEntries = []; // [{ character, cardInventoryEl, cardPurseEl, cardEl, record }]
const shopRecords = [];
const enemyRecords = [];

let container = null;
let bottomPanel = null;
let shopEnemyPanel = null;

function notifyCharacterChanged(character) {
  if (bottomPanel) bottomPanel.refreshIfSelected(character);
}

function reportImportErrors(records, typeLabel) {
  const errors = records.filter((r) => r.error);
  if (errors.length) {
    showModal(
      `${errors.length} ${typeLabel} file(s) skipped`,
      errors.map((r) => r.error).join('\n')
    );
  }
  const warnings = records.filter((r) => r.saveWarning);
  warnings.forEach((r) => showModal('Heads up', r.saveWarning));
  return records.filter((r) => !r.error);
}

// --- Characters ---

function mountCharacterCard(record) {
  if (!record.data.inventory) record.data.inventory = [];

  const inventoryEl = createInventoryList(record.data.inventory, (updatedItems) => {
    record.data.inventory = updatedItems;
    notifyCharacterChanged(record.data);
  });

  const card = createCharacterCard(
    record.data,
    inventoryEl,
    (updatedCharacter) => notifyCharacterChanged(updatedCharacter),
    () => handleSaveCharacter(record)
  );

  return { card, inventoryEl };
}

function addCharacterRecord(record) {
  const { card, inventoryEl } = mountCharacterCard(record);
  container.appendChild(card);
  characterEntries.push({
    character: record.data,
    cardInventoryEl: inventoryEl,
    cardPurseEl: card.purseEl,
    cardEl: card,
    record
  });
  if (bottomPanel) bottomPanel.refreshOptions();
}

function replaceCharacterCard(record) {
  const entryIndex = characterEntries.findIndex((e) => e.record === record);
  if (entryIndex === -1) return;

  const oldEntry = characterEntries[entryIndex];
  const { card, inventoryEl } = mountCharacterCard(record);
  container.replaceChild(card, oldEntry.cardEl);

  characterEntries[entryIndex] = {
    character: record.data,
    cardInventoryEl: inventoryEl,
    cardPurseEl: card.purseEl,
    cardEl: card,
    record
  };

  if (bottomPanel) bottomPanel.refreshIfSelected(record.data);
}

function stampSaveAuthorship(record) {
  const user = getCurrentUser();
  if (user) {
    record.data.lastSavedBy = user.email;
  }
}

async function handleSaveCharacter(record) {
  if (!getCurrentUser()) {
    showModal('Not Signed In', "You're not signed in as a DM. Saving anyway, but sign in so changes can be attributed to you.");
  }
  stampSaveAuthorship(record);

  const result = await saveRecord(record);

  if (result.downloaded) {
    showModal(
      'Saved (Download)',
      `${record.data.name} was downloaded — your browser doesn't support saving directly back to the original file, so replace it manually.`
    );
    return;
  }

  if (!result.ok) {
    showModal(
      'Save Failed',
      `Couldn't save ${record.data.name}: ${result.error}. Reverted to the last successfully saved version — please redo any changes made since then.`
    );
    // The record's data was rolled back in place; rebuild the card from it
    // so the DM sees the reverted state rather than a stale display.
    replaceCharacterCard(record);
  }
}

async function handleImportCharacters() {
  let records;
  try {
    records = await pickAndImportFiles(validateCharacter);
  } catch (err) {
    showModal('Import Failed', err.message || String(err));
    return;
  }
  if (!records.length) return;

  const validRecords = reportImportErrors(records, 'character');

  validRecords.forEach((record) => {
    const { isNew, index } = upsertRecord(
      characterEntries.map((e) => e.record),
      record
    );
    if (isNew) {
      addCharacterRecord(record);
    } else {
      // Same character re-imported (matched by id) — rebuild its card from
      // the freshly-imported data instead of adding a duplicate.
      characterEntries[index].record = record;
      replaceCharacterCard(record);
    }
  });
}

// --- Shops & Enemies ---

async function handleImportShops() {
  let records;
  try {
    records = await pickAndImportFiles(validateShop);
  } catch (err) {
    showModal('Import Failed', err.message || String(err));
    return;
  }
  if (!records.length) return;

  const validRecords = reportImportErrors(records, 'shop');
  validRecords.forEach((record) => upsertRecord(shopRecords, record));

  if (shopEnemyPanel) shopEnemyPanel.refreshOptions();
  if (bottomPanel) bottomPanel.refreshOptions();
}

async function handleImportEnemies() {
  let records;
  try {
    records = await pickAndImportFiles(validateEnemy);
  } catch (err) {
    showModal('Import Failed', err.message || String(err));
    return;
  }
  if (!records.length) return;

  const validRecords = reportImportErrors(records, 'enemy');
  validRecords.forEach((record) => upsertRecord(enemyRecords, record));

  if (shopEnemyPanel) shopEnemyPanel.refreshOptions();
}

// --- DM auth (identity only — see auth.js) ---

function renderDmStatus(user) {
  const statusEl = document.getElementById('dm-status');
  const btnContainer = document.getElementById('google-signin-btn');
  if (!statusEl || !btnContainer) return;

  if (user) {
    btnContainer.style.display = 'none';
    statusEl.innerHTML = `
      <img src="${user.picture}" class="dm-avatar" alt="" />
      <span>Signed in as <strong>${user.name}</strong></span>
      <button id="dm-signout-btn" class="import-btn">Sign Out</button>
    `;
    document.getElementById('dm-signout-btn').addEventListener('click', () => {
      signOut();
      renderDmStatus(null);
      btnContainer.style.display = '';
    });
  } else {
    statusEl.innerHTML = '';
  }
}

// --- Init ---

function init() {
  container = document.getElementById('app');
  const shopEnemyContainer = document.getElementById('shop-enemy-app');
  const bottomPanelContainer = document.getElementById('bottom-panel-app');

  const importCharactersBtn = document.getElementById('import-characters-btn');
  if (importCharactersBtn) {
    importCharactersBtn.addEventListener('click', handleImportCharacters);
  }

  initGoogleSignIn('google-signin-btn', renderDmStatus);

  if (!isFileSystemAccessSupported()) {
    showModal(
      'Limited Save Support',
      "This browser doesn't support the File System Access API, so Save will download a fresh copy of each file instead of writing back in place. Use Chrome or Edge for direct in-place saving."
    );
  }

  if (shopEnemyContainer) {
    shopEnemyPanel = createShopEnemyPanel(shopRecords, enemyRecords, {
      onImportShop: handleImportShops,
      onImportEnemy: handleImportEnemies
    });
    shopEnemyContainer.appendChild(shopEnemyPanel.element);
  } else {
    console.warn('No #shop-enemy-app container found — skipping shop/enemy panel.');
  }

  if (bottomPanelContainer) {
    bottomPanel = createBottomPanel(characterEntries, shopRecords);
    bottomPanelContainer.appendChild(bottomPanel.element);
  } else {
    console.warn('No #bottom-panel-app container found — skipping bottom panel.');
  }
}

init();
