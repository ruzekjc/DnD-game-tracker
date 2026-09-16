// src/levelUpModal.js

import { getAllSkillRefs, applySkillPoint } from './progression.js';

/**
 * Shows the level-up popup: bump an existing skill by 1, or create a new
 * one at +1. Dismissing without choosing leaves the point banked in
 * character.skillPoints for later — spending it now is optional ("if they
 * want"), never forced.
 *
 * @param {Object} character
 * @param {Function} onClose - called once, after the modal is dismissed —
 *   whether a choice was applied or not — so the caller can refresh displays
 *   and show the next queued level-up popup if there is one.
 */
export function showLevelUpModal(character, onClose) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const box = document.createElement('div');
  box.className = 'modal-box level-up-box';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'modal-close';
  closeBtn.textContent = '✕';

  const heading = document.createElement('h3');
  heading.textContent = `🎉 ${character.name} reached Level ${character.level}!`;

  const skillRefs = getAllSkillRefs(character);

  const body = document.createElement('div');
  body.className = 'level-up-body';
  body.innerHTML = `
    <p>You have a skill point to allocate. Choose one, or close this to save it for later.</p>

    <div class="level-up-choice">
      <label class="level-up-radio">
        <input type="radio" name="level-up-mode" value="existing" ${skillRefs.length ? 'checked' : ''} ${skillRefs.length ? '' : 'disabled'} />
        Add +1 to an existing skill
      </label>
      <select class="level-up-existing-select" ${skillRefs.length ? '' : 'disabled'}>
        ${skillRefs
          .map(
            (s, i) => `<option value="${i}">${s.name} (currently ${s.value >= 0 ? '+' : ''}${s.value})</option>`
          )
          .join('')}
      </select>
    </div>

    <div class="level-up-choice">
      <label class="level-up-radio">
        <input type="radio" name="level-up-mode" value="new" ${skillRefs.length ? '' : 'checked'} />
        Create a new skill at +1
      </label>
      <input type="text" class="level-up-new-input" placeholder="New skill name..." />
    </div>

    <button class="level-up-confirm-btn save-btn">Apply</button>
  `;

  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    overlay.classList.remove('is-visible');
    setTimeout(() => overlay.remove(), 200);
    if (onClose) onClose();
  }

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  closeBtn.addEventListener('click', close);

  body.querySelector('.level-up-confirm-btn').addEventListener('click', () => {
    const mode = body.querySelector('input[name="level-up-mode"]:checked').value;

    if (mode === 'existing') {
      const idx = Number(body.querySelector('.level-up-existing-select').value);
      const ref = skillRefs[idx];
      if (ref) applySkillPoint(character, { mode: 'existing', key: ref.key, index: ref.index });
    } else {
      const name = body.querySelector('.level-up-new-input').value.trim();
      if (name) applySkillPoint(character, { mode: 'new', name });
    }

    close();
  });

  box.appendChild(closeBtn);
  box.appendChild(heading);
  box.appendChild(body);
  overlay.appendChild(box);

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('is-visible'));
}
