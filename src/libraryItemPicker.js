// src/libraryItemPicker.js

import { fromCopper, formatPurse } from './currency.js';

/**
 * Renders a searchable, checkbox-based library browser. Checking items and
 * clicking "Add Selected" calls onAddSelected(items) once, in bulk — shared
 * between Shop.js (adding to an already-imported shop) and the New Shop
 * modal (seeding a shop's initial inventory), so both get the same batch
 * workflow instead of one-at-a-time adds.
 *
 * @param {Function} getLibraryItems - () => [{ item, priceInCopper, description }]
 * @param {Function} onAddSelected - (items[]) => void, called once per "Add Selected" click
 * @param {Function} [isAlreadyAdded] - (itemName) => boolean, disables/labels items already present
 */
export function createLibraryItemPicker(getLibraryItems, onAddSelected, isAlreadyAdded) {
  const container = document.createElement('div');
  container.className = 'library-picker';

  const selected = new Map(); // item name -> library item object

  function render() {
    const items = getLibraryItems ? getLibraryItems() : [];

    container.innerHTML = `
      <input type="text" class="library-picker-search" placeholder="Search items..." />
      <div class="library-picker-results"></div>
      <button type="button" class="save-btn library-picker-add-btn" disabled>Add Selected (0)</button>
    `;

    const searchInput = container.querySelector('.library-picker-search');
    const resultsEl = container.querySelector('.library-picker-results');
    const addBtn = container.querySelector('.library-picker-add-btn');

    function updateAddBtn() {
      addBtn.textContent = `Add Selected (${selected.size})`;
      addBtn.disabled = selected.size === 0;
    }

    function renderResults(query) {
      const q = query.trim().toLowerCase();
      const matches = q ? items.filter((i) => i.item.toLowerCase().includes(q)) : items.slice(0, 30);

      resultsEl.innerHTML = matches.length
        ? matches
            .map((i) => {
              const already = isAlreadyAdded && isAlreadyAdded(i.item);
              return `
                <label class="library-picker-row${already ? ' is-disabled' : ''}">
                  <input type="checkbox" data-item="${i.item}" ${selected.has(i.item) ? 'checked' : ''} ${already ? 'disabled' : ''} />
                  <span class="item-name">${i.item}</span>
                  <span class="item-price">${formatPurse(fromCopper(i.priceInCopper || 0))}</span>
                  ${already ? '<span class="library-picker-already">Already added</span>' : ''}
                </label>
              `;
            })
            .join('')
        : `<p class="bp-empty">No matches.</p>`;

      resultsEl.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
        cb.addEventListener('change', () => {
          const itemName = cb.dataset.item;
          const libItem = items.find((i) => i.item === itemName);
          if (cb.checked) selected.set(itemName, libItem);
          else selected.delete(itemName);
          updateAddBtn();
        });
      });
    }

    renderResults('');
    searchInput.addEventListener('input', () => renderResults(searchInput.value));

    addBtn.addEventListener('click', () => {
      onAddSelected(Array.from(selected.values()));
      selected.clear();
      render(); // full refresh — also re-evaluates isAlreadyAdded for the new state
    });
  }

  render();
  return container;
}
