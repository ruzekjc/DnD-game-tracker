import { createCharacterCard } from './CharacterCard.js';
import { createShopEnemyPanel } from './ShopEnemyPanel.js';
import { createBottomPanel } from './BottomPanel.js';
import { pickAndImportFiles, upsertRecord, saveRecord, isFileSystemAccessSupported, requestPermissionAndRead, pickSaveLocation } from './dataStore.js';
import { rememberHandle, getRememberedHandles } from './sessionStore.js';
import { initGoogleSignIn, getCurrentUser, signOut } from './auth.js';
import { normalizeExp } from './progression.js';
import { initResizablePanels } from './resizablePanels.js';
import { showNewCharacterModal } from './newCharacterModal.js';
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

function validateItemLibrary(library) {
  const errors = [];
  if (!library || typeof library !== 'object') errors.push('file is not a valid JSON object');
  else if (!Array.isArray(library.items)) errors.push('missing or invalid "items" array');
  return errors;
}

function validateTierTemplates(data) {
  const errors = [];
  if (!data || typeof data !== 'object') errors.push('file is not a valid JSON object');
  else if (!data.tiers || typeof data.tiers !== 'object') errors.push('missing "tiers" object');
  return errors;
}

// --- Module-level state ---
// A single running session's worth of imported data. Records (not raw data)
// so characters/shops/enemies can be saved back to their source file and
// re-imports of the same file can be detected via `id`.
const characterEntries = []; // [{ character, cardPurseEl, cardEl, record }]
const shopRecords = [];
const enemyRecords = [];
const libraryRecords = []; // [{ data: { name, items: [{ item, priceInCopper, description }] } }]
const tierTemplateRecords = []; // [{ data: { name, tiers: { basic: { dice, mods }, enforcer: { dice, mods } } } }]

let charDisplay = null; // holds exactly one character card at a time
let bottomPanel = null;
let shopEnemyPanel = null;
let selectedCharacterIndex = -1;

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
// Only ONE character card is ever in the DOM at a time — the panel is a
// single-character viewer (with all their mods visible at once for rolling),
// not a grid. Every card is still built and cached in characterEntries so
// switching characters is instant and doesn't lose in-progress edits.

function mountCharacterCard(record) {
  if (!record.data.inventory) record.data.inventory = [];
  if (!record.data.coinPouch) record.data.coinPouch = { platinum: 0, gold: 0, silver: 0, copper: 0 };
  if (!record.data.level) record.data.level = 1;
  normalizeExp(record.data);

  const card = createCharacterCard(
    record.data,
    (updatedCharacter) => notifyCharacterChanged(updatedCharacter),
    () => handleSaveCharacter(record)
  );

  return { card };
}

function populateCharNav() {
  const select = document.getElementById('char-select');
  if (!select) return;
  select.innerHTML = characterEntries.length
    ? characterEntries.map((e, i) => `<option value="${i}">${e.character.name}</option>`).join('')
    : `<option value="">No characters imported</option>`;
  select.value = selectedCharacterIndex >= 0 ? String(selectedCharacterIndex) : '';
}

function renderCurrentCharacter() {
  if (!charDisplay) return;
  charDisplay.innerHTML = '';

  const entry = characterEntries[selectedCharacterIndex];
  if (!entry) {
    charDisplay.innerHTML = '<p class="bp-empty">Import a character to get started.</p>';
    return;
  }

  charDisplay.appendChild(entry.cardEl);
  populateCharNav();
  if (bottomPanel) bottomPanel.selectCharacter(entry.character);
}

function goToCharacter(index) {
  if (!characterEntries.length) return;
  const wrapped = ((index % characterEntries.length) + characterEntries.length) % characterEntries.length;
  selectedCharacterIndex = wrapped;
  renderCurrentCharacter();
}

function addCharacterRecord(record) {
  const { card } = mountCharacterCard(record);
  characterEntries.push({
    character: record.data,
    cardPurseEl: card.purseEl,
    cardEl: card,
    record
  });

  if (selectedCharacterIndex === -1) selectedCharacterIndex = 0;
  populateCharNav();
  if (characterEntries.length === 1) renderCurrentCharacter();
  if (bottomPanel) bottomPanel.refreshOptions();
}

function replaceCharacterCard(record) {
  const entryIndex = characterEntries.findIndex((e) => e.record === record);
  if (entryIndex === -1) return;

  const { card } = mountCharacterCard(record);
  characterEntries[entryIndex] = {
    character: record.data,
    cardPurseEl: card.purseEl,
    cardEl: card,
    record
  };

  populateCharNav();
  if (entryIndex === selectedCharacterIndex) renderCurrentCharacter();
  if (bottomPanel) bottomPanel.refreshIfSelected(record.data);
}

