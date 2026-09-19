// src/ConditionsList.js

import { parseQuickAdd, attachDragReorder, equalizeRowWidths } from './utils.js';

/**
 * Creates a conditions list UI. Each condition can be:
 *  - toggled active/inactive (only active conditions count toward rolls)
 *  - given a +/- numeric value (a mod, same idea as a skill's value)
 *  - targeted at a specific stat via "applies to", or left as "All Rolls"
 *    to apply everywhere
 *
 * Shared between Enemy stat blocks and character cards, since both track
 * conditions the same way and feed them into the same mod-stacking math
 * (see mods.js).
 *
 * The toggle checkbox, +/- value, and "applies to" dropdown stay live
 * regardless of edit mode (conditions get flipped on/off mid-session).
 * Renaming, dragging to reorder, and removing are edit-mode-only, same as
 * skills. Chip widths are equalized after every render so rows line up.
 *
 * @param {Array} conditions - array of { name, active, value, appliesTo } (mutated in place)
 * @param {Function} [onChange] - fired on any change
 * @param {Array} [statOptions] - stat labels (e.g. Object.keys(character.dice)) for
 *   the "applies to" dropdown. Omit/empty to skip targeting (conditions just apply to all rolls).
 * @param {Function} [getEditMode] - () => boolean; defaults to always-on.
 */
export function createConditionsList(conditions, onChange, statOptions = [], getEditMode = () => true) {
  const container = document.createElement('div');
  container.className = 'conditions-list';

  attachDragReorder(container, '.condition-row', conditions, (reordered) => {
    conditions.length = 0;
    conditions.push(...reordered);
    render();
    if (onChange) onChange(conditions);
  });

  function render() {
    const editMode = !!getEditMode();
    container.innerHTML = '';
    container.classList.toggle('is-edit-mode', editMode);

    conditions.forEach((condition, index) => {
      if (condition.value === undefined) condition.value = 0;
      if (condition.appliesTo === undefined) condition.appliesTo = '';

      const row = document.createElement('div');
      row.className = `condition-row${condition.active ? ' is-active' : ''}`;
      row.draggable = editMode;

      const sign = condition.value >= 0 ? '+' : '';
      const appliesToOptions = ['<option value="">All Rolls</option>']
        .concat(
          statOptions.map(
            (s) => `<option value="${s}"${condition.appliesTo === s ? ' selected' : ''}>${s}</option>`
          )
        )
        .join('');

      row.innerHTML = `
        ${editMode ? '<span class="drag-handle" title="Drag to reorder">⠿</span>' : ''}
        <label class="condition-toggle">
          <input type="checkbox" class="condition-active" ${condition.active ? 'checked' : ''} />
          <span class="condition-name" ${editMode ? 'contenteditable="true"' : ''}>${condition.name}</span>
        </label>
        <div class="condition-controls">
          <div class="qty-controls">
            <button class="qty-btn minus">−</button>
            <span class="condition-value">${sign}${condition.value}</span>
            <button class="qty-btn plus">+</button>
          </div>
          ${statOptions.length ? `<select class="condition-applies-to">${appliesToOptions}</select>` : ''}
          ${editMode ? '<button class="condition-remove">✕</button>' : ''}
        </div>
      `;

      row.querySelector('.condition-active').addEventListener('change', (e) => {
        condition.active = e.target.checked;
        row.classList.toggle('is-active', condition.active);
        if (onChange) onChange(conditions);
      });

      if (editMode) {
        const nameEl = row.querySelector('.condition-name');
        nameEl.addEventListener('blur', (e) => {
          condition.name = e.target.textContent.trim() || condition.name;
          if (onChange) onChange(conditions);
        });
        nameEl.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') { e.preventDefault(); nameEl.blur(); }
        });
      }

      row.querySelector('.minus').addEventListener('click', () => {
        condition.value -= 1;
        render();
        if (onChange) onChange(conditions);
      });

      row.querySelector('.plus').addEventListener('click', () => {
        condition.value += 1;
        render();
        if (onChange) onChange(conditions);
      });

      const appliesSelect = row.querySelector('.condition-applies-to');
      if (appliesSelect) {
        appliesSelect.addEventListener('change', (e) => {
          condition.appliesTo = e.target.value;
          if (onChange) onChange(conditions);
        });
      }

      const removeBtn = row.querySelector('.condition-remove');
      if (removeBtn) {
        removeBtn.addEventListener('click', () => {
          conditions.splice(index, 1);
          render();
          if (onChange) onChange(conditions);
        });
      }

      container.appendChild(row);
    });

    if (editMode) {
      const addRow = document.createElement('div');
      addRow.className = 'inventory-add-row';
      addRow.innerHTML = `
        <input type="text" class="new-item-input" placeholder="New condition (e.g. Poisoned-2)..." />
        <button class="add-item-btn">+ Add</button>
      `;

      const input = addRow.querySelector('.new-item-input');

      function commitAdd() {
        const raw = input.value.trim();
        if (!raw) return;
        const { name, amount } = parseQuickAdd(raw, 'value');
        conditions.push({ name, active: true, value: amount, appliesTo: '' });
        input.value = '';
        render();
        if (onChange) onChange(conditions);
      }

      addRow.querySelector('.add-item-btn').addEventListener('click', commitAdd);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); commitAdd(); }
      });

      container.appendChild(addRow);
    }

    requestAnimationFrame(() => {
      equalizeRowWidths(Array.from(container.querySelectorAll('.condition-row')));
    });
  }

  render();
  container.refresh = render; // call after toggling edit mode elsewhere
  return container;
}
