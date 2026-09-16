// src/newCharacterModal.js

/**
 * Collects the minimum fields a character needs to render safely on its own
 * card — everything else (skills, conditions, wallet transactions,
 * inventory) can be added afterward through the card's own editing UI once
 * the character actually exists.
 *
 * @param {Function} onCreate - (characterData) => void, called with the
 *   assembled character object when the DM confirms
 */
export function showNewCharacterModal(onCreate) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const box = document.createElement('div');
  box.className = 'modal-box new-character-box';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'modal-close';
  closeBtn.textContent = '✕';

  const heading = document.createElement('h3');
  heading.textContent = 'New Character';

  const body = document.createElement('div');
  body.className = 'new-character-body';
  body.innerHTML = `
    <label class="nc-field">
      Name *
      <input type="text" class="nc-name" />
    </label>
    <label class="nc-field">
      Title
      <input type="text" class="nc-title" />
    </label>
    <label class="nc-field">
      Race *
      <input type="text" class="nc-race" />
    </label>
    <label class="nc-field">
      Occupation *
      <input type="text" class="nc-occupation" />
    </label>
    <label class="nc-field">
      Backstory
      <textarea class="nc-backstory" rows="3"></textarea>
    </label>

    <div class="nc-row">
      <label class="nc-field">
        Level
        <input type="number" class="nc-level" value="1" min="1" />
      </label>
      <label class="nc-field">
        Skill Points
        <input type="number" class="nc-skillpoints" value="0" min="0" />
      </label>
      <label class="nc-field">
        EXP Cap
        <input type="number" class="nc-expcap" value="100" min="1" />
      </label>
    </div>

    <div class="nc-dice-section">
      <div class="nc-field-label">Dice Stats</div>
      <div class="nc-dice-rows"></div>
      <button type="button" class="import-btn nc-add-dice-btn">+ Add Stat</button>
    </div>

    <p class="nc-note">
      Skills, conditions, wallet, and inventory can all be added once the character is created.
    </p>

    <div class="nc-error" style="display: none;"></div>
    <button class="save-btn nc-create-btn">Create Character</button>
  `;

  const diceRowsEl = body.querySelector('.nc-dice-rows');

  function addDiceRow() {
    const row = document.createElement('div');
    row.className = 'nc-dice-row';
    row.innerHTML = `
      <input type="text" class="nc-dice-name" placeholder="Stat name (e.g. Muscle)" />
      <input type="text" class="nc-dice-value" placeholder="Dice (e.g. d6,d8)" />
      <button type="button" class="nc-remove-dice-btn">✕</button>
    `;
    row.querySelector('.nc-remove-dice-btn').addEventListener('click', () => row.remove());
    diceRowsEl.appendChild(row);
  }
  addDiceRow(); // one blank row to start, for convenience

  body.querySelector('.nc-add-dice-btn').addEventListener('click', addDiceRow);

  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    overlay.classList.remove('is-visible');
    setTimeout(() => overlay.remove(), 200);
  }

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  closeBtn.addEventListener('click', close);

  body.querySelector('.nc-create-btn').addEventListener('click', () => {
    const name = body.querySelector('.nc-name').value.trim();
    const race = body.querySelector('.nc-race').value.trim();
    const occupation = body.querySelector('.nc-occupation').value.trim();
    const errorEl = body.querySelector('.nc-error');

    if (!name || !race || !occupation) {
      errorEl.textContent = 'Name, Race, and Occupation are required.';
      errorEl.style.display = 'block';
      return;
    }

    const dice = {};
    diceRowsEl.querySelectorAll('.nc-dice-row').forEach((row) => {
      const statName = row.querySelector('.nc-dice-name').value.trim();
      const diceStr = row.querySelector('.nc-dice-value').value.trim();
      if (statName && diceStr) {
        dice[statName] = diceStr
          .split(',')
          .map((d) => d.trim())
          .filter(Boolean);
      }
    });

    const character = {
      name,
      title: body.querySelector('.nc-title').value.trim(),
      race,
      occupation,
      backstory: body.querySelector('.nc-backstory').value.trim(),
      level: Number(body.querySelector('.nc-level').value) || 1,
      skillPoints: Number(body.querySelector('.nc-skillpoints').value) || 0,
      exp: { value: 0, cap: Number(body.querySelector('.nc-expcap').value) || 100 },
      dice,
      racialSkills: [],
      occupationSkills: [],
      skills: [],
      conditions: [],
      inventory: [],
      coinPouch: { platinum: 0, gold: 0, silver: 0, copper: 0 }
    };

    close();
    onCreate(character);
  });

  box.appendChild(closeBtn);
  box.appendChild(heading);
  box.appendChild(body);
  overlay.appendChild(box);

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('is-visible'));
}
