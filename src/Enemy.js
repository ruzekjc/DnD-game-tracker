// src/Enemy.js

import { createConditionsList } from './ConditionsList.js';
import { createSkillsList } from './SkillsList.js';
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
 * checklist, same as characters — see diceRoller.js) in view mode, a
 * draggable/editable mods list (same component as character skills), and a
 * shared conditions list.
 *
 * Basic/Enforcer enemies can omit their own dice/mods entirely and inherit
 * a shared tier template instead ("flat shared stat sheet" per the spec) —
 * an enemy's own dice/mods, if present, always take priority over the
 * template. Boss-tier enemies never use templates.
 *
 * Edit mode (same pattern as CharacterCard/Shop): a pencil toggle unlocks
 * the enemy's name and dice notation for inline editing, and switches the
 * mods list into its editable/draggable form. The FIRST edit to a
 * template-inheriting enemy forks the template's dice/mods into the
 * enemy's own — editing must never mutate the shared template object that
 * other enemies of the same tier still read from.
 *
 * @param {Object} enemy - { name, tier, dice, mods, conditions }
 * @param {Function} [onChange] - fired when conditions/dice/mods/name change
 * @param {Function} [onSaveRequest] - fired when the Save button is clicked; omit to hide it
 * @param {Object} [handlers] - { getTierTemplate, onImportTierTemplates }
 *   getTierTemplate(tier) => { dice, mods } | null. onImportTierTemplates is
 *   () => Promise, fired by the "+ Import Tier Templates" button.
 */
