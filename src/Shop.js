// src/Shop.js

import { fromCopper, formatPurse } from './currency.js';
import { showModal } from './modal.js';

/**
 * Renders a read-only shop view: merchant info + inventory with prices.
 * Buying/selling (cart, wallet deduction) lives in the bottom Inventory panel,
 * not here — this is purely the "browse the shop" viewer.
 *
 * @param {Object} shop - { name, description, inventory: [{ item, priceInCopper, description }] }
 */
export function createShopView(shop) {
  const container = document.createElement('div');
  container.className = 'shop-view';

  const header = document.createElement('div');
  header.className = 'shop-header';
  header.innerHTML = `
    <h3 class="shop-name">${shop.name}</h3>
    ${shop.description ? `<p class="shop-description">${shop.description}</p>` : ''}
  `;
  container.appendChild(header);

  const list = document.createElement('div');
  list.className = 'shop-inventory-list';

  const inventory = shop.inventory || [];

  if (!inventory.length) {
    const empty = document.createElement('p');
    empty.className = 'shop-empty';
    empty.textContent = 'This shop has no items listed.';
    list.appendChild(empty);
  }

  inventory.forEach((entry) => {
    const row = document.createElement('div');
    row.className = 'shop-inventory-row';

    const priceDisplay = formatPurse(fromCopper(entry.priceInCopper || 0));

    row.innerHTML = `
      <span class="item-name clickable-name">${entry.item}</span>
      <span class="item-price">${priceDisplay}</span>
    `;

    if (entry.description) {
      row.querySelector('.item-name').addEventListener('click', () => {
        showModal(entry.item, entry.description);
      });
    }

    list.appendChild(row);
  });

  container.appendChild(list);
  return container;
}
