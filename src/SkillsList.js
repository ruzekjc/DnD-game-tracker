export function createSkillsList(skills, onChange) {
  const container = document.createElement('div');
  container.className = 'skills-list';

  function render() {
    container.innerHTML = '';

    skills.forEach((skill, index) => {
      const row = document.createElement('div');
      row.className = 'skill-row';

      const sign = skill.value >= 0 ? '+' : '';

      row.innerHTML = `
        <span class="skill-name editable-text" contenteditable="true">${skill.name}</span>
        <div class="qty-controls">
          <button class="qty-btn minus">−</button>
          <span class="skill-value">${sign}${skill.value}</span>
          <button class="qty-btn plus">+</button>
        </div>
      `;

      row.querySelector('.skill-name').addEventListener('blur', (e) => {
        skill.name = e.target.textContent.trim();
        if (onChange) onChange(skills);
      });

      row.querySelector('.minus').addEventListener('click', () => {
        skill.value -= 1;
        render();
        if (onChange) onChange(skills);
      });

      row.querySelector('.plus').addEventListener('click', () => {
        skill.value += 1;
        render();
        if (onChange) onChange(skills);
      });

      container.appendChild(row);
    });

    const addRow = document.createElement('div');
    addRow.className = 'inventory-add-row';
    addRow.innerHTML = `
      <input type="text" class="new-item-input" placeholder="New skill name..." />
      <button class="add-item-btn">+ Add</button>
    `;

    addRow.querySelector('.add-item-btn').addEventListener('click', () => {
      const input = addRow.querySelector('.new-item-input');
      const name = input.value.trim();
      if (name) {
        skills.push({ name, value: 0 });
        input.value = '';
        render();
        if (onChange) onChange(skills);
      }
    });

    container.appendChild(addRow);
  }

  render();
  return container;
}