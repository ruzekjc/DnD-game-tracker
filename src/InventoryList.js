// src/InventoryList.js

/**
 * Creates an inventory list UI with +/- quantity controls.
 * Returns the root DOM element to be inserted into the CharacterCard back face.
 *
 * @param {Array} items - array of { item, qty } objects (mutated in place on +/-)
 * @param {Function} [onChange] - optional callback(items) fired whenever a qty changes
 */
export function createInventoryList(items, onChange) {
  const container = document.createElement('div');
  container.className = 'inventory-list';

  function render() {
    container.innerHTML = '';

    items.forEach((entry, index) => {
      const row = document.createElement('div');
      row.className = 'inventory-row';

      row.innerHTML = `
        <span class="item-name">${entry.item}</span>
        <div class="qty-controls">
          <button class="qty-btn minus">−</button>
          <span class="qty-value">${entry.qty}</span>
          <button class="qty-btn plus">+</button>
        </div>
      `;

      row.querySelector('.minus').addEventListener('click', () => {
        if (entry.qty > 0) {
          entry.qty -= 1;
          if (entry.qty === 0) {
            items.splice(index, 1); // remove item entirely at 0
          }
          render();
          if (onChange) onChange(items);
        }
      });

      row.querySelector('.plus').addEventListener('click', () => {
        entry.qty += 1;
        render();
        if (onChange) onChange(items);
      });

      container.appendChild(row);
    });

    // Add-new-item row
    const addRow = document.createElement('div');
    addRow.className = 'inventory-add-row';
    addRow.innerHTML = `
      <input type="text" class="new-item-input" placeholder="New item name..." />
      <button class="add-item-btn">+ Add</button>
    `;

    addRow.querySelector('.add-item-btn').addEventListener('click', () => {
      const input = addRow.querySelector('.new-item-input');
      const name = input.value.trim();
      if (name) {
        items.push({ item: name, qty: 1 });
        input.value = '';
        render();
        if (onChange) onChange(items);
      }
    });

    container.appendChild(addRow);
  }

  render();
  return container;
}