// src/mods.js

/**
 * Mod stacking, per the spec: mods from different sources are additive.
 * A "mod" here is anything shaped like { name, value } (skills) matched
 * against a stat/dice label by name, or an active { active, value, appliesTo }
 * condition. Race mod + occupation mod + condition mod, etc. all sum together
 * into one total for that stat.
 */

function sumMatchingSkills(skillList, statLabel) {
  if (!skillList || !skillList.length) return 0;
  const target = statLabel.toLowerCase();
  return skillList
    .filter((s) => (s.name || '').toLowerCase() === target)
    .reduce((sum, s) => sum + (Number(s.value) || 0), 0);
}

/**
 * Returns every mod source contributing to a stat's total, so a roll can
 * show its work (e.g. "Race +2, Occupation +1, Prone -2") instead of just
 * a mystery number.
 *
 * @param {Object} character - expects racialSkills/occupationSkills/skills
 *   (arrays of { name, value }) and conditions (array of
 *   { name, active, value, appliesTo })
 * @param {string} statLabel - the dice/stat label being rolled, e.g. "Muscle"
 */
export function getModBreakdown(character, statLabel) {
  const breakdown = [];

  const addSkillSource = (label, skillList) => {
    const total = sumMatchingSkills(skillList, statLabel);
    if (total) breakdown.push({ source: label, value: total });
  };

  addSkillSource('Race', character.racialSkills);
  addSkillSource('Occupation', character.occupationSkills);
  addSkillSource('Personal', character.skills);

  (character.conditions || [])
    .filter(
      (c) =>
        c.active &&
        Number(c.value) &&
        (!c.appliesTo || c.appliesTo.toLowerCase() === statLabel.toLowerCase())
    )
    .forEach((c) => breakdown.push({ source: c.name, value: Number(c.value) }));

  return breakdown;
}

/** Convenience — just the stacked total, no breakdown. */
export function getTotalMod(character, statLabel) {
  return getModBreakdown(character, statLabel).reduce((sum, entry) => sum + entry.value, 0);
}

/**
 * Same idea as getModBreakdown, but for enemies: their mods are a flat
 * { stat, value } list rather than named skills, so matching is direct
 * rather than by shared naming with dice labels.
 */
export function getEnemyModBreakdown(enemy, statLabel) {
  const breakdown = [];
  const target = statLabel.toLowerCase();

  (enemy.mods || [])
    .filter((m) => (m.stat || '').toLowerCase() === target)
    .forEach((m) => breakdown.push({ source: 'Mod', value: Number(m.value) || 0 }));

  (enemy.conditions || [])
    .filter(
      (c) =>
        c.active &&
        Number(c.value) &&
        (!c.appliesTo || c.appliesTo.toLowerCase() === target)
    )
    .forEach((c) => breakdown.push({ source: c.name, value: Number(c.value) }));

  return breakdown;
}

/**
 * Every numeric mod/skill/condition a character has, with no stat filtering
 * at all — used by the free-form dice pool roller, where the roll isn't
 * tied to a named stat so nothing can be auto-matched. The DM sees
 * everything and picks whatever applies to the scenario being rolled.
 */
export function getAllModSources(character) {
  const list = [];

  (character.racialSkills || []).forEach((s) => {
    if (Number(s.value)) list.push({ source: `Race: ${s.name}`, value: Number(s.value) });
  });
  (character.occupationSkills || []).forEach((s) => {
    if (Number(s.value)) list.push({ source: `Occupation: ${s.name}`, value: Number(s.value) });
  });
  (character.skills || []).forEach((s) => {
    if (Number(s.value)) list.push({ source: `Skill: ${s.name}`, value: Number(s.value) });
  });
  (character.conditions || [])
    .filter((c) => c.active && Number(c.value))
    .forEach((c) => list.push({ source: `Condition: ${c.name}`, value: Number(c.value) }));

  return list;
}