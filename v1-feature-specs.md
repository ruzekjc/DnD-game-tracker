# TTRPG Companion App: Feature Spec

## Overview

A web app for running tabletop RPG sessions: characters, shops, and enemies are imported as `.json` files, displayed as browsable cards, and edited/tracked live during play. One DM account controls and saves all session state.

## 1. Characters

- Each character sheet follows the `template.json` schema.
- `.json` files import into `/data`, split by type: `/data/characters/`, `/data/shops/`, `/data/enemies/`.
- On import, the site assigns each item a unique ID (used to detect re-imports of the same character vs. new ones).
- **Mod stacking:** mods are additive across sources. 
	- Example: race mod `maneuverability +2` + occupation mod `maneuverability +1` = total roll is (dice sum) + 3.
- Import validation: malformed/invalid `.json` shows a dismissible popup describing the specific error (not a silent failure).

## 2. Accounts & Persistence

- Google login identifies the DM (ownership/authorship), not multiuser sync
	- only one DM is logged in and controlling data at a time.
- **Save** writes changes directly back to the source `.json` file
- **New character creation:** DM can create a character in-app and save it out as a new `.json` file.

## 3. Currency

- Denominations: platinum, gold, silver, copper (base-100 ladder: 1pp = 100gp, 1gp = 100sp, 1sp = 100cp).
- Stored/calculated internally as total copper to avoid rounding issues, displayed as a breakdown (e.g. "2pp 14gp 3sp").
- Wallet display shows all four denominations.

## 4. Layout

### Large panel: Character cards

- Grid/list of all imported characters.
- **Preview card shows:**
    - Name
    - Race
    - Race mods
    - Skill point mods
    - Occupation & mods
    - Dice
    - Active conditions
	    - **conditions apply to rolls whenever relevant**
- **Clicking a card expands to full character sheet view**, showing every field present in that character's `.json` file.

### Small panel: Shop / Enemy viewer

- Tabs to switch between **Shop** mode and **Enemy** mode.
- Within each tab, a dropdown selects which imported shop/enemy to display.
- Shop view
	- merchant inventory, item details, prices
- Enemy view: stat block, mods, and **conditions** tracked and applied the same way as character conditions
- Shop and enemy `.json` imports use the same validation pipeline as characters.
- **Enemy tiers:**
    - Basic NPCs: flat shared stat sheet.
    - Enforcers: same shape as NPCs, slightly bumped stats.
    - Bosses: can be auto-generated / modified in real time (heavier feature; see **Open Items**).

### Bottom panel: Inventory / Dice Roller (tabbed)

- Tab between the two views (not context-swapped).

**Inventory tab:**

- Shows selected character's inventory.
- Character's current wallet/money displayed at top-left of this panel.
- Empty inventory is valid and expected (e.g. level 0 characters start with nothing).
- **Cart sub-panel:*
	- items being purchased are staged here before confirming.
- **Buy button:** confirms cart -> deducts wallet, adds items to character inventory. Shop stock is **unlimited**
	- buying does not decrement shop inventory.
- **Sell/return:**
	- a DM can move an item from a character back to a shop (reverse of buy), to correct mistakes.

**Dice Roller tab:**

- A character must be selected to apply their mods to the roll.
- If Roll is clicked with no character selected: don't roll
	- show a dismissible popup asking the user to select a character.
- **Target behavior:** rolling should be as simple as clicking a stat ("Muscle") and it auto rolls that stat's dice.
- Mods (conditions, equipped item, action being taken) are **auto calculated and applied** based on what's equipped and what action is selected
	- the roller determines the correct total without the DM manually adding modifiers.

## 5. Save Safety

- On save, the **previous version of a character's `.json` is kept as a backup** until the current session ends
- If a save fails, the DM falls back to that backup and manually re-enters anything lost.

## Open items / harder features (not yet scoped)

These are meaningfully more involved than the rest of the spec and worth scoping separately before committing to a v1 timeline:

- **"New character -> save as new file"**
	- still marked negotiable depending on feasibility.
- **Auto-calculated mods based on equipped item + action taken**
	- requires a rules engine that maps
	- action type += equipped gear += active conditions) == modifier
	- This is the single biggest scope item in the whole spec.
		- much cheaper and easier alternative: 
			- click dice to roll, then after rolling click all mods to add onto / subtract from roll
- **Boss auto-generation / real-time modification**
	- generating a stat block on the fly (vs. picking from static NPC/Enforcer templates) is a different feature category from importing static JSON.
- **Long-term goal:**
	- an auto-gen system capable enough to let the DM step back from manually running combat/narrative
	- this is a large, open-ended AI/rules-engine effort layered on top of everything else in this spec, not a small add on feature, just to be clear. 
	- marked as not currently feasible
- Opposed rolls / group rolls / GM-only rolls with no character selected
	- only the "no character selected" error case is defined so far.
