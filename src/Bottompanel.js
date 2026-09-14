// src/BottomPanel.js

import { toCopper, fromCopper, formatPurse, spend, addFunds } from './currency.js';
import { getModBreakdown } from './Mods.js';
import { showModal } from './modal.js';

/**
 * The bottom panel: a character selector shared across two tabs.
 *
 * Inventory tab: browse a shop, stage a cart, Buy (deducts wallet, adds to
 * character inventory, shop stock stays unlimited), and Return an owned item
 * back to a shop (reverse of buy — refunds the shop's listed price if that
 * item is found there, otherwise just removes it, since not every owned item
 * necessarily came from the currently-selected shop).
 *
 * Dice Roller tab: click a stat to roll its dice. If no character is
 * selected, rolling is blocked with a popup rather than silently failing.
 *
 * @param {Array} characterEntries - [{ character, cardInventoryEl, cardPurseEl }]
 *   cardInventoryEl/cardPurseEl are the DOM elements returned by
 *   createInventoryList/createPurseEditor for that character's card, used to
 *   keep the card's own display in sync after a buy/return here.
 * @param {Array} shopRecords - loaded + validated shop records (see dataStore.js);
 *   shared by reference with main.js, which pushes newly-imported shops onto
 *   this same array and calls refreshOptions() to pick them up.
 */
export function createBottomPanel(characterEntries, shopRecords) {
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
      </div>
    </div>
    <div class="bottom-panel-content"></div>
  `;

  const charSelect = container.querySelector('.bp-character-select');
  const inventoryTabBtn = container.querySelector('.bp-inventory-tab');
  const diceTabBtn = container.querySelector('.bp-dice-tab');
  const content = container.querySelector('.bottom-panel-content');

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
    if (entry.cardInventoryEl && entry.cardInventoryEl.refresh) entry.cardInventoryEl.refresh();
    if (entry.cardPurseEl && entry.cardPurseEl.refresh) entry.cardPurseEl.refresh();
  }

  function render() {
    content.innerHTML = '';
    content.appendChild(mode === 'inventory' ? renderInventoryTab() : renderDiceTab());
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

    function renderOwnedItems() {
      ownedItemsEl.innerHTML = '';
      if (!character.inventory.length) {
        ownedItemsEl.innerHTML = `<p class="bp-empty">No items.</p>`;
        return;
      }
      character.inventory.forEach((invItem, i) => {
        const row = document.createElement('div');
        row.className = 'bp-owned-item-row';
        row.innerHTML = `
          <span class="item-name">${invItem.item} x${invItem.qty}</span>
          <button class="bp-return-btn">↩ Return</button>
        `;
        row.querySelector('.bp-return-btn').addEventListener('click', () => {
          returnItem(invItem, i);
        });
        ownedItemsEl.appendChild(row);
      });
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
  function rollDie(die) {
    const sides = Number(String(die).toLowerCase().replace('d', '')) || 0;
    if (!sides) return 0;
    return Math.floor(Math.random() * sides) + 1;
  }

  function renderDiceTab() {
    const wrap = document.createElement('div');
    wrap.className = 'bp-dice-tab-content';

    const entry = getSelectedEntry();
    if (!entry) {
      wrap.innerHTML = `<p class="bp-empty">Select a character to roll their stats.</p>`;
      return wrap;
    }

    const character = entry.character;
    const dice = character.dice || {};

    wrap.innerHTML = `
      <div class="bp-dice-grid"></div>
      <div class="bp-roll-result">Click a stat to roll.</div>
    `;

    const grid = wrap.querySelector('.bp-dice-grid');
    const resultEl = wrap.querySelector('.bp-roll-result');

    if (!Object.keys(dice).length) {
      grid.innerHTML = `<p class="bp-empty">No dice defined for this character.</p>`;
      return wrap;
    }

    Object.entries(dice).forEach(([label, diceArr]) => {
      const btn = document.createElement('button');
      btn.className = 'bp-stat-roll-btn';
      btn.textContent = label;
      btn.addEventListener('click', () => {
        // Guarded even though the UI only shows buttons once a character is
        // selected — keeps the "no character selected" rule enforced at the
        // action itself, not just at render time.
        if (!getSelectedEntry()) {
          showModal('No Character Selected', 'Select a character before rolling.');
          return;
        }
        if (!diceArr || !diceArr.length) {
          resultEl.textContent = `${label}: no dice defined.`;
          return;
        }

        const rolls = diceArr.map(rollDie);
        const diceTotal = rolls.reduce((a, b) => a + b, 0);

        // Mod stacking: race + occupation + personal skills matching this
        // stat, plus any active conditions targeting it, all add together.
        const breakdown = getModBreakdown(character, label);
        const modTotal = breakdown.reduce((sum, b) => sum + b.value, 0);
        const grandTotal = diceTotal + modTotal;

        const modsLine = breakdown.length
          ? breakdown.map((b) => `${b.source} ${b.value >= 0 ? '+' : ''}${b.value}`).join(', ')
          : 'none';

        resultEl.innerHTML = `
          <strong>${label}: ${grandTotal}</strong><br>
          Dice: [${rolls.join(' + ')}] = ${diceTotal}<br>
          Mods: ${modsLine}
        `;
      });
      grid.appendChild(btn);
    });

    return wrap;
  }

  // ---------- Wiring ----------
  charSelect.addEventListener('change', () => {
    selectedCharIndex = charSelect.value === '' ? -1 : Number(charSelect.value);
    render();
  });

  inventoryTabBtn.addEventListener('click', () => {
    if (mode === 'inventory') return;
    mode = 'inventory';
    inventoryTabBtn.classList.add('is-active');
    diceTabBtn.classList.remove('is-active');
    render();
  });

  diceTabBtn.addEventListener('click', () => {
    if (mode === 'dice') return;
    mode = 'dice';
    diceTabBtn.classList.add('is-active');
    inventoryTabBtn.classList.remove('is-active');
    render();
  });

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
      render();
    }
  };
}