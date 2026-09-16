// src/newShopModal.js

import { createLibraryItemPicker } from './libraryItemPicker.js';

/**
 * Collects a name/description for a new shop or NPC, with an optional
 * batch pick from the master item library to seed its starting inventory.
 * Skipping the library entirely is fine — items can always be added later
 * through the shop's own editor.
 *
 * @param {Function} getLibraryItems - () => [{ item, priceInCopper, description }]
 * @param {Function} onCreate - (shopData) => void, called when the DM confirms
 */
export function showNewShopModal(getLibraryItems, onCreate) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const box = document.createElement('div');
  box.className = 'modal-box new-shop-box';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'modal-close';
  closeBtn.textContent = '✕';

  const heading = document.createElement('h3');
  heading.textContent = 'New Shop / NPC';

  const body = document.createElement('div');
  body.className = 'new-shop-body';
  body.innerHTML = `
    <label class="nc-field">
      Name *
      <input type="text" class="ns-name" />
    </label>
    <label class="nc-field">
      Description
      <textarea class="ns-description" rows="2"></textarea>
    </label>

    <div class="ns-library-section">
      <h4>Seed inventory from library (optional)</h4>
    </div>
    <p class="ns-selected-summary"></p>

    <div class="nc-error" style="display: none;"></div>
    <button class="save-btn ns-create-btn">Create Shop</button>
  `;

  let seedItems = [];

  const libSection = body.querySelector('.ns-library-section');
  const summaryEl = body.querySelector('.ns-selected-summary');

  function renderSummary() {
    summaryEl.textContent = seedItems.length
      ? `${seedItems.length} item(s) selected to start with.`
      : "No items selected yet — that's fine, add them later.";
  }

  const picker = createLibraryItemPicker(
    getLibraryItems,
    (itemsToAdd) => {
      itemsToAdd.forEach((libItem) => {
        if (!seedItems.some((s) => s.item === libItem.item)) {
          seedItems.push({
            item: libItem.item,
            priceInCopper: libItem.priceInCopper || 0,
            description: libItem.description
          });
        }
      });
      renderSummary();
    },
    (itemName) => seedItems.some((s) => s.item === itemName)
  );
  libSection.appendChild(picker);
  renderSummary();

  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    overlay.classList.remove('is-visible');
    setTimeout(() => overlay.remove(), 200);
  }

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  closeBtn.addEventListener('click', close);

  body.querySelector('.ns-create-btn').addEventListener('click', () => {
    const name = body.querySelector('.ns-name').value.trim();
    const errorEl = body.querySelector('.nc-error');

    if (!name) {
      errorEl.textContent = 'Name is required.';
      errorEl.style.display = 'block';
      return;
    }

    const shop = {
      name,
      description: body.querySelector('.ns-description').value.trim(),
      inventory: seedItems
    };

    close();
    onCreate(shop);
  });

  box.appendChild(closeBtn);
  box.appendChild(heading);
  box.appendChild(body);
  overlay.appendChild(box);

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('is-visible'));
}
