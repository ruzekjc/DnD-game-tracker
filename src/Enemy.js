// src/Enemy.js

import { createConditionsList } from './ConditionsList.js';
import { attachDiceRoller } from './diceRoller.js';
import { getEnemyModBreakdown } from './mods.js';

const TIER_LABELS = {
  basic: 'Basic',
  enforcer: 'Enforcer',
  boss: 'Boss'
};

/**
 * Renders an enemy stat block: clickable dice (rolls + a manual mod
 * checklist, same as characters — see diceRoller.js), a static mods summary
 * for quick reference, and a shared conditions list.
 *
 * @param {Object} enemy - { name, tier, dice, mods, conditions }
 * @param {Function} [onChange] - fired when conditions change
 * @param {Function} [onSaveRequest] - fired when the Save button is clicked; omit to hide it
 */
export function createEnemyView(enemy, onChange, onSaveRequest) {
  const container = document.createElement('div');
  container.className = 'enemy-view';

  const dice = enemy.dice || {};
  const tierLabel = TIER_LABELS[enemy.tier] || enemy.tier || 'Unknown';

  const header = document.createElement('div');
  header.className = 'enemy-header';
  header.innerHTML = `
    <h3 class="enemy-name">${enemy.name}</h3>
    <span class="enemy-tier-badge enemy-tier-${enemy.tier || 'unknown'}">${tierLabel}</span>
    ${onSaveRequest ? '<button class="save-btn enemy-save-btn">💾 Save</button>' : ''}
  `;
  container.appendChild(header);

  const saveBtn = header.querySelector('.save-btn');
  if (saveBtn && onSaveRequest) {
    saveBtn.addEventListener('click', async () => {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving…';
      await onSaveRequest();
      saveBtn.disabled = false;
      saveBtn.textContent = '💾 Save';
    });
  }

  const statSection = document.createElement('div');
  statSection.className = 'section';
  statSection.innerHTML = `
    <h3>Stats</h3>
    <div class="dice-grid">
      ${Object.entries(dice).map(([label, diceArr]) => {
        const display = (!diceArr || diceArr.length === 0) ? 'N/A' : diceArr.join(' + ');
        return `
          <button class="stat stat-roll-btn" data-stat="${label}" type="button">
            <span class="stat-label">${label}</span>
            <span class="stat-die">${display}</span>
          </button>
        `;
      }).join('')}
    </div>
    <div class="roll-result" style="display: none;"></div>
  `;
  container.appendChild(statSection);

  if (enemy.mods && enemy.mods.length) {
    const modsSection = document.createElement('div');
    modsSection.className = 'section';
    const modsText = enemy.mods
      .map((m) => `${m.stat} ${m.value >= 0 ? '+' : ''}${m.value}`)
      .join(', ');
    modsSection.innerHTML = `
      <h3>Mods</h3>
      <p class="enemy-mods-list">${modsText}</p>
    `;
    container.appendChild(modsSection);
  }

  const conditionsSection = document.createElement('div');
  conditionsSection.className = 'section';
  const conditionsHeading = document.createElement('h3');
  conditionsHeading.textContent = 'Conditions';
  conditionsSection.appendChild(conditionsHeading);

  if (!enemy.conditions) enemy.conditions = [];
  const conditionsEl = createConditionsList(
    enemy.conditions,
    (updated) => {
      enemy.conditions = updated;
      if (onChange) onChange(enemy);
    },
    Object.keys(dice)
  );
  conditionsSection.appendChild(conditionsEl);
  container.appendChild(conditionsSection);

  const diceGridEl = statSection.querySelector('.dice-grid');
  const rollResultEl = statSection.querySelector('.roll-result');
  attachDiceRoller(diceGridEl, rollResultEl, dice, (statLabel) => getEnemyModBreakdown(enemy, statLabel));

  return container;
}
