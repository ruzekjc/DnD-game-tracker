import { createSkillsList } from './SkillsList.js';
import { createPurseEditor } from './PurseEditor.js';
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
        <div class="card-name-bar">
          <button class="flip-btn">Inventory →</button>
          <h2 class="card-name-toggle">${character.name}</h2>
        </div>

        <div class="card-body">
          <div class="card-header">
            <p class="char-title">${character.title || ''}</p>
            <p class="char-subtitle">
              ${character.race} —
              <span class="clickable-name" data-occupation>${character.occupation}</span>
            </p>
          </div>

          <div class="section backstory-section">
            <h3>Backstory</h3>
            <p class="backstory-text">${character.backstory}</p>
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
            <div><strong>Level:</strong> ${character.level}</div>
            <div class="exp-editor">
              <strong>EXP:</strong>
              <input type="number" class="exp-value-input" value="${character.exp?.value ?? 0}" />
              <span>/</span>
              <input type="number" class="exp-cap-input" value="${character.exp?.cap ?? 100}" />
            </div>
          </div>
        </div>
      </div>

      <div class="char-card-face char-card-back">
        <div class="card-name-bar">
          <button class="flip-btn">← Sheet</button>
          <h2 class="card-name-toggle">${character.name}'s Inventory</h2>
        </div>

        <div class="card-body">
          <div class="purse-slot"></div>
          <div class="inventory-slot"></div>
        </div>
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

  // --- Purse editor ---
  const purseEl = createPurseEditor(character.coinPouch, (updatedPouch) => {
    character.coinPouch = updatedPouch;
    notify();
  });
  card.querySelector('.purse-slot').appendChild(purseEl);

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

  // --- Collapse/expand whole card by clicking the name (either face) ---
  card.querySelectorAll('.card-name-toggle').forEach(nameEl => {
    nameEl.addEventListener('click', () => {
      card.classList.toggle('is-collapsed');
      syncCardHeight(card);
    });
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

  const observer = new MutationObserver(() => syncCardHeight(card));
  observer.observe(inventoryElement, { childList: true, subtree: true });
  observer.observe(card.querySelector('.skills-slot'), { childList: true, subtree: true });
  observer.observe(racialSkillsSlot, { childList: true, subtree: true });
  observer.observe(occSkillsSlot, { childList: true, subtree: true });

  requestAnimationFrame(() => syncCardHeight(card));

  return card;
}

function syncCardHeight(card) {
  const inner = card.querySelector('.char-card-inner');

  if (card.classList.contains('is-collapsed')) {
    const frontBar = card.querySelector('.char-card-front .card-name-bar');
    const backBar = card.querySelector('.char-card-back .card-name-bar');
    const tallest = Math.max(frontBar.scrollHeight, backBar.scrollHeight) + 32; // padding buffer
    inner.style.height = `${tallest}px`;
    card.style.height = `${tallest}px`;
    return;
  }

  const front = card.querySelector('.char-card-front');
  const back = card.querySelector('.char-card-back');
  const tallest = Math.max(front.scrollHeight, back.scrollHeight);
  inner.style.height = `${tallest}px`;
  card.style.height = `${tallest}px`;
}