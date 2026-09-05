import { createCharacterCard } from './CharacterCard.js';
import { createInventoryList } from './InventoryList.js';

const CHARACTER_FILES = [
  './data/characters/calis.json',
  './data/characters/V.json'
  // add more character file paths here as you create them
];

async function loadCharacter(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  return res.json();
}

async function init() {
  const container = document.getElementById('app');

  const results = await Promise.allSettled(CHARACTER_FILES.map(loadCharacter));

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      const character = result.value;
      const inventoryEl = createInventoryList(character.inventory, (updatedItems) => {
        character.inventory = updatedItems;
      });
      const card = createCharacterCard(character, inventoryEl, (updatedCharacter) => {
        console.log('Character updated:', updatedCharacter);
      });
      container.appendChild(card);
    } else {
      console.error(`Failed to load ${CHARACTER_FILES[index]}:`, result.reason);
      const errorEl = document.createElement('div');
      errorEl.className = 'char-card-error';
      errorEl.textContent = `Error loading ${CHARACTER_FILES[index]}`;
      container.appendChild(errorEl);
    }
  });
}

init();