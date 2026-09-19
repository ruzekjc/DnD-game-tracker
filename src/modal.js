export function showModal(title, description) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const box = document.createElement('div');
  box.className = 'modal-box';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'modal-close';
  closeBtn.textContent = '✕';

  const heading = document.createElement('h3');
  heading.textContent = title;

  const body = document.createElement('p');
  body.textContent = description;

  box.appendChild(closeBtn);
  box.appendChild(heading);
  box.appendChild(body);
  overlay.appendChild(box);

  function close() {
    overlay.classList.remove('is-visible');
    setTimeout(() => overlay.remove(), 200);
  }

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  closeBtn.addEventListener('click', close);

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('is-visible'));
}

/**
 * Same popup, but with an editable name field + description textarea and a
 * Save button, for editing abilities/passives (name + description pairs)
 * while in edit mode. onSave(newName, newDescription) fires on Save only —
 * closing without saving (✕ or backdrop click) discards changes.
 */
export function showEditableModal(title, description, onSave) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const box = document.createElement('div');
  box.className = 'modal-box modal-box-editable';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'modal-close';
  closeBtn.textContent = '✕';

  const titleInput = document.createElement('input');
  titleInput.type = 'text';
  titleInput.className = 'modal-edit-title';
  titleInput.placeholder = 'Name';
  titleInput.value = title || '';

  const descArea = document.createElement('textarea');
  descArea.className = 'modal-edit-desc';
  descArea.placeholder = 'Description';
  descArea.value = description || '';

  const saveBtn = document.createElement('button');
  saveBtn.className = 'modal-save-btn';
  saveBtn.textContent = '💾 Save';

  box.appendChild(closeBtn);
  box.appendChild(titleInput);
  box.appendChild(descArea);
  box.appendChild(saveBtn);
  overlay.appendChild(box);

  function close() {
    overlay.classList.remove('is-visible');
    setTimeout(() => overlay.remove(), 200);
  }

  saveBtn.addEventListener('click', () => {
    if (onSave) onSave(titleInput.value.trim(), descArea.value.trim());
    close();
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  closeBtn.addEventListener('click', close);

  document.body.appendChild(overlay);
  requestAnimationFrame(() => {
    overlay.classList.add('is-visible');
    titleInput.focus();
  });
}
