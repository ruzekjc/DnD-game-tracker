// src/BottomPanel.js

import { toCopper, fromCopper, formatPurse, spend, addFunds } from './currency.js';
import { createDicePoolRoller } from './diceRoller.js';
import { getAllModSources } from './mods.js';
import { createTradeTab } from './Trade.js';
import { addExp, normalizeExp } from './progression.js';
import { showLevelUpModal } from './levelUpModal.js';
import { showModal } from './modal.js';
import { parseQuickAdd, attachDragReorder } from './utils.js';

/**
 * The bottom panel: three tabs.
 *  - Inventory: browse a shop, stage a cart, Buy/Return against the
 *    currently-selected character.
 *  - Dice Roller: free-form dice pool (click any mix of standard dice,
 *    Roll), then manually pick which of the selected character's
 *    mods/skills/conditions apply to the total. Nothing auto-applies since
 *    the same roll can call for different mods depending on the scenario.
 *  - Trade: two-sided trade cart, independent of the character selector
 *    above (it has its own two party pickers) — see Trade.js.
 *
 * @param {Array} characterEntries - [{ character, cardPurseEl }]
 * @param {Array} shopRecords - loaded + validated shop records (see dataStore.js);
 *   shared by reference with main.js, which pushes newly-imported shops onto
 *   this same array and calls refreshOptions() to pick them up.
 * @param {Function} [onExpChange] - (character) => void, called whenever the
 *   EXP tab changes a character's exp/level/skillPoints/skills, so main.js
 *   can rebuild that character's card to reflect it.
 */
