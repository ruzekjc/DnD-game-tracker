// src/diceRoller.js

/**
 * Dice rolling shared by characters and enemies. Deliberately does NOT
 * auto-apply mods to the total: the same stat can call for different mods
 * depending on the scenario being rolled for (e.g. a "flanking" bonus only
 * counts on some attacks, not others), so the DM sees every mod that could
 * apply and manually checks the ones that do for this specific roll.
 *
 * The mod list is captured at roll time, so if the DM edits a skill or
 * condition on the character card *after* rolling but before applying mods,
 * the already-shown checklist goes stale. A "↻ Refresh" button re-fetches
 * the mod list (keeping the already-rolled dice numbers) without requiring
 * a brand-new roll.
 */

export function rollDie(die) {
  const sides = Number(String(die).toLowerCase().replace('d', '')) || 0;
  if (!sides) return 0;
  return Math.floor(Math.random() * sides) + 1;
}

export function rollDice(diceArr) {
  return (diceArr || []).map(rollDie);
}

function renderModsBlock(mods, selected, onToggle, onRefresh) {
  const modsLabelRow = `
    <div class="roll-mods-header">
      <span class="roll-mods-label">Tap any mods that apply to this roll:</span>
      <button type="button" class="roll-refresh-mods-btn" title="Re-check mods if you changed something on the card">↻ Refresh</button>
    </div>
  `;

  const body = mods.length
    ? `<div class="roll-mods-list">
         ${mods
           .map(
             (m, i) => `
           <label class="roll-mod-chip${selected.has(i) ? ' is-selected' : ''}">
             <input type="checkbox" data-mod-index="${i}" ${selected.has(i) ? 'checked' : ''} />
             ${m.source} ${m.value >= 0 ? '+' : ''}${m.value}
           </label>
         `
           )
           .join('')}
       </div>`
    : `<div class="roll-line roll-line-dice">No mods currently available.</div>`;

  return { html: modsLabelRow + body, wire: (el) => {
    el.querySelector('.roll-refresh-mods-btn').addEventListener('click', onRefresh);
    el.querySelectorAll('.roll-mod-chip input').forEach((cb) => {
      cb.addEventListener('change', (e) => onToggle(Number(e.target.dataset.modIndex), e.target.checked));
    });
  }};
}

/**
 * Wires up a dice grid (buttons with data-stat="Label") so clicking one
 * rolls its dice and renders an interactive mod checklist + running total
 * into resultEl.
 *
 * @param {HTMLElement} gridEl - container with .stat-roll-btn[data-stat] children
 * @param {HTMLElement} resultEl - where the roll result + mod checklist renders
 * @param {Object} dice - { statLabel: diceArr }
 * @param {Function} getAvailableMods - (statLabel) => [{ source, value }]
 */
export function attachDiceRoller(gridEl, resultEl, dice, getAvailableMods) {
  gridEl.querySelectorAll('.stat-roll-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const label = btn.dataset.stat;
      const diceArr = dice[label];

      if (!diceArr || !diceArr.length) {
        resultEl.innerHTML = `<div class="roll-line">${label}: no dice defined.</div>`;
        resultEl.style.display = 'block';
        return;
      }

      const rolls = rollDice(diceArr);
      const diceTotal = rolls.reduce((a, b) => a + b, 0);
      let mods = getAvailableMods(label) || [];
      let selected = new Set();

      function refreshMods() {
        mods = getAvailableMods(label) || [];
        selected = new Set();
        renderResult();
      }

      function renderResult() {
        const modTotal = mods.reduce((sum, m, i) => sum + (selected.has(i) ? m.value : 0), 0);
        const modsBlock = renderModsBlock(
          mods,
          selected,
          (idx, checked) => {
            if (checked) selected.add(idx);
            else selected.delete(idx);
            renderResult();
          },
          refreshMods
        );

        resultEl.innerHTML = `
          <div class="roll-line roll-line-title">${label}: <strong>${diceTotal + modTotal}</strong></div>
          <div class="roll-line roll-line-dice">Dice: [${rolls.join(' + ')}] = ${diceTotal}</div>
          ${modsBlock.html}
        `;
        modsBlock.wire(resultEl);
      }

      renderResult();
      resultEl.style.display = 'block';
    });
  });
}

