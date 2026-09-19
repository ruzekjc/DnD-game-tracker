import { parseQuickAdd, attachDragReorder, equalizeRowWidths } from './utils.js';

/**
 * Renders a skills list ("mods"): each skill is a name + numeric value with
 * +/- controls.
 *
 *  - Quick-add: typing "Agility+2" (or "Stealth -3") into the add field and
 *    hitting Enter (or clicking + Add) creates the skill pre-set to that
 *    value. Plain text with no +/- suffix still adds at 0, as before.
 *  - Edit mode only: drag-and-drop reordering, name editing, and a remove
 *    button. Outside edit mode the list is read-only except for the +/-
 *    value buttons, which stay live for in-session play.
 *  - Every chip is resized to the same fixed width (the minimum needed to
 *    fit the longest name) after each render, so rows line up cleanly no
 *    matter how many chips share a line.
 *
 * @param {Array} skills - array of { name, value } (mutated in place)
 * @param {Function} [onChange] - fired on any change
 * @param {Function} [getEditMode] - () => boolean; defaults to always-on
 *   (matches the previous always-editable behavior) if omitted.
 */
export function createSkillsList(skills, onChange, getEditMode = () => true) {
  const container = document.createElement('div');
  container.className = 'skills-list';

  attachDragReorder(container, '.skill-row', skills, (reordered) => {
    skills.length = 0;
    skills.push(...reordered);
    render();
    if (onChange) onChange(skills);
  });

  function render() {
    const editMode = !!getEditMode();
    container.innerHTML = '';
    container.classList.toggle('is-edit-mode', editMode);

    skills.forEach((skill, index) => {
      const row = document.createElement('div');
      row.className = 'skill-row';
      row.draggable = editMode;

      const sign = skill.value >= 0 ? '+' : '';

      row.innerHTML = `
        ${editMode ? '<span class="drag-handle" title="Drag to reorder">⠿</span>' : ''}
        <span class="skill-name editable-text" ${editMode ? 'contenteditable="true"' : ''}>${skill.name}</span>
        <div class="qty-controls">
          <button class="qty-btn minus">−</button>
          <span class="skill-value">${sign}${skill.value}</span>
          <button class="qty-btn plus">+</button>
        </div>
        ${editMode ? '<button class="skill-remove" title="Remove skill">✕</button>' : ''}
      `;

      if (editMode) {
        const nameEl = row.querySelector('.skill-name');
        nameEl.addEventListener('blur', (e) => {
          skill.name = e.target.textContent.trim() || skill.name;
          if (onChange) onChange(skills);
        });
        nameEl.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') { e.preventDefault(); nameEl.blur(); }
        });
      }

      row.querySelector('.minus').addEventListener('click', () => {
        skill.value -= 1;
        render();
        if (onChange) onChange(skills);
      });

      row.querySelector('.plus').addEventListener('click', () => {
        skill.value += 1;
        render();
        if (onChange) onChange(skills);
      });

      const removeBtn = row.querySelector('.skill-remove');
      if (removeBtn) {
        removeBtn.addEventListener('click', () => {
          skills.splice(index, 1);
          render();
          if (onChange) onChange(skills);
        });
      }

      container.appendChild(row);
    });

    if (editMode) {
      const addRow = document.createElement('div');
      addRow.className = 'inventory-add-row';
      addRow.innerHTML = `
        <input type="text" class="new-item-input" placeholder="New skill (e.g. Agility+2)..." />
        <button class="add-item-btn">+ Add</button>
      `;

      const input = addRow.querySelector('.new-item-input');

      function commitAdd() {
        const raw = input.value.trim();
        if (!raw) return;
        const { name, amount } = parseQuickAdd(raw, 'value');
        skills.push({ name, value: amount });
        input.value = '';
        render();
        if (onChange) onChange(skills);
      }

      addRow.querySelector('.add-item-btn').addEventListener('click', commitAdd);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); commitAdd(); }
      });

      container.appendChild(addRow);
    }

    requestAnimationFrame(() => {
      equalizeRowWidths(Array.from(container.querySelectorAll('.skill-row')));
    });
  }

  render();
  container.refresh = render; // call after toggling edit mode elsewhere
  return container;
}
