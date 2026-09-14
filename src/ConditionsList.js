// src/ConditionsList.js

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
 * @param {Array} conditions - array of { name, active, value, appliesTo } (mutated in place)
 * @param {Function} [onChange] - fired on any change
 * @param {Array} [statOptions] - stat labels (e.g. Object.keys(character.dice)) for
 *   the "applies to" dropdown. Omit/empty to skip targeting (conditions just apply to all rolls).
 */
export function createConditionsList(conditions, onChange, statOptions = []) {
  const container = document.createElement('div');
  container.className = 'conditions-list';

  function render() {
    container.innerHTML = '';

    conditions.forEach((condition, index) => {
      if (condition.value === undefined) condition.value = 0;
      if (condition.appliesTo === undefined) condition.appliesTo = '';

      const row = document.createElement('div');
      row.className = `condition-row${condition.active ? ' is-active' : ''}`;

      const sign = condition.value >= 0 ? '+' : '';
      const appliesToOptions = ['<option value="">All Rolls</option>']
        .concat(
          statOptions.map(
            (s) => `<option value="${s}"${condition.appliesTo === s ? ' selected' : ''}>${s}</option>`
          )
        )
        .join('');

      row.innerHTML = `
        <label class="condition-toggle">
          <input type="checkbox" class="condition-active" ${condition.active ? 'checked' : ''} />
          <span class="condition-name">${condition.name}</span>
        </label>
        <div class="condition-controls">
          <div class="qty-controls">
            <button class="qty-btn minus">−</button>
            <span class="condition-value">${sign}${condition.value}</span>
            <button class="qty-btn plus">+</button>
          </div>
          ${statOptions.length ? `<select class="condition-applies-to">${appliesToOptions}</select>` : ''}
          <button class="condition-remove">✕</button>
        </div>
      `;

      row.querySelector('.condition-active').addEventListener('change', (e) => {
        condition.active = e.target.checked;
        row.classList.toggle('is-active', condition.active);
        if (onChange) onChange(conditions);
      });

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

      row.querySelector('.condition-remove').addEventListener('click', () => {
        conditions.splice(index, 1);
        render();
        if (onChange) onChange(conditions);
      });

      container.appendChild(row);
    });

    const addRow = document.createElement('div');
    addRow.className = 'inventory-add-row';
    addRow.innerHTML = `
      <input type="text" class="new-item-input" placeholder="New condition..." />
      <button class="add-item-btn">+ Add</button>
    `;

    addRow.querySelector('.add-item-btn').addEventListener('click', () => {
      const input = addRow.querySelector('.new-item-input');
      const name = input.value.trim();
      if (name) {
        conditions.push({ name, active: true, value: 0, appliesTo: '' });
        input.value = '';
        render();
        if (onChange) onChange(conditions);
      }
    });

    container.appendChild(addRow);
  }

  render();
  return container;
}