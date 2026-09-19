/**
 * Makes a DOM element inline-editable (contenteditable) and calls
 * onCommit(newText) whenever the text changes and loses focus.
 */
export function makeEditable(el, onCommit) {
  el.classList.add('editable-text');
  el.contentEditable = 'true';
  el.spellcheck = false;

  el.addEventListener('blur', () => {
    onCommit(el.textContent.trim());
  });

  // Prevent Enter from inserting a newline in single-line fields
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !el.classList.contains('multiline')) {
      e.preventDefault();
      el.blur();
    }
  });
}

/**
 * Wraps a section with a hide/show eye-toggle button.
 * Toggling adds a class that blurs the content with a smooth transition.
 * Returns the wrapper element (insert this instead of the raw content).
 */
export function makeHideable(contentEl, label = 'Details') {
  const wrapper = document.createElement('div');
  wrapper.className = 'hideable-wrapper';

  const toggle = document.createElement('button');
  toggle.className = 'hide-toggle-btn';
  toggle.textContent = `🙈 Hide ${label}`;
  toggle.title = `Hide/show ${label}`;

  const content = document.createElement('div');
  content.className = 'hideable-content';
  content.appendChild(contentEl);

  toggle.addEventListener('click', () => {
    const isHidden = content.classList.toggle('is-blurred');
    toggle.textContent = isHidden ? `👁️ Show ${label}` : `🙈 Hide ${label}`;
  });

  wrapper.appendChild(toggle);
  wrapper.appendChild(content);
  return wrapper;
}

/**
 * Parses quick-add shorthand typed into a "new skill/item" input so the
 * user can type a name and value/qty in one go and hit Enter, instead of
 * adding then hunting for the +/- buttons.
 *
 *  - kind 'value' (skills, conditions): "Agility+2", "Stealth -3", "Luck+10"
 *    -> { name: 'Agility', amount: 2, op: 'add' }. No recognized suffix ->
 *    amount 0, op 'add'.
 *  - kind 'qty' (inventory items): "Vials x30", "ropex5", "Torch X 2" add
 *    to an existing stack (or create one) -> { name, amount, op: 'add' }.
 *    "Rounds-10" subtracts from an existing stack instead ->
 *    { name: 'Rounds', amount: 10, op: 'subtract' }. No recognized suffix
 *    -> amount 1, op 'add' (matches the previous default of adding a new
 *    item at qty 1).
 *
 * Falls back to treating the whole input as the name when no suffix
 * matches, so plain "Perception" or "Rope" still works exactly as before.
 */
export function parseQuickAdd(raw, kind) {
  const text = (raw || '').trim();

  if (kind === 'qty') {
    const addMatch = text.match(/^(.*?)\s*[xX]\s*(\d+)\s*$/);
    if (addMatch && addMatch[1].trim()) {
      return { name: addMatch[1].trim(), amount: Math.max(1, parseInt(addMatch[2], 10)), op: 'add' };
    }
    const subMatch = text.match(/^(.*?)\s*-\s*(\d+)\s*$/);
    if (subMatch && subMatch[1].trim()) {
      return { name: subMatch[1].trim(), amount: Math.max(1, parseInt(subMatch[2], 10)), op: 'subtract' };
    }
    return { name: text, amount: 1, op: 'add' };
  }

  // kind === 'value' (default)
  const m = text.match(/^(.*?)\s*([+-]\s*\d+)\s*$/);
  if (m && m[1].trim()) {
    return { name: m[1].trim(), amount: parseInt(m[2].replace(/\s+/g, ''), 10), op: 'add' };
  }
  return { name: text, amount: 0, op: 'add' };
}