// EXP tab (in BottomPanel) mutates level/exp/skillPoints/skills directly on
// the character object — those fields are baked into the card's markup at
// creation, so the simplest correct fix is rebuilding the card from current
// data, same as the save-rollback and re-import paths already do.
function handleCharacterProgressionChanged(character) {
  const entry = characterEntries.find((e) => e.character === character);
  if (entry) replaceCharacterCard(entry.record);
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
      rememberHandle('character', record);
    } else {
      // Same character re-imported (matched by id) — rebuild its card from
      // the freshly-imported data instead of adding a duplicate.
      characterEntries[index].record = record;
      replaceCharacterCard(record);
    }
  });
}

function handleCreateCharacter() {
  showNewCharacterModal(async (characterData) => {
    characterData.id = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;

    const suggestedName = `${characterData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`;

    let handle = null;
    try {
      handle = await pickSaveLocation(suggestedName);
    } catch (err) {
      showModal('Save Picker Failed', err.message || String(err));
      // Continue anyway — the character still gets created in-memory, and
      // Save later falls back to a download, same as everywhere else.
    }

    const record = {
      id: characterData.id,
      handle,
      name: handle ? handle.name : suggestedName,
      data: characterData,
      backup: JSON.parse(JSON.stringify(characterData))
    };

    const result = await saveRecord(record);
    if (!result.ok) {
      showModal('Save Failed', `Couldn't save the new character: ${result.error}`);
    } else if (result.downloaded) {
      showModal(
        'Character Created (Download)',
        `${characterData.name} was downloaded as ${record.name} — your browser doesn't support saving directly to a chosen location, so move that file wherever you keep your character files.`
      );
    }

    addCharacterRecord(record);
    rememberHandle('character', record);

    const newIndex = characterEntries.findIndex((e) => e.record === record);
    if (newIndex !== -1) goToCharacter(newIndex);
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
  validRecords.forEach((record) => {
    const { isNew } = upsertRecord(shopRecords, record);
    if (isNew) rememberHandle('shop', record);
  });

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
  validRecords.forEach((record) => {
    const { isNew } = upsertRecord(enemyRecords, record);
    if (isNew) rememberHandle('enemy', record);
  });

  if (shopEnemyPanel) shopEnemyPanel.refreshOptions();
}

// --- Item Library ---
// A master catalog of items (name + base price + description) shops can
// pull from instead of the DM typing every item out by hand each time.

function getLibraryItems() {
  return libraryRecords.flatMap((r) => r.data.items || []);
}

async function handleImportLibrary() {
  let records;
  try {
    records = await pickAndImportFiles(validateItemLibrary);
  } catch (err) {
    showModal('Import Failed', err.message || String(err));
    return;
  }
  if (!records.length) return;

  const validRecords = reportImportErrors(records, 'item library');
  validRecords.forEach((record) => {
    const { isNew } = upsertRecord(libraryRecords, record);
    if (isNew) rememberHandle('library', record);
  });

  if (shopEnemyPanel) shopEnemyPanel.refreshOptions();
}

// --- Enemy Tier Templates ---
// Shared "flat stat sheet" for Basic/Enforcer enemies, per the spec — an
// enemy of that tier can omit its own dice/mods entirely and inherit these
// instead (see Enemy.js). Bosses never use templates.

function getTierTemplate(tier) {
  for (const record of tierTemplateRecords) {
    const tiers = record.data.tiers || {};
    if (tiers[tier]) return tiers[tier];
  }
  return null;
}

async function handleImportTierTemplates() {
  let records;
  try {
    records = await pickAndImportFiles(validateTierTemplates);
  } catch (err) {
    showModal('Import Failed', err.message || String(err));
    return;
  }
  if (!records.length) return;

  const validRecords = reportImportErrors(records, 'tier template');
  validRecords.forEach((record) => {
    const { isNew } = upsertRecord(tierTemplateRecords, record);
    if (isNew) rememberHandle('tierTemplate', record);
  });

  if (shopEnemyPanel) shopEnemyPanel.refreshOptions();
}

// --- Reconnect previous session ---

async function reconnectGroup(entries, validate, onLoaded) {
  for (const entry of entries) {
    const result = await requestPermissionAndRead(entry.handle, validate);
    if (result.error) {
      showModal('Reconnect Failed', result.error);
      continue;
    }
    onLoaded(result);
  }
}

async function handleReconnect(charEntries, shopEntries, enemyEntries, libraryEntries, tierTemplateEntries) {
  await reconnectGroup(charEntries, validateCharacter, (record) => {
    const { isNew, index } = upsertRecord(
      characterEntries.map((e) => e.record),
      record
    );
    if (isNew) addCharacterRecord(record);
    else {
      characterEntries[index].record = record;
      replaceCharacterCard(record);
    }
  });

  await reconnectGroup(shopEntries, validateShop, (record) => upsertRecord(shopRecords, record));
  await reconnectGroup(enemyEntries, validateEnemy, (record) => upsertRecord(enemyRecords, record));
  await reconnectGroup(libraryEntries, validateItemLibrary, (record) => upsertRecord(libraryRecords, record));
  await reconnectGroup(tierTemplateEntries, validateTierTemplates, (record) => upsertRecord(tierTemplateRecords, record));

  if (shopEnemyPanel) shopEnemyPanel.refreshOptions();
  if (bottomPanel) bottomPanel.refreshOptions();

  const banner = document.getElementById('reconnect-banner');
  if (banner) banner.style.display = 'none';
}

async function checkForRememberedSession() {
  const [chars, shops, enemies, library, tierTemplates] = await Promise.all([
    getRememberedHandles('character'),
    getRememberedHandles('shop'),
    getRememberedHandles('enemy'),
    getRememberedHandles('library'),
    getRememberedHandles('tierTemplate')
  ]);
  const total = chars.length + shops.length + enemies.length + library.length + tierTemplates.length;
  if (!total) return;

  const banner = document.getElementById('reconnect-banner');
  if (!banner) return;

  banner.style.display = 'flex';
  banner.querySelector('.reconnect-count').textContent = `${total} file(s) from last session`;
  banner.querySelector('.reconnect-btn').addEventListener(
    'click',
    () => handleReconnect(chars, shops, enemies, library, tierTemplates),
    { once: true }
  );
  banner.querySelector('.reconnect-dismiss-btn').addEventListener(
    'click',
    () => { banner.style.display = 'none'; },
    { once: true }
  );
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
  charDisplay = document.getElementById('char-display');
  const shopEnemyContainer = document.getElementById('shop-enemy-app');
  const bottomPanelContainer = document.getElementById('bottom-panel-app');

  initResizablePanels();

  const importCharactersBtn = document.getElementById('import-characters-btn');
  if (importCharactersBtn) {
    importCharactersBtn.addEventListener('click', handleImportCharacters);
  }

  const newCharacterBtn = document.getElementById('new-character-btn');
  if (newCharacterBtn) {
    newCharacterBtn.addEventListener('click', handleCreateCharacter);
  }

  const charSelect = document.getElementById('char-select');
  const charPrevBtn = document.getElementById('char-prev-btn');
  const charNextBtn = document.getElementById('char-next-btn');
  if (charSelect) charSelect.addEventListener('change', () => goToCharacter(Number(charSelect.value)));
  if (charPrevBtn) charPrevBtn.addEventListener('click', () => goToCharacter(selectedCharacterIndex - 1));
  if (charNextBtn) charNextBtn.addEventListener('click', () => goToCharacter(selectedCharacterIndex + 1));

  renderCurrentCharacter();

  initGoogleSignIn('google-signin-btn', renderDmStatus);
  checkForRememberedSession();

  if (!isFileSystemAccessSupported()) {
    showModal(
      'Limited Save Support',
      "This browser doesn't support the File System Access API, so Save will download a fresh copy of each file instead of writing back in place. Use Chrome or Edge for direct in-place saving."
    );
  }

  if (shopEnemyContainer) {
    shopEnemyPanel = createShopEnemyPanel(shopRecords, enemyRecords, {
      onImportShop: handleImportShops,
      onImportEnemy: handleImportEnemies,
      getLibraryItems,
      onImportLibrary: handleImportLibrary,
      getTierTemplate,
      onImportTierTemplates: handleImportTierTemplates,
      onShopChanged: () => {
        if (bottomPanel) bottomPanel.refreshOptions();
      }
    });
    shopEnemyContainer.appendChild(shopEnemyPanel.element);
  } else {
    console.warn('No #shop-enemy-app container found — skipping shop/enemy panel.');
  }

  if (bottomPanelContainer) {
    bottomPanel = createBottomPanel(characterEntries, shopRecords, handleCharacterProgressionChanged);
    bottomPanelContainer.appendChild(bottomPanel.element);
  } else {
    console.warn('No #bottom-panel-app container found — skipping bottom panel.');
  }
}

init();
