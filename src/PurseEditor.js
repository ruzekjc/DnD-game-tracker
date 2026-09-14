import { toCopper, fromCopper, formatPurse } from './currency.js';

const DENOM_RATES = { platinum: 1_000_000, gold: 10_000, silver: 100, copper: 1 };

export function createPurseEditor(coinPouch, onChange) {
  const container = document.createElement('div');
  container.className = 'purse-editor';

  function render() {
    container.innerHTML = `
      <div class="purse-display">${formatPurse(coinPouch)}</div>
      <div class="purse-transaction">
        <input type="number" class="purse-amount" placeholder="Amount" min="0" />
        <select class="purse-denom">
          <option value="platinum">Platinum</option>
          <option value="gold">Gold</option>
          <option value="silver" selected>Silver</option>
          <option value="copper">Copper</option>
        </select>
        <button class="purse-btn add-btn">+ Add</button>
        <button class="purse-btn subtract-btn">− Spend</button>
      </div>
    `;

    const amountInput = container.querySelector('.purse-amount');
    const denomSelect = container.querySelector('.purse-denom');

    function applyTransaction(sign) {
      const amount = Number(amountInput.value);
      if (!amount || amount <= 0) return;

      const denom = denomSelect.value;
      const deltaCopper = amount * DENOM_RATES[denom] * sign;

      const currentCopper = toCopper(coinPouch);
      const newCopper = Math.max(0, currentCopper + deltaCopper); // never go negative

      const newPouch = fromCopper(newCopper);
      Object.assign(coinPouch, newPouch);

      amountInput.value = '';
      render();
      if (onChange) onChange(coinPouch);
    }

    container.querySelector('.add-btn').addEventListener('click', () => applyTransaction(1));
    container.querySelector('.subtract-btn').addEventListener('click', () => applyTransaction(-1));
  }

  render();
  container.refresh = render; // exposed so external mutations (e.g. bottom panel buy/sell) can trigger a redraw
  return container;
}