/**
 * Adds native HTML5 drag-and-drop reordering to a list of rows inside
 * `container`, matched by `rowSelector`. Attach this ONCE right after the
 * container is created (before the first render) — it uses event
 * delegation via closest(), so it keeps working across re-renders even
 * though row elements themselves get replaced each time.
 *
 * Rows should have `draggable = true` set only when reordering should be
 * allowed (e.g. edit mode); rows without it simply won't fire dragstart.
 *
 * @param {HTMLElement} container
 * @param {string} rowSelector - e.g. '.skill-row'
 * @param {Array} array - the backing array to reorder in place
 * @param {Function} onReorder - called with the reordered array so the
 *   caller can re-render and fire its own onChange
 * @param {'horizontal'|'vertical'} [orientation] - 'horizontal' (default)
 *   splits each row left/right for wrapping chip lists (skills,
 *   conditions) and applies .drag-over-before/.drag-over-after. 'vertical'
 *   splits top/bottom for stacked lists (shop inventory, owned items) and
 *   applies .drag-over-top/.drag-over-bottom instead.
 */
export function attachDragReorder(container, rowSelector, array, onReorder, orientation = 'horizontal') {
  let dragEl = null;
  let dragIndex = -1;
  const beforeClass = orientation === 'vertical' ? 'drag-over-top' : 'drag-over-before';
  const afterClass = orientation === 'vertical' ? 'drag-over-bottom' : 'drag-over-after';

  function rows() {
    return Array.from(container.querySelectorAll(rowSelector));
  }

  function clearIndicators() {
    rows().forEach((r) => r.classList.remove(beforeClass, afterClass));
  }

  function isBefore(e, rect) {
    return orientation === 'vertical'
      ? (e.clientY - rect.top) < rect.height / 2
      : (e.clientX - rect.left) < rect.width / 2;
  }

  container.addEventListener('dragstart', (e) => {
    const row = e.target.closest(rowSelector);
    if (!row || !container.contains(row) || row.draggable !== true) return;
    dragEl = row;
    dragIndex = rows().indexOf(row);
    row.classList.add('is-dragging');
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', String(dragIndex)); } catch (_) { /* Safari */ }
  });

  container.addEventListener('dragover', (e) => {
    if (!dragEl) return;
    const row = e.target.closest(rowSelector);
    if (!row || row === dragEl) return;
    e.preventDefault();
    const rect = row.getBoundingClientRect();
    const before = isBefore(e, rect);
    clearIndicators();
    row.classList.toggle(beforeClass, before);
    row.classList.toggle(afterClass, !before);
  });

  container.addEventListener('drop', (e) => {
    if (!dragEl) return;
    e.preventDefault();
    const row = e.target.closest(rowSelector);
    clearIndicators();

    if (row && row !== dragEl) {
      const list = rows();
      const overIndex = list.indexOf(row);
      const rect = row.getBoundingClientRect();
      const before = isBefore(e, rect);
      let targetIndex = before ? overIndex : overIndex + 1;
      if (dragIndex < targetIndex) targetIndex -= 1;

      const [moved] = array.splice(dragIndex, 1);
      array.splice(targetIndex, 0, moved);
      onReorder(array);
    }

    if (dragEl) dragEl.classList.remove('is-dragging');
    dragEl = null;
    dragIndex = -1;
  });

  container.addEventListener('dragend', () => {
    if (dragEl) dragEl.classList.remove('is-dragging');
    clearIndicators();
    dragEl = null;
    dragIndex = -1;
  });
}

/**
 * Makes a set of "chip" rows (skills, conditions, etc.) all share the same
 * fixed width — the minimum width that fits the widest one — so a wrapping
 * row of mods lines up neatly no matter how many chips end up sharing a
 * line. Call this after appending rows to the DOM (a requestAnimationFrame
 * after render is usually easiest, so layout has settled).
 *
 * @param {HTMLElement[]} rowEls
 */
export function equalizeRowWidths(rowEls) {
  if (!rowEls.length) return;
  rowEls.forEach((r) => { r.style.width = ''; });
  let max = 0;
  rowEls.forEach((r) => { max = Math.max(max, r.getBoundingClientRect().width); });
  const width = `${Math.ceil(max)}px`;
  rowEls.forEach((r) => { r.style.width = width; });
}
