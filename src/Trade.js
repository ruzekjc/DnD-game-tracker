// src/Trade.js

import { toCopper, fromCopper, formatPurse, spend, addFunds, RATES } from './currency.js';
import { showModal } from './modal.js';

/**
 * Two-sided trade cart. Pick a party on each side — a character or a
 * shop/NPC record — stage what each side is offering (items + currency),
 * and Confirm executes both transfers atomically.
 *
 * Shop/NPC sides are never mutated by a trade, matching the existing "Buy"
 * precedent that shop stock is unlimited: an NPC can give away anything in
 * its catalog without running out, and receiving something from a character
 * doesn't get tracked as new NPC stock. Only character sides actually give
 * and receive for real. At least one side must be a character — trading
 * between two NPCs isn't meaningful here.
 *
 * @param {Array} characterEntries - shared reference with main.js/BottomPanel;
 *   used both as trade parties and to refresh each character's card display
 *   (cardPurseEl) after a trade completes.
 * @param {Array} shopRecords - shared reference with main.js/BottomPanel
 */
export function createTradeTab(characterEntries, shopRecords) {
  const container = document.createElement('div');
  container.className = 'trade-tab-content';

  const sides = {
    A: { partyType: null, partyIndex: -1, offerItems: [], offerCurrency: 0 },
    B: { partyType: null, partyIndex: -1, offerItems: [], offerCurrency: 0 }
  };

  container.innerHTML = `
    <div class="trade-columns">
      <div class="trade-column" data-side="A"></div>
      <div class="trade-arrow">⇄</div>
      <div class="trade-column" data-side="B"></div>
    </div>
    <button class="trade-confirm-btn save-btn">Confirm Trade</button>
  `;

  const colA = container.querySelector('.trade-column[data-side="A"]');
  const colB = container.querySelector('.trade-column[data-side="B"]');
  const confirmBtn = container.querySelector('.trade-confirm-btn');

  function partyOptions(currentValue) {
    const chars = characterEntries.map((e, i) => `<option value="character:${i}">${e.character.name} (Character)</option>`);
    const shops = shopRecords.map((r, i) => `<option value="shop:${i}">${r.data.name} (NPC)</option>`);
    const options = ['<option value="">-- Select --</option>', ...chars, ...shops];
    return options.join('').replace(`value="${currentValue}"`, `value="${currentValue}" selected`);
  }

  function getParty(side) {
    const s = sides[side];
    if (s.partyType === 'character') return characterEntries[s.partyIndex] && characterEntries[s.partyIndex].character;
    if (s.partyType === 'shop') return shopRecords[s.partyIndex] && shopRecords[s.partyIndex].data;
    return null;
  }

  function syncCardUI(character) {
    const entry = characterEntries.find((e) => e.character === character);
    if (!entry) return;
    if (entry.cardPurseEl && entry.cardPurseEl.refresh) entry.cardPurseEl.refresh();
    if (entry.cardPurseEl && entry.cardPurseEl.refresh) entry.cardPurseEl.refresh();
  }

  function renderColumn(side) {
    const col = side === 'A' ? colA : colB;
    const s = sides[side];
    const party = getParty(side);
    const currentValue = s.partyType ? `${s.partyType}:${s.partyIndex}` : '';

    col.innerHTML = `
      <h4>Party ${side}</h4>
      <select class="trade-party-select">${partyOptions(currentValue)}</select>
      ${
        party && s.partyType === 'character'
          ? `<div class="trade-wallet">Wallet: ${formatPurse(party.coinPouch || { platinum: 0, gold: 0, silver: 0, copper: 0 })}</div>`
          : ''
      }
      ${
        party
          ? `
        <div class="trade-offer-label">Offering</div>
        <div class="trade-offer-list"></div>
        <div class="trade-available-label">Add from ${s.partyType === 'shop' ? 'catalog' : 'inventory'}</div>
        <div class="trade-available-list"></div>
        ${
          s.partyType === 'character'
            ? `
          <div class="trade-currency-add">
            <input type="number" class="trade-currency-input" placeholder="Amount" min="0" />
            <select class="trade-currency-denom">
              <option value="platinum">Platinum</option>
              <option value="gold">Gold</option>
              <option value="silver" selected>Silver</option>
              <option value="copper">Copper</option>
            </select>
            <button class="trade-add-currency-btn import-btn">+ Add Currency</button>
          </div>
        `
            : ''
        }
      `
          : `<p class="bp-empty">Select a character or NPC.</p>`
      }
    `;

    const select = col.querySelector('.trade-party-select');
    select.addEventListener('change', () => {
      const [type, idx] = select.value.split(':');
      s.partyType = type || null;
      s.partyIndex = type ? Number(idx) : -1;
      s.offerItems = [];
      s.offerCurrency = 0;
      renderColumn(side);
    });

    if (!party) return;

    renderOfferList(side);
    renderAvailableList(side);

    const addCurrencyBtn = col.querySelector('.trade-add-currency-btn');
    if (addCurrencyBtn) {
      addCurrencyBtn.addEventListener('click', () => {
        const input = col.querySelector('.trade-currency-input');
        const denom = col.querySelector('.trade-currency-denom').value;
        const amount = Number(input.value);
        if (!amount || amount <= 0) return;
        s.offerCurrency += amount * RATES[denom];
        input.value = '';
        renderOfferList(side);
      });
    }
  }

  function renderOfferList(side) {
    const col = side === 'A' ? colA : colB;
    const s = sides[side];
    const listEl = col.querySelector('.trade-offer-list');
    if (!listEl) return;

    const rows = s.offerItems.map(
      (entry, i) => `
      <div class="trade-offer-row">
        <span>${entry.item} x${entry.qty}</span>
        <button class="trade-remove-offer-btn" data-index="${i}">✕</button>
      </div>
    `
    );

    if (s.offerCurrency > 0) {
      rows.push(`
        <div class="trade-offer-row">
          <span>${formatPurse(fromCopper(s.offerCurrency))}</span>
          <button class="trade-remove-currency-btn">✕</button>
        </div>
      `);
    }

    listEl.innerHTML = rows.length ? rows.join('') : `<p class="bp-empty">Nothing offered yet.</p>`;

    listEl.querySelectorAll('.trade-remove-offer-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        s.offerItems.splice(Number(btn.dataset.index), 1);
        renderOfferList(side);
      });
    });

    const removeCurrencyBtn = listEl.querySelector('.trade-remove-currency-btn');
    if (removeCurrencyBtn) {
      removeCurrencyBtn.addEventListener('click', () => {
        s.offerCurrency = 0;
        renderOfferList(side);
      });
    }
  }

  function renderAvailableList(side) {
    const col = side === 'A' ? colA : colB;
    const s = sides[side];
    const listEl = col.querySelector('.trade-available-list');
    if (!listEl) return;

    const party = getParty(side);
    const uniqueItems = [...new Set((party.inventory || []).map((i) => i.item))];

    if (!uniqueItems.length) {
      listEl.innerHTML = `<p class="bp-empty">Nothing available.</p>`;
      return;
    }

    listEl.innerHTML = uniqueItems
      .map(
        (item) => `
      <div class="trade-available-row">
        <span>${item}</span>
        <button class="trade-add-item-btn" data-item="${item}">+ Add</button>
      </div>
    `
      )
      .join('');

    listEl.querySelectorAll('.trade-add-item-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const itemName = btn.dataset.item;
        const existing = s.offerItems.find((o) => o.item === itemName);
        if (existing) existing.qty += 1;
        else s.offerItems.push({ item: itemName, qty: 1 });
        renderOfferList(side);
      });
    });
  }

  function validateOffer(character, side, label, errors) {
    if (!character.coinPouch) character.coinPouch = { platinum: 0, gold: 0, silver: 0, copper: 0 };
    if (!character.inventory) character.inventory = [];

    if (side.offerCurrency > toCopper(character.coinPouch)) {
      errors.push(`${label} doesn't have enough currency to offer that much.`);
    }
    side.offerItems.forEach((o) => {
      const owned = character.inventory.find((inv) => inv.item === o.item);
      if (!owned || owned.qty < o.qty) {
        errors.push(`${label} doesn't have ${o.qty}x ${o.item} to offer.`);
      }
    });
  }

  function removeOffer(character, side) {
    side.offerItems.forEach((o) => {
      const idx = character.inventory.findIndex((inv) => inv.item === o.item);
      if (idx !== -1) {
        character.inventory[idx].qty -= o.qty;
        if (character.inventory[idx].qty <= 0) character.inventory.splice(idx, 1);
      }
    });
    if (side.offerCurrency > 0) {
      const newPouch = spend(character.coinPouch, side.offerCurrency);
      if (newPouch) Object.assign(character.coinPouch, newPouch);
    }
  }

  function giveOffer(character, incomingSide) {
    incomingSide.offerItems.forEach((o) => {
      const existing = character.inventory.find((inv) => inv.item === o.item);
      if (existing) existing.qty += o.qty;
      else character.inventory.push({ item: o.item, qty: o.qty });
    });
    if (incomingSide.offerCurrency > 0) {
      const newPouch = addFunds(character.coinPouch, incomingSide.offerCurrency);
      Object.assign(character.coinPouch, newPouch);
    }
  }

  confirmBtn.addEventListener('click', () => {
    const a = sides.A;
    const b = sides.B;

    if (!a.partyType || !b.partyType) {
      showModal('Trade Incomplete', 'Select a party on both sides before confirming.');
      return;
    }
    if (a.partyType === 'shop' && b.partyType === 'shop') {
      showModal('Invalid Trade', 'At least one side of a trade must be a character.');
      return;
    }
    if (a.partyType === b.partyType && a.partyIndex === b.partyIndex) {
      showModal('Invalid Trade', 'Both sides are the same party.');
      return;
    }

    const partyA = getParty('A');
    const partyB = getParty('B');

    const errors = [];
    if (a.partyType === 'character') validateOffer(partyA, a, `${partyA.name}`, errors);
    if (b.partyType === 'character') validateOffer(partyB, b, `${partyB.name}`, errors);

    if (errors.length) {
      showModal('Trade Failed', errors.join(' '));
      return;
    }

    // Execute atomically — only character sides are ever mutated; shop/NPC
    // sides act as an unlimited catalog, same as Buy.
    if (a.partyType === 'character') {
      removeOffer(partyA, a);
      giveOffer(partyA, b);
      syncCardUI(partyA);
    }
    if (b.partyType === 'character') {
      removeOffer(partyB, b);
      giveOffer(partyB, a);
      syncCardUI(partyB);
    }

    a.offerItems = [];
    a.offerCurrency = 0;
    b.offerItems = [];
    b.offerCurrency = 0;
    renderColumn('A');
    renderColumn('B');

    showModal('Trade Complete', 'The trade was completed successfully.');
  });

  renderColumn('A');
  renderColumn('B');

  return {
    element: container,
    // Called by BottomPanel after new characters/shops are imported, so the
    // party dropdowns pick up the new options.
    refreshOptions() {
      renderColumn('A');
      renderColumn('B');
    }
  };
}
