// src/Enemy.js

import { createConditionsList } from './ConditionsList.js';
import { attachDiceRoller } from './diceRoller.js';
import { getEnemyModBreakdown } from './mods.js';

const TIER_LABELS = {
  basic: 'Basic',
  enforcer: 'Enforcer',
  boss: 'Boss'
};

// Bosses are explicitly excluded from tier templates per the spec — their
// stat blocks are meant to be unique/auto-generated, not shared.
const TEMPLATE_ELIGIBLE_TIERS = ['basic', 'enforcer'];

/**
 * Renders an enemy stat block: clickable dice (rolls + a manual mod
 * checklist, same as characters — see diceRoller.js), a static mods summary
 * for quick reference, and a shared conditions list.
 *
 * Basic/Enforcer enemies can omit their own dice/mods entirely and inherit
 * a shared tier template instead ("flat shared stat sheet" per the spec) —
 * an enemy's own dice/mods, if present, always take priority over the
 * template. Boss-tier enemies never use templates.
 *
 * @param {Object} enemy - { name, tier, dice, mods, conditions }
 * @param {Function} [onChange] - fired when conditions change
 * @param {Function} [onSaveRequest] - fired when the Save button is clicked; omit to hide it
 * @param {Object} [handlers] - { getTierTemplate, onImportTierTemplates }
 *   getTierTemplate(tier) => { dice, mods } | null. onImportTierTemplates is
 *   () => Promise, fired by the "+ Import Tier Templates" button.
 */
export function createEnemyView(enemy, onChange, onSaveRequest, handlers = {}) {
  const { getTierTemplate, onImportTierTemplates } = handlers;
  const container = document.createElement('div');
  container.className = 'enemy-view';

  const usesTemplates = TEMPLATE_ELIGIBLE_TIERS.includes(enemy.tier);
  const template = usesTemplates && getTierTemplate ? getTierTemplate(enemy.tier) : null;

  const hasOwnDice = enemy.dice && Object.keys(enemy.dice).length;
  const hasOwnMods = enemy.mods && enemy.mods.length;

  const effectiveDice = hasOwnDice ? enemy.dice : (template && template.dice) || {};
  const effectiveMods = hasOwnMods ? enemy.mods : (template && template.mods) || [];
  const usingTemplate = usesTemplates && !hasOwnDice && !hasOwnMods && template;

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

  // --- Tier template status (Basic/Enforcer only) ---
  if (usesTemplates) {
    const templateSection = document.createElement('div');
    templateSection.className = 'section enemy-template-section';

    const statusText = template
      ? usingTemplate
        ? `Using the shared "${tierLabel}" tier template — this enemy defines no stats of its own.`
        : `A "${tierLabel}" tier template is loaded, but this enemy's own dice/mods override it.`
      : `No tier template imported for "${tierLabel}" yet — this enemy needs its own dice/mods until one is.`;

    templateSection.innerHTML = `
      <p class="enemy-template-note">${statusText}</p>
      ${onImportTierTemplates ? '<button class="import-btn enemy-import-template-btn">+ Import Tier Templates</button>' : ''}
    `;

    const importBtn = templateSection.querySelector('.enemy-import-template-btn');
    if (importBtn) {
      importBtn.addEventListener('click', () => onImportTierTemplates());
    }

    container.appendChild(templateSection);
  }

  const statSection = document.createElement('div');
  statSection.className = 'section';
  statSection.innerHTML = `
    <h3>Stats</h3>
    <div class="dice-grid">
      ${Object.entries(effectiveDice).map(([label, diceArr]) => {
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

  if (effectiveMods.length) {
    const modsSection = document.createElement('div');
    modsSection.className = 'section';
    const modsText = effectiveMods
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
    Object.keys(effectiveDice)
  );
  conditionsSection.appendChild(conditionsEl);
  container.appendChild(conditionsSection);

  // effectiveEnemy shares enemy.conditions by reference (shallow spread),
  // so condition toggles still mutate the real enemy object — only dice/mods
  // are swapped in for the template fallback.
  const effectiveEnemy = { ...enemy, dice: effectiveDice, mods: effectiveMods };
  const diceGridEl = statSection.querySelector('.dice-grid');
  const rollResultEl = statSection.querySelector('.roll-result');
  attachDiceRoller(diceGridEl, rollResultEl, effectiveDice, (statLabel) =>
    getEnemyModBreakdown(effectiveEnemy, statLabel)
  );

  return container;
}
