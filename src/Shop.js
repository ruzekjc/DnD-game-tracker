// src/Shop.js

import { fromCopper, formatPurse } from './currency.js';
import { createLibraryItemPicker } from './libraryItemPicker.js';
import { showModal, showEditableModal } from './modal.js';
import { attachDragReorder } from './utils.js';

/**
 * Renders an editable shop view: existing inventory with remove + inline
 * price editing, a search-driven "Add from Library" section sourced from
 * the master item library (see main.js's libraryRecords / getLibraryItems),
 * and Save.
 *
 * Same edit/view split as character cards: an Edit toggle next to Save
 * locks the structural stuff (shop name/description, item names, item
 * descriptions, reordering, removing) behind edit mode, while price stays
 * live either way since a DM might reprice something mid-session without
 * wanting to unlock everything else.
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

  let isEditMode = false;

  function notify() {
    if (onChange) onChange(shop);
  }

  const header = document.createElement('div');
  header.className = 'shop-header';
  header.innerHTML = `
    <div class="shop-header-top">
      <h3 class="shop-name editable-field" data-editable="name">${shop.name}</h3>
      <div class="shop-header-actions">
        <button class="edit-mode-btn" type="button">✏️ Edit</button>
        ${onSaveRequest ? '<button class="save-btn shop-save-btn">💾 Save</button>' : ''}
      </div>
    </div>
    <p class="shop-description editable-field" data-editable="description">${shop.description || ''}</p>
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

  // --- Editable shop-level fields (name/description) ---
  const shopFieldEls = Array.from(header.querySelectorAll('[data-editable]'));
  shopFieldEls.forEach((el) => {
    const kind = el.getAttribute('data-editable');
    el.addEventListener('blur', () => {
      if (kind === 'name') shop.name = el.textContent.trim() || shop.name;
      if (kind === 'description') shop.description = el.textContent.trim();
      notify();
    });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); el.blur(); }
    });
  });

  const list = document.createElement('div');
  list.className = 'shop-inventory-list';
  container.appendChild(list);

  attachDragReorder(list, '.shop-inventory-row', shop.inventory, (reordered) => {
    shop.inventory.length = 0;
    shop.inventory.push(...reordered);
    renderList();
    notify();
  }, 'vertical');

  function renderList() {
    list.innerHTML = '';
    list.classList.toggle('is-edit-mode', isEditMode);

    if (!shop.inventory.length) {
      list.innerHTML = `<p class="shop-empty">This shop has no items listed.</p>`;
    }

    shop.inventory.forEach((entry, index) => {
      const row = document.createElement('div');
      row.className = 'shop-inventory-row';
      row.draggable = isEditMode;
      // Drag-handle and remove-button are always rendered (just hidden
      // outside edit mode via CSS) rather than conditionally omitted, so
      // the row keeps the same 4-column grid shape in both modes — an
      // element that only sometimes exists would shift item-name and
      // price into different grid columns between edit/view, reopening
      // the same misalignment bug this grid was built to fix.
      row.innerHTML = `
        <span class="drag-handle" title="Drag to reorder">⠿</span>
        <span class="item-name clickable-name">${entry.item}</span>
        <div class="shop-item-price-edit">
          <input type="number" class="shop-item-price-input" value="${entry.priceInCopper || 0}" min="0" />
          <span class="shop-item-price-unit">cp</span>
        </div>
        <button class="shop-remove-item-btn">✕</button>
      `;

      const nameEl = row.querySelector('.item-name');
      nameEl.addEventListener('click', () => {
        if (isEditMode) {
          showEditableModal(entry.item, entry.description || '', (newName, newDescription) => {
            entry.item = newName || entry.item;
            entry.description = newDescription;
            renderList();
            notify();
          });
        } else if (entry.description) {
          showModal(entry.item, entry.description);
        }
      });

      row.querySelector('.shop-item-price-input').addEventListener('input', (e) => {
        entry.priceInCopper = Number(e.target.value) || 0;
        notify();
      });

      const removeBtn = row.querySelector('.shop-remove-item-btn');
      if (removeBtn) {
        removeBtn.addEventListener('click', () => {
          shop.inventory.splice(index, 1);
          renderList();
          notify();
        });
      }

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
    if (!isEditMode) return; // adding new stock is a structural edit too

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

    librarySection.innerHTML = '<h4>Add from Library</h4>';
    const picker = createLibraryItemPicker(
      getLibraryItems,
      (itemsToAdd) => {
        itemsToAdd.forEach((libItem) => {
          if (!shop.inventory.some((s) => s.item === libItem.item)) {
            shop.inventory.push({
              item: libItem.item,
              priceInCopper: libItem.priceInCopper || 0,
              description: libItem.description
            });
          }
        });
        renderList();
        notify();
      },
      (itemName) => shop.inventory.some((s) => s.item === itemName)
    );
    librarySection.appendChild(picker);
  }

  renderLibrarySection();

  // --- Edit mode toggle ---
  const editModeBtn = header.querySelector('.edit-mode-btn');
  function applyEditMode() {
    container.classList.toggle('is-edit-mode', isEditMode);
    editModeBtn.textContent = isEditMode ? '✅ Done' : '✏️ Edit';
    editModeBtn.classList.toggle('is-active', isEditMode);
    shopFieldEls.forEach((el) => { el.contentEditable = isEditMode ? 'true' : 'false'; });
    renderList();
    renderLibrarySection();
  }
  editModeBtn.addEventListener('click', () => {
    isEditMode = !isEditMode;
    applyEditMode();
  });
  applyEditMode();

  return container;
}