export function createBottomPanel(characterEntries, shopRecords, onExpChange) {
  const container = document.createElement('div');
  container.className = 'bottom-panel';

  let mode = 'inventory';
  let selectedCharIndex = characterEntries.length ? 0 : -1;
  let selectedShopIndex = shopRecords.length ? 0 : -1;
  let cart = []; // { item, priceInCopper, qty }

  container.innerHTML = `
    <div class="bottom-panel-header">
      <select class="bp-character-select"></select>
      <div class="bottom-panel-tabs">
        <button class="tab-btn bp-inventory-tab is-active">Inventory</button>
        <button class="tab-btn bp-dice-tab">Dice Roller</button>
        <button class="tab-btn bp-trade-tab">Trade</button>
        <button class="tab-btn bp-exp-tab">EXP</button>
      </div>
    </div>
    <div class="bottom-panel-content"></div>
  `;

  const charSelect = container.querySelector('.bp-character-select');
  const inventoryTabBtn = container.querySelector('.bp-inventory-tab');
  const diceTabBtn = container.querySelector('.bp-dice-tab');
  const tradeTabBtn = container.querySelector('.bp-trade-tab');
  const expTabBtn = container.querySelector('.bp-exp-tab');
  const content = container.querySelector('.bottom-panel-content');

  // Created once so state (queued dice, staged trade offers) survives tab
  // switches — only their DOM is moved in/out of `content`, never rebuilt.
  const diceRoller = createDicePoolRoller(() => {
    const entry = getSelectedEntry();
    return entry ? getAllModSources(entry.character) : [];
  });
  const tradeTab = createTradeTab(characterEntries, shopRecords);

  function populateCharSelect() {
    charSelect.innerHTML = characterEntries.length
      ? characterEntries.map((e, i) => `<option value="${i}">${e.character.name}</option>`).join('')
      : `<option value="">No characters imported</option>`;
    charSelect.value = selectedCharIndex >= 0 ? String(selectedCharIndex) : '';
  }

  function getSelectedEntry() {
    return selectedCharIndex >= 0 ? characterEntries[selectedCharIndex] : null;
  }

  function syncCardUI(entry) {
    if (entry.cardPurseEl && entry.cardPurseEl.refresh) entry.cardPurseEl.refresh();
  }

  function render() {
    content.innerHTML = '';
    if (mode === 'inventory') content.appendChild(renderInventoryTab());
    else if (mode === 'dice') content.appendChild(renderDiceTab());
    else if (mode === 'trade') content.appendChild(tradeTab.element);
    else content.appendChild(renderExpTab());
  }

  // ---------- Inventory tab ----------
  function renderInventoryTab() {
    const wrap = document.createElement('div');
    wrap.className = 'bp-inventory-tab-content';

    const entry = getSelectedEntry();
    if (!entry) {
      wrap.innerHTML = `<p class="bp-empty">Select a character to manage their inventory.</p>`;
      return wrap;
    }

    const character = entry.character;
    if (!character.coinPouch) character.coinPouch = { platinum: 0, gold: 0, silver: 0, copper: 0 };
    if (!character.inventory) character.inventory = [];

    wrap.innerHTML = `
      <div class="bp-wallet">Wallet: <span class="bp-wallet-amount">${formatPurse(character.coinPouch)}</span></div>
      <div class="bp-inventory-columns">
        <div class="bp-shop-column">
          <h4>Shop</h4>
          <select class="bp-shop-select"></select>
          <div class="bp-shop-items"></div>
        </div>
        <div class="bp-cart-column">
          <h4>Cart</h4>
          <div class="bp-cart-items"></div>
          <div class="bp-cart-total"></div>
          <button class="bp-buy-btn">Buy</button>
        </div>
        <div class="bp-owned-column">
          <h4>${character.name}'s Inventory</h4>
          <div class="bp-owned-items"></div>
        </div>
      </div>
    `;

    const shopSelect = wrap.querySelector('.bp-shop-select');
    const shopItemsEl = wrap.querySelector('.bp-shop-items');
    const cartItemsEl = wrap.querySelector('.bp-cart-items');
    const cartTotalEl = wrap.querySelector('.bp-cart-total');
    const ownedItemsEl = wrap.querySelector('.bp-owned-items');
    const walletAmountEl = wrap.querySelector('.bp-wallet-amount');

    shopSelect.innerHTML = shopRecords.length
      ? shopRecords.map((r, i) => `<option value="${i}">${r.data.name}</option>`).join('')
      : `<option value="">No shops imported</option>`;
    shopSelect.value = selectedShopIndex >= 0 ? String(selectedShopIndex) : '';

    shopSelect.addEventListener('change', () => {
      selectedShopIndex = Number(shopSelect.value);
      renderShopItems();
    });

    function renderShopItems() {
      shopItemsEl.innerHTML = '';
      const shopRecord = shopRecords[selectedShopIndex];
      if (!shopRecord) return;
      const shop = shopRecord.data;

      (shop.inventory || []).forEach((item) => {
        const row = document.createElement('div');
        row.className = 'bp-shop-item-row';
        row.innerHTML = `
          <span class="item-name">${item.item}</span>
          <span class="item-price">${formatPurse(fromCopper(item.priceInCopper || 0))}</span>
          <button class="bp-add-cart-btn">+ Cart</button>
        `;
        row.querySelector('.bp-add-cart-btn').addEventListener('click', () => {
          const existing = cart.find((c) => c.item === item.item);
          if (existing) existing.qty += 1;
          else cart.push({ item: item.item, priceInCopper: item.priceInCopper || 0, qty: 1 });
          renderCart();
        });
        shopItemsEl.appendChild(row);
      });
    }

    function renderCart() {
      cartItemsEl.innerHTML = '';
      cart.forEach((cartEntry, i) => {
        const row = document.createElement('div');
        row.className = 'bp-cart-item-row';
        row.innerHTML = `
          <span class="item-name">${cartEntry.item} x${cartEntry.qty}</span>
          <button class="bp-remove-cart-btn">✕</button>
        `;
        row.querySelector('.bp-remove-cart-btn').addEventListener('click', () => {
          cart.splice(i, 1);
          renderCart();
        });
        cartItemsEl.appendChild(row);
      });
      const totalCopper = cart.reduce((sum, c) => sum + c.priceInCopper * c.qty, 0);
      cartTotalEl.textContent = `Total: ${formatPurse(fromCopper(totalCopper))}`;
    }

    // Reordering is always live here (there's no separate edit/view mode
    // for the owned-items list — it's already a working inventory, not a
    // character sheet field). Attach once to the persistent container;
    // renderOwnedItems() only ever replaces its innerHTML, never the
    // element itself, so this survives repeated re-renders without
    // stacking duplicate listeners.
    attachDragReorder(ownedItemsEl, '.bp-owned-item-row', character.inventory, (reordered) => {
      character.inventory.length = 0;
      character.inventory.push(...reordered);
      renderOwnedItems();
    }, 'vertical');

    function renderOwnedItems() {
      ownedItemsEl.innerHTML = '';
      if (!character.inventory.length) {
        ownedItemsEl.innerHTML = `<p class="bp-empty">No items.</p>`;
      }
      character.inventory.forEach((invItem, i) => {
        const row = document.createElement('div');
        row.className = 'bp-owned-item-row';
        row.draggable = true;
        row.innerHTML = `
          <span class="drag-handle" title="Drag to reorder">⠿</span>
          <span class="item-name">${invItem.item}</span>
          <div class="qty-controls">
            <button class="qty-btn minus">−</button>
            <span class="qty-value">${invItem.qty}</span>
            <button class="qty-btn plus">+</button>
          </div>
          <div class="bp-owned-item-actions">
            <button class="bp-return-btn" title="Return one to the shop for a refund">↩</button>
            <button class="bp-discard-btn" title="Discard the whole stack (no refund)">🗑</button>
          </div>
        `;

        row.querySelector('.minus').addEventListener('click', () => {
          invItem.qty -= 1;
          if (invItem.qty <= 0) character.inventory.splice(i, 1);
          renderOwnedItems();
        });
        row.querySelector('.plus').addEventListener('click', () => {
          invItem.qty += 1;
          renderOwnedItems();
        });
        row.querySelector('.bp-return-btn').addEventListener('click', () => {
          returnItem(invItem, i);
        });
        row.querySelector('.bp-discard-btn').addEventListener('click', () => {
          character.inventory.splice(i, 1);
          renderOwnedItems();
        });

        ownedItemsEl.appendChild(row);
      });

      const addRow = document.createElement('div');
      addRow.className = 'inventory-add-row';
      addRow.innerHTML = `
        <input type="text" class="new-item-input" placeholder="New item (Vials x30, Rounds-10)..." />
        <button class="add-item-btn">+ Add</button>
      `;
      const newItemInput = addRow.querySelector('.new-item-input');

      function commitAddItem() {
        const raw = newItemInput.value.trim();
        if (!raw) return;
        const { name, amount, op } = parseQuickAdd(raw, 'qty');
        // Case-insensitive so "Roundsx20" and "roundsx20" both stack onto
        // the same existing "Rounds" entry instead of creating a duplicate.
        const existing = character.inventory.find(
          (i) => i.item.trim().toLowerCase() === name.toLowerCase()
        );
        if (op === 'subtract') {
          if (existing) {
            existing.qty -= amount;
            if (existing.qty <= 0) {
              character.inventory.splice(character.inventory.indexOf(existing), 1);
            }
          }
          // Nothing to subtract from — silently a no-op, same as trying to
          // spend a stack that doesn't exist.
        } else if (existing) {
          existing.qty += amount;
        } else {
          character.inventory.push({ item: name, qty: amount });
        }
        newItemInput.value = '';
        renderOwnedItems();
      }

      addRow.querySelector('.add-item-btn').addEventListener('click', commitAddItem);
      newItemInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); commitAddItem(); }
      });
      ownedItemsEl.appendChild(addRow);
    }

    function returnItem(invItem, index) {
      const shopRecord = shopRecords[selectedShopIndex];
      const shop = shopRecord && shopRecord.data;
      const shopListing = shop && (shop.inventory || []).find((s) => s.item === invItem.item);

      invItem.qty -= 1;
      if (invItem.qty <= 0) character.inventory.splice(index, 1);

      if (shopListing) {
        const newPouch = addFunds(character.coinPouch, shopListing.priceInCopper || 0);
        Object.assign(character.coinPouch, newPouch);
        walletAmountEl.textContent = formatPurse(character.coinPouch);
      }

      renderOwnedItems();
      syncCardUI(entry);
    }

    wrap.querySelector('.bp-buy-btn').addEventListener('click', () => {
      if (!cart.length) return;

      const totalCopper = cart.reduce((sum, c) => sum + c.priceInCopper * c.qty, 0);
      const newPouch = spend(character.coinPouch, totalCopper);
      if (!newPouch) {
        showModal('Insufficient Funds', `${character.name} doesn't have enough coin for this purchase.`);
        return;
      }
      Object.assign(character.coinPouch, newPouch);

      cart.forEach((c) => {
        const existing = character.inventory.find((inv) => inv.item === c.item);
        if (existing) existing.qty += c.qty;
        else character.inventory.push({ item: c.item, qty: c.qty });
      });

      cart = [];
      renderCart();
      renderOwnedItems();
      walletAmountEl.textContent = formatPurse(character.coinPouch);
      syncCardUI(entry);
    });

    renderShopItems();
    renderCart();
    renderOwnedItems();

    return wrap;
  }

  // ---------- Dice Roller tab ----------
  function renderDiceTab() {
    const wrap = document.createElement('div');
    wrap.className = 'bp-dice-tab-content';

    const entry = getSelectedEntry();
    if (!entry) {
      wrap.innerHTML = `<p class="bp-empty">Select a character to roll for them.</p>`;
      return wrap;
    }

    wrap.appendChild(diceRoller.element);
    return wrap;
  }

  // ---------- EXP tab ----------
  function renderExpTab() {
    const wrap = document.createElement('div');
    wrap.className = 'bp-exp-tab-content';

    const entry = getSelectedEntry();
    if (!entry) {
      wrap.innerHTML = `<p class="bp-empty">Select a character to grant EXP.</p>`;
      return wrap;
    }

    const character = entry.character;
    normalizeExp(character);

    wrap.innerHTML = `
      <div class="bp-exp-status">${character.name}: Level ${character.level || 1} — ${character.exp.value} / ${character.exp.cap} EXP</div>
      <div class="bp-exp-buttons">
        <button class="bp-exp-btn" data-fraction="0.25">+25%</button>
        <button class="bp-exp-btn" data-fraction="0.5">+50%</button>
        <button class="bp-exp-btn" data-fraction="0.75">+75%</button>
        <button class="bp-exp-btn" data-fraction="1">+100%</button>
      </div>
      <p class="bp-exp-note">
        Each button adds that percentage of the total EXP needed to level up
        (currently ${character.exp.cap}), regardless of current progress — and they stack,
        so +25% then +50% adds 75% total.
      </p>
    `;

    wrap.querySelectorAll('.bp-exp-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const fraction = Number(btn.dataset.fraction);
        const amount = Math.round(character.exp.cap * fraction);
        const levelsGained = addExp(character, amount);

        if (onExpChange) onExpChange(character);
        render();

        if (levelsGained > 0) queueLevelUps(character, levelsGained);
      });
    });

    return wrap;
  }

  function queueLevelUps(character, count) {
    if (count <= 0) return;
    showLevelUpModal(character, () => {
      if (onExpChange) onExpChange(character);
      queueLevelUps(character, count - 1);
    });
  }

  // ---------- Wiring ----------
  charSelect.addEventListener('change', () => {
    selectedCharIndex = charSelect.value === '' ? -1 : Number(charSelect.value);
    diceRoller.resetResult();
    render();
  });

  function switchMode(newMode) {
    if (mode === newMode) return;
    mode = newMode;
    inventoryTabBtn.classList.toggle('is-active', mode === 'inventory');
    diceTabBtn.classList.toggle('is-active', mode === 'dice');
    tradeTabBtn.classList.toggle('is-active', mode === 'trade');
    expTabBtn.classList.toggle('is-active', mode === 'exp');
    render();
  }

  inventoryTabBtn.addEventListener('click', () => switchMode('inventory'));
  diceTabBtn.addEventListener('click', () => switchMode('dice'));
  tradeTabBtn.addEventListener('click', () => switchMode('trade'));
  expTabBtn.addEventListener('click', () => switchMode('exp'));

  populateCharSelect();
  render();

  return {
    element: container,
    // Called by main.js when a character changes via its own card controls,
    // so the bottom panel stays in sync if that character is currently shown.
    refreshIfSelected(character) {
      const entry = getSelectedEntry();
      if (entry && entry.character === character) render();
    },
    // Called by main.js after pushing a new entry onto characterEntries
    // (character import) or a new record onto shopRecords (shop import).
    refreshOptions() {
      if (selectedCharIndex === -1 && characterEntries.length) selectedCharIndex = 0;
      if (selectedShopIndex === -1 && shopRecords.length) selectedShopIndex = 0;
      populateCharSelect();
      tradeTab.refreshOptions();
      render();
    },
    // Called by main.js's character panel navigation, so both selectors
    // point at the same character instead of drifting independently.
    selectCharacter(character) {
      const index = characterEntries.findIndex((e) => e.character === character);
      if (index === -1) return;
      selectedCharIndex = index;
      diceRoller.resetResult();
      populateCharSelect();
      render();
    }
  };
}