export function createEnemyView(enemy, onChange, onSaveRequest, handlers = {}) {
  const { getTierTemplate, onImportTierTemplates } = handlers;
  const container = document.createElement('div');
  container.className = 'enemy-view';

  let isEditMode = false;

  function notify() {
    if (onChange) onChange(enemy);
  }

  const usesTemplates = TEMPLATE_ELIGIBLE_TIERS.includes(enemy.tier);
  const template = usesTemplates && getTierTemplate ? getTierTemplate(enemy.tier) : null;

  function hasOwnDice() { return enemy.dice && Object.keys(enemy.dice).length; }
  function hasOwnMods() { return enemy.mods && enemy.mods.length; }
  function effectiveDice() { return hasOwnDice() ? enemy.dice : (template && template.dice) || {}; }
  function effectiveMods() { return hasOwnMods() ? enemy.mods : (template && template.mods) || []; }
  function usingTemplate() { return usesTemplates && !hasOwnDice() && !hasOwnMods() && template; }

  const tierLabel = TIER_LABELS[enemy.tier] || enemy.tier || 'Unknown';

  const header = document.createElement('div');
  header.className = 'enemy-header';
  header.innerHTML = `
    <h3 class="enemy-name editable-field" data-editable="name">${enemy.name}</h3>
    <span class="enemy-tier-badge enemy-tier-${enemy.tier || 'unknown'}">${tierLabel}</span>
    <div class="enemy-header-actions">
      <button class="edit-mode-btn" type="button">✏️ Edit</button>
      ${onSaveRequest ? '<button class="save-btn enemy-save-btn">💾 Save</button>' : ''}
    </div>
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

  const nameEl = header.querySelector('.enemy-name');
  nameEl.addEventListener('blur', () => {
    enemy.name = nameEl.textContent.trim() || enemy.name;
    notify();
  });
  nameEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); nameEl.blur(); }
  });

  // --- Tier template status (Basic/Enforcer only) ---
  let templateSection = null;
  if (usesTemplates) {
    templateSection = document.createElement('div');
    templateSection.className = 'section enemy-template-section';
    container.appendChild(templateSection);
  }

  function renderTemplateSection() {
    if (!templateSection) return;
    const statusText = template
      ? usingTemplate()
        ? `Using the shared "${tierLabel}" tier template — this enemy defines no stats of its own.`
        : `A "${tierLabel}" tier template is loaded, but this enemy's own dice/mods override it.`
      : `No tier template imported for "${tierLabel}" yet — this enemy needs its own dice/mods until one is.`;

    templateSection.innerHTML = `
      <p class="enemy-template-note">${statusText}</p>
      ${onImportTierTemplates ? '<button class="import-btn enemy-import-template-btn">+ Import Tier Templates</button>' : ''}
    `;
    const importBtn = templateSection.querySelector('.enemy-import-template-btn');
    if (importBtn) importBtn.addEventListener('click', () => onImportTierTemplates());
  }
  renderTemplateSection();

  // --- Stats (dice) ---
  const statSection = document.createElement('div');
  statSection.className = 'section';
  statSection.innerHTML = `
    <h3>Stats</h3>
    <div class="dice-grid"></div>
    <div class="roll-result" style="display: none;"></div>
  `;
  container.appendChild(statSection);
  const diceGridEl = statSection.querySelector('.dice-grid');
  const rollResultEl = statSection.querySelector('.roll-result');

  // Forks the template's dice/mods into the enemy's own the FIRST time an
  // edit actually happens, so editing never mutates the shared template
  // object that other same-tier enemies still read from.
  function forkFromTemplateIfNeeded() {
    if (!hasOwnDice()) enemy.dice = JSON.parse(JSON.stringify(effectiveDice()));
    if (!hasOwnMods()) enemy.mods = JSON.parse(JSON.stringify(effectiveMods()));
  }

  function commitDiceField(el) {
    const label = el.getAttribute('data-dice-label');
    const raw = el.textContent.trim();
    const parts = raw.split('+').map((s) => s.trim()).filter(Boolean);
    enemy.dice[label] = raw === 'N/A' ? [] : parts;
    if (parts.length === 0 && raw !== 'N/A') el.textContent = 'N/A';
  }

  function renderDiceGrid() {
    diceGridEl.innerHTML = '';
    const dice = effectiveDice();

    if (isEditMode) {
      diceGridEl.innerHTML = Object.entries(dice).map(([label, diceArr]) => {
        const display = (!diceArr || diceArr.length === 0) ? 'N/A' : diceArr.join(' + ');
        return `
          <div class="stat">
            <span class="stat-label">${label}</span>
            <span class="stat-die editable-field" contenteditable="true" data-editable="dice" data-dice-label="${label}">${display}</span>
          </div>
        `;
      }).join('');

      diceGridEl.querySelectorAll('[data-editable="dice"]').forEach((el) => {
        el.addEventListener('blur', () => {
          forkFromTemplateIfNeeded();
          commitDiceField(el);
          renderTemplateSection();
          notify();
        });
        el.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') { e.preventDefault(); el.blur(); }
        });
      });
    } else {
      diceGridEl.innerHTML = Object.entries(dice).map(([label, diceArr]) => {
        const display = (!diceArr || diceArr.length === 0) ? 'N/A' : diceArr.join(' + ');
        return `
          <button class="stat stat-roll-btn" data-stat="${label}" type="button">
            <span class="stat-label">${label}</span>
            <span class="stat-die">${display}</span>
          </button>
        `;
      }).join('');

      // effectiveEnemy shares enemy.conditions by reference, so condition
      // toggles still mutate the real enemy object — only dice/mods are
      // swapped in for the template fallback.
      const effectiveEnemy = { ...enemy, dice: effectiveDice(), mods: effectiveMods() };
      attachDiceRoller(diceGridEl, rollResultEl, effectiveDice(), (statLabel) =>
        getEnemyModBreakdown(effectiveEnemy, statLabel)
      );
    }
  }

  // --- Mods (same draggable/editable list component as character skills,
  // keyed on "stat" instead of "name" to match the existing enemy JSON shape) ---
  const modsSection = document.createElement('div');
  modsSection.className = 'section';
  modsSection.innerHTML = '<h3>Mods</h3><div class="mods-slot"></div>';
  container.appendChild(modsSection);
  const modsSlot = modsSection.querySelector('.mods-slot');

  let modsEl = null;
  function renderMods() {
    modsSlot.innerHTML = '';
    modsEl = createSkillsList(
      effectiveMods(),
      (updated) => {
        forkFromTemplateIfNeeded();
        enemy.mods = updated;
        renderTemplateSection();
        notify();
      },
      () => isEditMode,
      { nameKey: 'stat', addPlaceholder: 'New mod (e.g. STR+2)...' }
    );
    modsSlot.appendChild(modsEl);
  }
  renderMods();

  // --- Conditions ---
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
      notify();
    },
    Object.keys(effectiveDice()),
    () => isEditMode
  );
  conditionsSection.appendChild(conditionsEl);
  container.appendChild(conditionsSection);

  // --- Edit mode toggle ---
  const editModeBtn = header.querySelector('.edit-mode-btn');
  const nameFieldEls = [nameEl];
  function applyEditMode() {
    container.classList.toggle('is-edit-mode', isEditMode);
    editModeBtn.textContent = isEditMode ? '✅ Done' : '✏️ Edit';
    editModeBtn.classList.toggle('is-active', isEditMode);
    nameFieldEls.forEach((el) => { el.contentEditable = isEditMode ? 'true' : 'false'; });
    renderDiceGrid();
    if (modsEl) modsEl.refresh();
    conditionsEl.refresh();
  }
  editModeBtn.addEventListener('click', () => {
    isEditMode = !isEditMode;
    applyEditMode();
  });
  applyEditMode();

  return container;
}
