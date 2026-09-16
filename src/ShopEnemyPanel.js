// src/ShopEnemyPanel.js

import { createShopView } from './Shop.js';
import { createEnemyView } from './Enemy.js';
import { saveRecord } from './dataStore.js';
import { getCurrentUser } from './auth.js';
import { showModal } from './modal.js';

/**
 * The "small panel": tabs between Shop and Enemy mode, an Import button
 * (imports into whichever mode is currently active), a dropdown to pick
 * which imported shop/enemy to display, and the rendered view itself.
 *
 * Works on records (see dataStore.js), not raw data, since Enemy views need
 * a save handle and both need stable IDs for re-import detection. Shop and
 * enemy records arrays are shared by reference with main.js — importing
 * pushes onto the same arrays, then calls refreshOptions() to redraw.
 *
 * @param {Array} shopRecords
 * @param {Array} enemyRecords
 * @param {Object} handlers - { onImportShop, onImportEnemy, getLibraryItems, onImportLibrary, onShopChanged, getTierTemplate, onImportTierTemplates, onNewShop }
 *   onImportShop/onImportEnemy/onImportLibrary/onImportTierTemplates are each
 *   () => Promise, called when the relevant Import action is clicked.
 *   getLibraryItems() returns the current flattened master item list for
 *   Shop's "Add from Library" search. getTierTemplate(tier) returns
 *   { dice, mods } | null for Enemy's tier-inheritance fallback.
 *   onShopChanged(shop) fires whenever a shop's inventory is edited.
 *   onNewShop is () => void, fired by "+ New" (only shown/active in Shop mode).
 */
export function createShopEnemyPanel(shopRecords, enemyRecords, handlers = {}) {
  const container = document.createElement('div');
  container.className = 'shop-enemy-panel';

  let mode = 'shop';

  container.innerHTML = `
    <div class="shop-enemy-tabs">
      <button class="tab-btn shop-tab is-active">Shop</button>
      <button class="tab-btn enemy-tab">Enemy</button>
      <button class="import-btn shop-enemy-new-btn">+ New</button>
      <button class="import-btn shop-enemy-import-btn">+ Import</button>
    </div>
    <select class="shop-enemy-select"></select>
    <div class="shop-enemy-content"></div>
  `;

  const shopTabBtn = container.querySelector('.shop-tab');
  const enemyTabBtn = container.querySelector('.enemy-tab');
  const newBtn = container.querySelector('.shop-enemy-new-btn');
  const importBtn = container.querySelector('.shop-enemy-import-btn');
  const select = container.querySelector('.shop-enemy-select');
  const content = container.querySelector('.shop-enemy-content');

  function updateNewBtnVisibility() {
    // Creating a brand-new enemy isn't supported yet (only shops/NPCs) —
    // hide the button rather than let it do nothing in Enemy mode.
    newBtn.style.display = mode === 'shop' ? '' : 'none';
  }

  function currentList() {
    return mode === 'shop' ? shopRecords : enemyRecords;
  }

  function populateSelect() {
    const list = currentList();
    select.innerHTML = list.length
      ? list.map((r, i) => `<option value="${i}">${r.data.name}</option>`).join('')
      : `<option value="">No ${mode === 'shop' ? 'shops' : 'enemies'} imported</option>`;
  }

  function renderContent() {
    content.innerHTML = '';
    const list = currentList();
    if (!list.length) return;

    const index = Number(select.value) || 0;
    const record = list[index];
    if (!record) return;

    const view =
      mode === 'shop'
        ? createShopView(record.data, {
            onChange: () => {
              if (handlers.onShopChanged) handlers.onShopChanged(record.data);
            },
            onSaveRequest: () => handleSave(record),
            getLibraryItems: handlers.getLibraryItems,
            onImportLibrary: handlers.onImportLibrary
          })
        : createEnemyView(record.data, null, () => handleSave(record), {
            getTierTemplate: handlers.getTierTemplate,
            onImportTierTemplates: handlers.onImportTierTemplates
          });
    content.appendChild(view);
  }

  async function handleSave(record) {
    const user = getCurrentUser();
    if (!user) {
      showModal('Not Signed In', "You're not signed in as a DM. Saving anyway, but sign in so changes can be attributed to you.");
    } else {
      record.data.lastSavedBy = user.email;
    }

    const result = await saveRecord(record);
    if (result.downloaded) {
      showModal(
        'Saved (Download)',
        `${record.data.name} was downloaded — your browser doesn't support saving directly back to the original file, so replace it manually.`
      );
    } else if (!result.ok) {
      showModal(
        'Save Failed',
        `Couldn't save ${record.data.name}: ${result.error}. Reverted to the last successfully saved version — please redo any changes made since then.`
      );
    }
    // Always redraw from record.data — covers both the normal case and a
    // failed-save rollback, since this panel fully rebuilds its content
    // from scratch on every render.
    renderContent();
  }

  function switchMode(newMode) {
    if (mode === newMode) return;
    mode = newMode;
    shopTabBtn.classList.toggle('is-active', mode === 'shop');
    enemyTabBtn.classList.toggle('is-active', mode === 'enemy');
    updateNewBtnVisibility();
    populateSelect();
    renderContent();
  }

  shopTabBtn.addEventListener('click', () => switchMode('shop'));
  enemyTabBtn.addEventListener('click', () => switchMode('enemy'));
  select.addEventListener('change', renderContent);

  newBtn.addEventListener('click', () => {
    if (mode === 'shop' && handlers.onNewShop) handlers.onNewShop();
  });
  updateNewBtnVisibility();

  importBtn.addEventListener('click', async () => {
    importBtn.disabled = true;
    try {
      if (mode === 'shop' && handlers.onImportShop) await handlers.onImportShop();
      if (mode === 'enemy' && handlers.onImportEnemy) await handlers.onImportEnemy();
    } finally {
      importBtn.disabled = false;
    }
  });

  populateSelect();
  renderContent();

  return {
    element: container,
    // Called by main.js after pushing new records onto shopRecords/enemyRecords.
    refreshOptions() {
      populateSelect();
      renderContent();
    },
    // Called by main.js right after a new shop is created, so the DM lands
    // on it immediately instead of having to find it in the dropdown.
    selectShop(record) {
      const index = shopRecords.indexOf(record);
      if (index === -1) return;
      mode = 'shop';
      shopTabBtn.classList.add('is-active');
      enemyTabBtn.classList.remove('is-active');
      updateNewBtnVisibility();
      populateSelect();
      select.value = String(index);
      renderContent();
    }
  };
}
