import { createSkillsList } from './SkillsList.js';
import { createPurseEditor } from './PurseEditor.js';
import { makeEditable } from './utils.js';
import { showModal } from './modal.js';

export function createCharacterCard(character, inventoryElement, onCharacterChange) {
  const card = document.createElement('div');
  card.className = 'char-card';

  const dice = character.dice || {};

  function notify() {
    if (onCharacterChange) onCharacterChange(character);
  }

  card.innerHTML = `
    <div class="char-card-inner">
      <div class="char-card-face char-card-front">
        <button class="flip-btn flip-btn-top">Inventory →</button>

        <div class="card-header">
          <h2 class="editable-text" data-field="name">${character.name}</h2>
          <p class="char-title editable-text" data-field="title">${character.title || ''}</p>
          <p class="char-subtitle">
            <span class="editable-text" data-field="race">${character.race}</span> —
            <span class="clickable-name" data-occupation>${character.occupation}</span>
          </p>
        </div>

        <div class="section backstory-section">
          <h3>Backstory</h3>
          <p class="backstory-text editable-text multiline" data-field="backstory">${character.backstory}</p>
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
          <h3>Skills</h3>
          <div class="skills-slot"></div>
          <label class="edit-field">
            Skill Points:
            <input type="number" class="skillpoints-input" value="${character.skillPoints ?? 0}" />
          </label>
        </div>

        <div class="section level-row">
          <div><strong>Level:</strong> <span class="editable-text" data-field="level">${character.level}</span></div>
          <label class="edit-field">
            EXP:
            <input type="number" class="exp-input" value="${character.exp ?? 0}" />
          </label>
        </div>
      </div>

      <div class="char-card-face char-card-back">
        <button class="flip-btn flip-btn-top">← Sheet</button>
        <h2>${character.name}'s Inventory</h2>
        <div class="purse-slot"></div>
        <div class="inventory-slot"></div>
      </div>
    </div>
  `;

  card.querySelector('.inventory-slot').appendChild(inventoryElement);

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

  // --- Race section (hideable): racial skills as editable list + passive/ability popups ---
  const raceContent = document.createElement('div');
  const raceHeading = document.createElement('h3');
  raceHeading.textContent = 'Race';
  raceContent.appendChild(raceHeading);

  const racialSkillsLabel = document.createElement('p');
  racialSkillsLabel.innerHTML = '<strong>Racial Skills:</strong>';
  raceContent.appendChild(racialSkillsLabel);

  const racialSkillsSlot = document.createElement('div');
  raceContent.appendChild(racialSkillsSlot);

  raceContent.appendChild(createClickableRow('Passive', character.racialPassive));
  raceContent.appendChild(createClickableRow('Ability', character.racialAbility));
  card.querySelector('[data-race-section]').appendChild(raceContent);

  // --- Character section (hideable) ---
  const charContent = document.createElement('div');
  const charHeading = document.createElement('h3');
  charHeading.textContent = 'Character';
  charContent.appendChild(charHeading);
  charContent.appendChild(createClickableRow('Passive', character.characterPassive));
  charContent.appendChild(createClickableRow('Ability', character.characterAbility));
  card.querySelector('[data-character-section]').appendChild(charContent);

  // --- Occupation section: occupation skills as editable list ---
  const occContent = document.createElement('div');
  const occHeading = document.createElement('h3');
  occHeading.textContent = 'Occupation Skills';
  occContent.appendChild(occHeading);
  const occSkillsSlot = document.createElement('div');
  occContent.appendChild(occSkillsSlot);
  card.querySelector('[data-occupation-section]').appendChild(occContent);

  // Occupation name (in header) is clickable → shows occupationPassive
  const occNameEl = card.querySelector('[data-occupation]');
  if (character.occupationPassive) {
    occNameEl.addEventListener('click', () => {
      showModal(character.occupation, character.occupationPassive);
    });
  }

  // --- Editable-list sections: racialSkills, occupationSkills, skills ---
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

  // --- Purse editor — top of inventory face ---
  const purseEl = createPurseEditor(character.coinPouch, (updatedPouch) => {
    character.coinPouch = updatedPouch;
    notify();
  });
  card.querySelector('.purse-slot').appendChild(purseEl);

  // --- Editable text fields ---
  card.querySelectorAll('[data-field]').forEach(el => {
    makeEditable(el, (newText) => {
      const field = el.dataset.field;
      character[field] = field === 'level' ? Number(newText) || 0 : newText;
      notify();
      syncCardHeight(card);
    });
  });

  // --- Flip behavior ---
  card.querySelectorAll('.flip-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      card.classList.toggle('is-flipped');
      syncCardHeight(card);
    });
  });

  // --- Backstory expand ---
  const backstoryText = card.querySelector('.backstory-text');
  const expandBtn = card.querySelector('.expand-btn');
  expandBtn.addEventListener('click', () => {
    backstoryText.classList.toggle('expanded');
    expandBtn.textContent = backstoryText.classList.contains('expanded') ? 'Collapse' : 'Expand';
    syncCardHeight(card);
  });

  // --- EXP / Skill Points ---
  card.querySelector('.exp-input').addEventListener('input', (e) => {
    character.exp = Number(e.target.value) || 0;
    notify();
  });
  card.querySelector('.skillpoints-input').addEventListener('input', (e) => {
    character.skillPoints = Number(e.target.value) || 0;
    notify();
  });

  const observer = new MutationObserver(() => syncCardHeight(card));
  observer.observe(inventoryElement, { childList: true, subtree: true });
  observer.observe(card.querySelector('.skills-slot'), { childList: true, subtree: true });
  observer.observe(racialSkillsSlot, { childList: true, subtree: true });
  observer.observe(occSkillsSlot, { childList: true, subtree: true });

  requestAnimationFrame(() => syncCardHeight(card));

  return card;
}

function syncCardHeight(card) {
  const front = card.querySelector('.char-card-front');
  const back = card.querySelector('.char-card-back');
  const inner = card.querySelector('.char-card-inner');

  const tallest = Math.max(front.scrollHeight, back.scrollHeight);
  inner.style.height = `${tallest}px`;
  card.style.height = `${tallest}px`;
}