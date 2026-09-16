// src/Shop.js

import { fromCopper, formatPurse } from './currency.js';
import { showModal } from './modal.js';

/**
 * Renders an editable shop view: existing inventory with remove + inline
 * price editing, a search-driven "Add from Library" section sourced from
 * the master item library (see main.js's libraryRecords / getLibraryItems),
 * and Save.
 *
 * @param {Object} shop - { name, description, inventory: [{ item, priceInCopper, description }] }
 * @param {Object} handlers - { onChange, onSaveRequest, getLibraryItems, onImportLibrary }
 *   onChange fires on any inventory edit. onSaveRequest/getLibraryItems/
 *   onImportLibrary are all optional — omit to hide the relevant UI.
 */
export function createShopView(shop, handlers = {}) {
  const { onChange, onSaveRequest, getLibraryItems, onImportLibrary } = handlers;
  const container = document.createElement('div');
  container.className = 'shop-view';

  if (!shop.inventory) shop.inventory = [];

  function notify() {
    if (onChange) onChange(shop);
  }

  const header = document.createElement('div');
  header.className = 'shop-header';
  header.innerHTML = `
    <h3 class="shop-name">${shop.name}</h3>
    ${shop.description ? `<p class="shop-description">${shop.description}</p>` : ''}
    ${onSaveRequest ? '<button class="save-btn shop-save-btn">💾 Save</button>' : ''}
  `;
  container.appendChild(header);

  const saveBtn = header.querySelector('.save-btn');
  if (saveBtn && onSaveRequest) {
    saveBtn.addEventListener('click', async () => {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving…';
      await onSaveRequest();
      saveBtn.disabled = false;
      saveBtn.textContent = '💾 Save';
    });
  }

  const list = document.createElement('div');
  list.className = 'shop-inventory-list';
  container.appendChild(list);

  function renderList() {
    list.innerHTML = '';

    if (!shop.inventory.length) {
      list.innerHTML = `<p class="shop-empty">This shop has no items listed.</p>`;
    }

    shop.inventory.forEach((entry, index) => {
      const row = document.createElement('div');
      row.className = 'shop-inventory-row';
      row.innerHTML = `
        <span class="item-name clickable-name">${entry.item}</span>
        <div class="shop-item-price-edit">
          <input type="number" class="shop-item-price-input" value="${entry.priceInCopper || 0}" min="0" />
          <span class="shop-item-price-unit">cp</span>
        </div>
        <button class="shop-remove-item-btn">✕</button>
      `;

      if (entry.description) {
        row.querySelector('.item-name').addEventListener('click', () => {
          showModal(entry.item, entry.description);
        });
      }

      row.querySelector('.shop-item-price-input').addEventListener('input', (e) => {
        entry.priceInCopper = Number(e.target.value) || 0;
        notify();
      });

      row.querySelector('.shop-remove-item-btn').addEventListener('click', () => {
        shop.inventory.splice(index, 1);
        renderList();
        notify();
      });

      list.appendChild(row);
    });
  }

  renderList();

  // --- Add from library ---
  const librarySection = document.createElement('div');
  librarySection.className = 'shop-library-section';
  container.appendChild(librarySection);

  function renderLibrarySection() {
    librarySection.innerHTML = '';
    const items = getLibraryItems ? getLibraryItems() : [];

    if (!items.length) {
      librarySection.innerHTML = `
        <p class="bp-empty">No item library imported yet.</p>
        ${onImportLibrary ? '<button class="import-btn shop-import-library-btn">+ Import Item Library</button>' : ''}
      `;
      const importBtn = librarySection.querySelector('.shop-import-library-btn');
      if (importBtn) {
        importBtn.addEventListener('click', async () => {
          await onImportLibrary();
          renderLibrarySection();
        });
      }
      return;
    }

    librarySection.innerHTML = `
      <h4>Add from Library</h4>
      <input type="text" class="shop-library-search" placeholder="Search items..." />
      <div class="shop-library-results"></div>
    `;

    const searchInput = librarySection.querySelector('.shop-library-search');
    const resultsEl = librarySection.querySelector('.shop-library-results');

    function renderResults(query) {
      const q = query.trim().toLowerCase();
      const matches = q ? items.filter((i) => i.item.toLowerCase().includes(q)) : items.slice(0, 20);

      resultsEl.innerHTML = matches.length
        ? matches
            .map(
              (i, idx) => `
          <div class="shop-library-row">
            <span class="item-name">${i.item}</span>
            <span class="item-price">${formatPurse(fromCopper(i.priceInCopper || 0))}</span>
            <button class="shop-add-library-btn" data-index="${idx}">+ Add</button>
          </div>
        `
            )
            .join('')
        : `<p class="bp-empty">No matches.</p>`;

      resultsEl.querySelectorAll('.shop-add-library-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const libItem = matches[Number(btn.dataset.index)];
          if (shop.inventory.some((s) => s.item === libItem.item)) {
            showModal('Already Listed', `${libItem.item} is already in this shop's inventory.`);
            return;
          }
          shop.inventory.push({
            item: libItem.item,
            priceInCopper: libItem.priceInCopper || 0,
            description: libItem.description
          });
          renderList();
          notify();
        });
      });
    }

    renderResults('');
    searchInput.addEventListener('input', () => renderResults(searchInput.value));
  }

  renderLibrarySection();

  return container;
}
