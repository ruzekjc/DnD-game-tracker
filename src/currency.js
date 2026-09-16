// src/currency.js

export const RATES = {
  platinum: 1_000_000,
  gold: 10_000,
  silver: 100,
  copper: 1
};

export function toCopper(purse) {
  return (
    (purse.platinum || 0) * RATES.platinum +
    (purse.gold || 0) * RATES.gold +
    (purse.silver || 0) * RATES.silver +
    (purse.copper || 0) * RATES.copper
  );
}

export function fromCopper(totalCopper) {
  let remaining = totalCopper;

  const platinum = Math.floor(remaining / RATES.platinum);
  remaining -= platinum * RATES.platinum;

  const gold = Math.floor(remaining / RATES.gold);
  remaining -= gold * RATES.gold;

  const silver = Math.floor(remaining / RATES.silver);
  remaining -= silver * RATES.silver;

  const copper = remaining;

  return { platinum, gold, silver, copper };
}

export function formatPurse(purse) {
  const { platinum, gold, silver, copper } = purse;
  const parts = [];
  if (platinum) parts.push(`${platinum}pp`);
  if (gold) parts.push(`${gold}gp`);
  if (silver) parts.push(`${silver}sp`);
  if (copper) parts.push(`${copper}cp`);
  return parts.length ? parts.join(' ') : '0cp';
}

export function spend(purse, priceInCopper) {
  const total = toCopper(purse);
  if (total < priceInCopper) return null;
  return fromCopper(total - priceInCopper);
}

export function addFunds(purse, amountInCopper) {
  const total = toCopper(purse);
  return fromCopper(total + amountInCopper);
}