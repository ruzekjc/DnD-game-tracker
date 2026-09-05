import { createCharacterCard } from './CharacterCard.js';
import { createInventoryList } from './InventoryList.js';

fetch('./data/characters/calis.json')
  .then(res => res.json())
  .then(character => {
    const inventoryEl = createInventoryList(character.inventory, (updatedItems) => {
      character.inventory = updatedItems;
    });
    const card = createCharacterCard(character, inventoryEl, (updatedCharacter) => {
      // For now this just keeps the in-memory object in sync.
      // Later we can add a "Save" button here to export back to JSON.
        console.log('Character updated:', updatedCharacter);
    });
    document.getElementById('app').appendChild(card);
  })
  .catch(err => {
    console.error('Failed to load character:', err);
    document.getElementById('app').textContent = 'Error loading character data.';
  });