const STANDARD_DICE = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'];

/**
 * A free-form dice pool roller: click any number/mix of standard dice to
 * queue them, hit Roll, get the sum — then pick which mods/skills/conditions
 * apply from a full unfiltered list (since the roll isn't tied to a named
 * stat, nothing can be auto-matched; the DM decides per roll).
 *
 * @param {Function} getAvailableMods - () => [{ source, value }], re-evaluated on every Roll and every Refresh
 */
export function createDicePoolRoller(getAvailableMods) {
  const container = document.createElement('div');
  container.className = 'dice-pool-roller';

  let pool = []; // e.g. ['d6', 'd6', 'd4']

  container.innerHTML = `
    <div class="dice-pool-label">Click dice to add them to your roll:</div>
    <div class="dice-pool-picker">
      ${STANDARD_DICE.map((d) => `<button class="dice-pool-btn" data-die="${d}" type="button">${d}</button>`).join('')}
    </div>
    <div class="dice-pool-current"></div>
    <div class="dice-pool-actions">
      <button class="dice-pool-clear-btn import-btn" type="button">Clear</button>
      <button class="dice-pool-roll-btn save-btn" type="button">Roll</button>
    </div>
    <div class="roll-result" style="display: none;"></div>
  `;

  const poolDisplay = container.querySelector('.dice-pool-current');
  const resultEl = container.querySelector('.roll-result');

  function renderPool() {
    poolDisplay.innerHTML = pool.length
      ? pool.map((d, i) => `<button class="dice-pool-chip" data-index="${i}" type="button">${d} ✕</button>`).join('')
      : `<span class="bp-empty">No dice queued yet.</span>`;

    poolDisplay.querySelectorAll('.dice-pool-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        pool.splice(Number(chip.dataset.index), 1);
        renderPool();
      });
    });
  }

  container.querySelectorAll('.dice-pool-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      pool.push(btn.dataset.die);
      renderPool();
    });
  });

  container.querySelector('.dice-pool-clear-btn').addEventListener('click', () => {
    pool = [];
    renderPool();
    resultEl.style.display = 'none';
  });

  container.querySelector('.dice-pool-roll-btn').addEventListener('click', () => {
    if (!pool.length) return;

    const rolls = pool.map(rollDie);
    const diceTotal = rolls.reduce((a, b) => a + b, 0);
    let mods = getAvailableMods() || [];
    let selected = new Set();

    function refreshMods() {
      mods = getAvailableMods() || [];
      selected = new Set();
      renderResult();
    }

    function renderResult() {
      const modTotal = mods.reduce((sum, m, i) => sum + (selected.has(i) ? m.value : 0), 0);
      const modsBlock = renderModsBlock(
        mods,
        selected,
        (idx, checked) => {
          if (checked) selected.add(idx);
          else selected.delete(idx);
          renderResult();
        },
        refreshMods
      );

      resultEl.innerHTML = `
        <div class="roll-line roll-line-title">Total: <strong>${diceTotal + modTotal}</strong></div>
        <div class="roll-line roll-line-dice">Dice: [${pool.map((d, i) => `${d}=${rolls[i]}`).join(', ')}] = ${diceTotal}</div>
        ${modsBlock.html}
      `;
      modsBlock.wire(resultEl);
    }

    renderResult();
    resultEl.style.display = 'block';
  });

  renderPool();

  return {
    element: container,
    // Called when the selected character changes, so a stale roll for the
    // previous character doesn't linger. Dice queued are kept, since dice
    // types aren't character-specific.
    resetResult() {
      resultEl.style.display = 'none';
      resultEl.innerHTML = '';
    }
  };
}
