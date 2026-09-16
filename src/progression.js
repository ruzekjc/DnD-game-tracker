// src/progression.js

/**
 * Adds EXP and returns how many level-ups occurred (normally 0 or 1, but a
 * single big grant — e.g. stacking +100% a few times — can cross more than
 * one threshold at once, hence a count rather than a boolean).
 *
 * The EXP cap stays the same across levels unless the DM manually edits it
 * (via the exp-cap input already on the character card) — there's no
 * defined formula for how much more EXP the next level should need, so
 * level-ups just carry over any overflow EXP into the new level at the same cap.
 */
/**
 * Ensures character.exp is the { value, cap } shape the rest of the app
 * expects — some imported character files apparently store exp as a bare
 * number instead, which would otherwise crash the first time anything tries
 * to write to it. A bare number is treated as the current progress value.
 */
export function normalizeExp(character) {
  if (!character.exp || typeof character.exp !== 'object') {
    const previousValue = typeof character.exp === 'number' ? character.exp : 0;
    character.exp = { value: previousValue, cap: 100 };
  }
  if (typeof character.exp.value !== 'number') character.exp.value = 0;
  if (typeof character.exp.cap !== 'number' || character.exp.cap <= 0) character.exp.cap = 100;
  return character.exp;
}

export function addExp(character, amount) {
  normalizeExp(character);
  character.exp.value += amount;

  let levelsGained = 0;
  while (character.exp.cap > 0 && character.exp.value >= character.exp.cap) {
    character.exp.value -= character.exp.cap;
    character.level = (character.level || 1) + 1;
    levelsGained += 1;
  }

  if (levelsGained > 0) {
    character.skillPoints = (character.skillPoints || 0) + levelsGained;
  }

  return levelsGained;
}

/** Flat list of every named skill across all three sources, for the level-up allocator. */
export function getAllSkillRefs(character) {
  const refs = [];
  ['racialSkills', 'occupationSkills', 'skills'].forEach((key) => {
    (character[key] || []).forEach((skill, index) => {
      refs.push({ key, index, name: skill.name, value: skill.value });
    });
  });
  return refs;
}

/**
 * Applies one banked skill point: +1 to an existing skill (by key+index), or
 * a brand-new personal skill created at +1. Decrements skillPoints either way.
 */
export function applySkillPoint(character, choice) {
  if (choice.mode === 'existing') {
    const list = character[choice.key];
    if (list && list[choice.index]) {
      list[choice.index].value = (list[choice.index].value || 0) + 1;
    }
  } else if (choice.mode === 'new' && choice.name) {
    if (!character.skills) character.skills = [];
    character.skills.push({ name: choice.name, value: 1 });
  }
  character.skillPoints = Math.max(0, (character.skillPoints || 0) - 1);
}