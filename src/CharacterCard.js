import { createSkillsList } from './SkillsList.js';
import { createPurseEditor } from './PurseEditor.js';
import { createConditionsList } from './ConditionsList.js';
import { showModal, showEditableModal } from './modal.js';

/**
 * Renders a character sheet — single view, no flip. Inventory management
 * moved entirely to the bottom panel (buy/return/trade all happen there),
 * so this card only covers the sheet itself: identity, dice, conditions,
 * skills, level/EXP, and wallet (quick manual add/spend, separate from the
 * bottom panel's shop-driven transactions).
 *
 * Edit mode: a pencil toggle in the header switches the whole card between
 * a clean read-only VIEW mode (for actual play) and an EDIT mode that
 * unlocks inline editing of name/title/race/occupation/backstory/dice/
 * traits, ability & passive name+description (via a popup), and hands an
 * "editable" flag down into the skills/conditions lists (which stay
 * read-only for names but keep their +/- and toggle controls live either
 * way, since those get used mid-session).
 *
 * @param {Object} character
 * @param {Function} [onCharacterChange]
 * @param {Function} [onSaveRequest]
 * @param {Function} [onClose] - called when the ✕ close button is clicked
 *   (the single-character panel just deselects; the card/data isn't lost).
 */
export function createCharacterCard(character, onCharacterChange, onSaveRequest, onClose) {
  const card = document.createElement('div');
  card.className = 'char-card';

  let isEditMode = false;
  const dice = character.dice || {};

  function notify() {
    if (onCharacterChange) onCharacterChange(character);
  }

  card.innerHTML = `
    <div class="card-name-bar">
      <h2 class="card-name-toggle editable-field" data-editable="name">${character.name}</h2>
      <div class="card-name-bar-actions">
        <button class="edit-mode-btn" title="Toggle edit mode" type="button">✏️ Edit</button>
        ${onSaveRequest ? '<button class="save-btn">💾 Save</button>' : ''}
        ${onClose ? '<button class="close-card-btn" title="Close character" type="button">✕</button>' : ''}
      </div>
    </div>

    <div class="card-body">
      <div class="card-header">
        <p class="char-title editable-field" data-editable="title">${character.title || ''}</p>
        <p class="char-subtitle">
          <span class="char-race editable-field" data-editable="race">${character.race || 'Unknown race'}</span> —
          <span class="clickable-name" data-occupation>${character.occupation || 'Unknown occupation'}</span>
        </p>
      </div>

      <div class="section backstory-section">
        <h3>Backstory</h3>
        <p class="backstory-text editable-field multiline" data-editable="backstory">${character.backstory || 'No backstory written yet.'}</p>
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
                <span class="stat-die editable-field" data-editable="dice" data-dice-label="${label}">${display}</span>
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
  // In edit mode, clicking opens an editable popup (name + description)
  // that writes back into `character[field]`; in view mode it behaves as
  // before (read-only popup, only clickable if a description exists).
  const abilityRowRefreshers = [];

  function createClickableRow(label, field) {
    const p = document.createElement('p');
    const strong = document.createElement('strong');
    strong.textContent = `${label}: `;
    const nameSpan = document.createElement('span');
    nameSpan.className = 'clickable-name';

    function refreshLabel() {
      const data = character[field];
      nameSpan.textContent = data?.name || (isEditMode ? '— (click to add)' : '—');
    }
    refreshLabel();
    abilityRowRefreshers.push(refreshLabel);

    nameSpan.addEventListener('click', () => {
      const data = character[field] || {};
      if (isEditMode) {
        showEditableModal(data.name || '', data.description || '', (newName, newDescription) => {
          character[field] = { name: newName, description: newDescription };
          refreshLabel();
          notify();
        });
      } else if (data.description) {
        showModal(data.name, data.description);
      }
    });

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

  const traitsP = document.createElement('p');
  traitsP.innerHTML = '<strong>Traits:</strong> ';
  const traitsSpan = document.createElement('span');
  traitsSpan.className = 'editable-field';
  traitsSpan.setAttribute('data-editable', 'traits');
  traitsSpan.textContent = (character.racialTraits && character.racialTraits.length)
    ? character.racialTraits.join(', ')
    : (isEditMode ? '(click to add traits)' : 'None');
  traitsP.appendChild(traitsSpan);
  raceContent.appendChild(traitsP);

  raceContent.appendChild(createClickableRow('Passive', 'racialPassive'));
  raceContent.appendChild(createClickableRow('Ability', 'racialAbility'));
  card.querySelector('[data-race-section]').appendChild(raceContent);

  // --- Character section ---
  const charContent = document.createElement('div');
  const charHeading = document.createElement('h3');
  charHeading.textContent = 'Character';
  charContent.appendChild(charHeading);
  charContent.appendChild(createClickableRow('Passive', 'characterPassive'));
  charContent.appendChild(createClickableRow('Ability', 'characterAbility'));
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
  occNameEl.addEventListener('click', () => {
    if (isEditMode) {
      showEditableModal(character.occupation || '', character.occupationPassive || '', (newName, newDescription) => {
        character.occupation = newName;
        character.occupationPassive = newDescription;
        occNameEl.textContent = character.occupation || 'Unknown occupation';
        notify();
      });
    } else if (character.occupationPassive) {
      showModal(character.occupation, character.occupationPassive);
    }
  });

  // --- Editable-list sections (skills only — names editable via their own list UI) ---
  const racialSkillsEl = createSkillsList(character.racialSkills || [], (updated) => {
    character.racialSkills = updated;
    notify();
  }, () => isEditMode);
  racialSkillsSlot.appendChild(racialSkillsEl);

  const occSkillsEl = createSkillsList(character.occupationSkills || [], (updated) => {
    character.occupationSkills = updated;
    notify();
  }, () => isEditMode);
  occSkillsSlot.appendChild(occSkillsEl);

  const skillsEl = createSkillsList(character.skills || [], (updated) => {
    character.skills = updated;
    notify();
  }, () => isEditMode);
  card.querySelector('.skills-slot').appendChild(skillsEl);

  // --- Conditions (toggleable, can carry a mod value + which stat they apply to) ---
  const conditionsSlot = card.querySelector('.conditions-slot');
  if (!character.conditions) character.conditions = [];
  const conditionsEl = createConditionsList(character.conditions, (updated) => {
    character.conditions = updated;
    notify();
  }, Object.keys(dice), () => isEditMode);
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

  // --- Close ---
  const closeBtn = card.querySelector('.close-card-btn');
  if (closeBtn && onClose) {
    closeBtn.addEventListener('click', () => onClose());
  }

  // --- Backstory expand ---
  const backstoryText = card.querySelector('.backstory-text');
  const expandBtn = card.querySelector('.expand-btn');
  expandBtn.addEventListener('click', () => {
    backstoryText.classList.toggle('expanded');
    expandBtn.textContent = backstoryText.classList.contains('expanded') ? 'Collapse' : 'Expand';
  });

  // --- Collapse/expand the whole sheet by clicking the name (view mode only —
  // in edit mode a name click should just place the cursor to rename) ---
  const nameToggle = card.querySelector('.card-name-toggle');
  nameToggle.addEventListener('click', () => {
    if (!isEditMode) card.classList.toggle('is-collapsed');
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

  // --- Edit mode toggle ---
  // Simple text fields (name/title/race/backstory/dice notation/traits) are
  // wired up once here, gated live by toggling their contentEditable
  // attribute — no need to rebuild them on every edit-mode flip.
  const editableFieldEls = Array.from(card.querySelectorAll('[data-editable]'));

  function commitDiceField(el) {
    const label = el.getAttribute('data-dice-label');
    const raw = el.textContent.trim();
    const parts = raw.split('+').map((s) => s.trim()).filter(Boolean);
    character.dice[label] = raw === 'N/A' ? [] : parts;
    if (parts.length === 0 && raw !== 'N/A') el.textContent = 'N/A';
  }

  function commitTraitsField(el) {
    const parts = el.textContent.split(',').map((s) => s.trim()).filter(Boolean);
    character.racialTraits = parts;
    if (!parts.length) el.textContent = isEditMode ? '(click to add traits)' : 'None';
  }

  editableFieldEls.forEach((el) => {
    const kind = el.getAttribute('data-editable');

    el.addEventListener('blur', () => {
      switch (kind) {
        case 'name':
          character.name = el.textContent.trim() || character.name;
          el.textContent = character.name;
          notify();
          break;
        case 'title':
          character.title = el.textContent.trim();
          notify();
          break;
        case 'race':
          character.race = el.textContent.trim() || 'Unknown race';
          notify();
          break;
        case 'backstory':
          character.backstory = el.textContent.trim();
          notify();
          break;
        case 'dice':
          commitDiceField(el);
          notify();
          break;
        case 'traits':
          commitTraitsField(el);
          notify();
          break;
        default:
          break;
      }
    });

    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !el.classList.contains('multiline')) {
        e.preventDefault();
        el.blur();
      }
    });
  });

  function applyEditMode() {
    card.classList.toggle('is-edit-mode', isEditMode);
    editModeBtn.textContent = isEditMode ? '✅ Done' : '✏️ Edit';
    editableFieldEls.forEach((el) => { el.contentEditable = isEditMode ? 'true' : 'false'; });
    // Placeholder text swap for empty traits when toggling modes
    if (!character.racialTraits || !character.racialTraits.length) {
      traitsSpan.textContent = isEditMode ? '(click to add traits)' : 'None';
    }
    racialSkillsEl.refresh();
    occSkillsEl.refresh();
    skillsEl.refresh();
    conditionsEl.refresh();
    abilityRowRefreshers.forEach((fn) => fn());
  }

  const editModeBtn = card.querySelector('.edit-mode-btn');
  editModeBtn.addEventListener('click', () => {
    isEditMode = !isEditMode;
    applyEditMode();
  });

  applyEditMode();

  return card;
}
