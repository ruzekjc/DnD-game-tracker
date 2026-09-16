import { createSkillsList } from './SkillsList.js';
import { createPurseEditor } from './PurseEditor.js';
import { createConditionsList } from './ConditionsList.js';
import { showModal } from './modal.js';

/**
 * Renders a character sheet — single view, no flip. Inventory management
 * moved entirely to the bottom panel (buy/return/trade all happen there),
 * so this card only covers the sheet itself: identity, dice, conditions,
 * skills, level/EXP, and wallet (quick manual add/spend, separate from the
 * bottom panel's shop-driven transactions).
 */
export function createCharacterCard(character, onCharacterChange, onSaveRequest) {
  const card = document.createElement('div');
  card.className = 'char-card';

  const dice = character.dice || {};

  function notify() {
    if (onCharacterChange) onCharacterChange(character);
  }

  card.innerHTML = `
    <div class="card-name-bar">
      <h2 class="card-name-toggle">${character.name}</h2>
      ${onSaveRequest ? '<button class="save-btn">💾 Save</button>' : ''}
    </div>

    <div class="card-body">
      <div class="card-header">
        <p class="char-title">${character.title || ''}</p>
        <p class="char-subtitle">
          ${character.race || 'Unknown race'} —
          <span class="clickable-name" data-occupation>${character.occupation || 'Unknown occupation'}</span>
        </p>
      </div>

      <div class="section backstory-section">
        <h3>Backstory</h3>
        <p class="backstory-text">${character.backstory || 'No backstory written yet.'}</p>
        <button class="expand-btn">Expand</button>
      </div>

      <div class="section" data-race-section></div>
      <div class="section" data-character-section></div>
      <div class="section" data-occupation-section></div>

      <div class="section">
        <h3>Dice</h3>
        <div class="dice-grid">
          ${Object.entries(dice).map(([label, diceArr]) => {
            const display = (!diceArr || diceArr.length === 0) ? 'N/A' : diceArr.join(' + ');
            return `
              <div class="stat">
                <span class="stat-label">${label}</span>
                <span class="stat-die">${display}</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <div class="section">
        <h3>Conditions</h3>
        <div class="conditions-slot"></div>
      </div>

      <div class="section">
        <h3>Skills</h3>
        <div class="skills-slot"></div>
        <label class="edit-field">
          Skill Points:
          <input type="number" class="skillpoints-input" value="${character.skillPoints ?? 0}" />
        </label>
      </div>

      <div class="section level-row">
        <div><strong>Level:</strong> ${character.level}</div>
        <div class="exp-editor">
          <strong>EXP:</strong>
          <input type="number" class="exp-value-input" value="${character.exp?.value ?? 0}" />
          <span>/</span>
          <input type="number" class="exp-cap-input" value="${character.exp?.cap ?? 100}" />
        </div>
      </div>

      <div class="section">
        <h3>Wallet</h3>
        <div class="purse-slot"></div>
      </div>
    </div>
  `;

  // --- Clickable ability/passive helper (name + description objects) ---
  function createClickableRow(label, data) {
    const p = document.createElement('p');
    const strong = document.createElement('strong');
    strong.textContent = `${label}: `;
    const nameSpan = document.createElement('span');
    nameSpan.className = 'clickable-name';
    nameSpan.textContent = data?.name || '—';
    if (data?.description) {
      nameSpan.addEventListener('click', () => showModal(data.name, data.description));
    }
    p.appendChild(strong);
    p.appendChild(nameSpan);
    return p;
  }

  // --- Race section ---
  const raceContent = document.createElement('div');
  const raceHeading = document.createElement('h3');
  raceHeading.textContent = 'Race';
  raceContent.appendChild(raceHeading);

  const racialSkillsLabel = document.createElement('p');
  racialSkillsLabel.innerHTML = '<strong>Racial Skills:</strong>';
  raceContent.appendChild(racialSkillsLabel);

  const racialSkillsSlot = document.createElement('div');
  raceContent.appendChild(racialSkillsSlot);

  if (character.racialTraits && character.racialTraits.length) {
    const traitsP = document.createElement('p');
    traitsP.innerHTML = `<strong>Traits:</strong> ${character.racialTraits.join(', ')}`;
    raceContent.appendChild(traitsP);
  }

  raceContent.appendChild(createClickableRow('Passive', character.racialPassive));
  raceContent.appendChild(createClickableRow('Ability', character.racialAbility));
  card.querySelector('[data-race-section]').appendChild(raceContent);

  // --- Character section ---
  const charContent = document.createElement('div');
  const charHeading = document.createElement('h3');
  charHeading.textContent = 'Character';
  charContent.appendChild(charHeading);
  charContent.appendChild(createClickableRow('Passive', character.characterPassive));
  charContent.appendChild(createClickableRow('Ability', character.characterAbility));
  card.querySelector('[data-character-section]').appendChild(charContent);

  // --- Occupation section ---
  const occContent = document.createElement('div');
  const occHeading = document.createElement('h3');
  occHeading.textContent = 'Occupation Skills';
  occContent.appendChild(occHeading);
  const occSkillsSlot = document.createElement('div');
  occContent.appendChild(occSkillsSlot);
  card.querySelector('[data-occupation-section]').appendChild(occContent);

  const occNameEl = card.querySelector('[data-occupation]');
  if (character.occupationPassive) {
    occNameEl.addEventListener('click', () => {
      showModal(character.occupation, character.occupationPassive);
    });
  }

  // --- Editable-list sections (skills only — names editable via their own list UI) ---
  const racialSkillsEl = createSkillsList(character.racialSkills || [], (updated) => {
    character.racialSkills = updated;
    notify();
  });
  racialSkillsSlot.appendChild(racialSkillsEl);

  const occSkillsEl = createSkillsList(character.occupationSkills || [], (updated) => {
    character.occupationSkills = updated;
    notify();
  });
  occSkillsSlot.appendChild(occSkillsEl);

  const skillsEl = createSkillsList(character.skills || [], (updated) => {
    character.skills = updated;
    notify();
  });
  card.querySelector('.skills-slot').appendChild(skillsEl);

  // --- Conditions (toggleable, can carry a mod value + which stat they apply to) ---
  const conditionsSlot = card.querySelector('.conditions-slot');
  if (!character.conditions) character.conditions = [];
  const conditionsEl = createConditionsList(character.conditions, (updated) => {
    character.conditions = updated;
    notify();
  }, Object.keys(dice));
  conditionsSlot.appendChild(conditionsEl);

  // --- Purse editor ---
  const purseEl = createPurseEditor(character.coinPouch, (updatedPouch) => {
    character.coinPouch = updatedPouch;
    notify();
  });
  card.querySelector('.purse-slot').appendChild(purseEl);
  card.purseEl = purseEl; // exposed so main.js/BottomPanel can trigger a refresh after external edits (buy/trade)

  // --- Save ---
  const saveBtn = card.querySelector('.save-btn');
  if (saveBtn && onSaveRequest) {
    saveBtn.addEventListener('click', async () => {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving…';
      await onSaveRequest();
      saveBtn.disabled = false;
      saveBtn.textContent = '💾 Save';
    });
  }

  // --- Backstory expand ---
  const backstoryText = card.querySelector('.backstory-text');
  const expandBtn = card.querySelector('.expand-btn');
  expandBtn.addEventListener('click', () => {
    backstoryText.classList.toggle('expanded');
    expandBtn.textContent = backstoryText.classList.contains('expanded') ? 'Collapse' : 'Expand';
  });

  // --- Collapse/expand the whole sheet by clicking the name ---
  card.querySelector('.card-name-toggle').addEventListener('click', () => {
    card.classList.toggle('is-collapsed');
  });

  // --- Skill points / EXP ---
  card.querySelector('.skillpoints-input').addEventListener('input', (e) => {
    character.skillPoints = Number(e.target.value) || 0;
    notify();
  });
  card.querySelector('.exp-value-input').addEventListener('input', (e) => {
    character.exp.value = Number(e.target.value) || 0;
    notify();
  });
  card.querySelector('.exp-cap-input').addEventListener('input', (e) => {
    character.exp.cap = Number(e.target.value) || 0;
    notify();
  });

  return card;
}
