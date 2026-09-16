# TTRPG Companion App

A tool for running tabletop sessions: characters, shops/NPCs,
enemies, and a shared item library all live as `.json` files on your own
computer.

## 1. Before you start: browser matters

This app can only **save changes directly back to your files** in
**Chrome or Edge on a computer** (the File System Access API)

| Platform | Import files | Save changes |
|---|---|---|
| Chrome / Edge (desktop) | ✅ | ✅ Saves in place |
| Firefox / Safari (desktop) | ✅ | ⚠️ Downloads a copy instead, you replace the file manually |
| Chrome (Android) | ✅ | ⚠️ Inconsistent, treat as download-fallback |
| Safari (iPhone/iPad) | ✅ | ❌ Always downloads a copy |

## 2. Preexisting data Setup

### On a PC (Windows/Mac)

1. Download `data.zip` (from email, a shared drive, USB stick, wherever it
   was sent).
2. Right-click it → **Extract All** (Windows) or double-click it (Mac) to
   unzip.
3. t does **not** need to be inside any particular project
   folder.
4. Open the app in Chrome or Edge.

### On mobile

1. Download `data.zip` to your device (from email, a cloud link, etc.).
2. Use your phone's Files app (iOS: **Files**; Android: **Files by
   Google** or your file manager) to unzip it — tap the zip, look for
   "Extract" or "Uncompress."
3. Open the app in your mobile browser. Keep in mind: on iPhone/iPad,
   saving will always download a fresh copy rather than editing in place
   (see the table above) — plan on periodically re-collecting your
   downloaded files if you're playing this way.

## 3. Importing your files into the app

The app never auto-loads anything so you'll always have to import explicitly, which
means you're always in control of exactly what's loaded into a session.

| What you have | Where to import it |
|---|---|
| Character `.json` file(s) | **+ Import** button, top of the character panel |
| Shop / NPC `.json` file(s) | Shop/Enemy panel → **Shop** tab → **+ Import** |
| Enemy `.json` file(s) | Shop/Enemy panel → **Enemy** tab → **+ Import** |
| Item library `.json` | Open any shop → scroll to "Add from Library" → **+ Import Item Library** (or the same button shows up wherever a library hasn't been loaded yet) |
| Tier templates `.json` | Open any Basic/Enforcer enemy → **+ Import Tier Templates** |

You'll get a native file picker — select one or more files (multi-select is
fine for characters, shops, and enemies). If a file is malformed or missing
a required field, you'll get a clear popup explaining what's wrong, and the
rest of your selection still imports fine.

**Re-importing the same file** (say, one you hand-edited outside the app)
updates that character/shop/enemy in place instead of creating a duplicate.

**Next time you visit**, if you're using Chrome/Edge, a small banner will
offer to reconnect the files you had open last time, so you don't have to
re-pick everything from scratch. If you sign in with Google, that banner is
scoped to *your* account — a different DM signing in on the same computer
won't see your remembered files.

## 4. Basic usage tips

### Characters
- Only one character is shown at a time — use the **← dropdown →** nav bar
  above the sheet to switch. Everything (skills, conditions, dice, wallet)
  lives on that one sheet.
- Click **+ New Character** to build one from scratch instead of importing
  a file — you'll be asked where to save it.
- Hit **💾 Save** on the card to write changes back to the file.

### Rolling dice
- Bottom panel → **Dice Roller** tab. Click any mix of dice (d4–d100) to
  queue them, then **Roll**.
- After rolling, a checklist of the selected character's skills/mods/
  conditions appears — tap whichever apply to *this* roll. Nothing is
  auto-applied, since the same roll can call for different mods depending
  on what's actually happening in the scene.
- If you edit something on the character card *after* rolling but before
  picking mods, hit **↻ Refresh** next to the mod list rather than
  re-rolling — it re-checks the character without touching your dice
  result.

### Shops, buying, and trading
- Bottom panel → **Inventory** tab: pick a character, browse a shop, stage
  a cart, **Buy**. Shop stock never runs out (matches how these games
  usually treat merchants). **↩ Return** reverses a purchase.
- Bottom panel → **Trade** tab: a genuine two-sided trade — pick a party on
  each side (character or NPC), stage what each side is offering, confirm
  once. NPC/shop sides never actually lose or gain stock; only character
  sides are real transfers.
- In the Shop/Enemy panel, **+ New** creates a brand-new shop/NPC, with the
  option to batch-pick starting inventory straight from the item library.

### Leveling up
- Bottom panel → **EXP** tab: grant 25/50/75/100% of the *total* EXP needed
  to level (not remaining progress) — these stack, so 25% + 50% grants 75%
  total in one go.
- Crossing the EXP cap pops up a level-up screen where you can immediately
  spend the earned skill point (bump an existing skill, or create a new
  one at +1) — or close it to bank the point for later.

### Enemies and tiers
- Basic/Enforcer enemies can share a stat template instead of repeating
  full stat blocks per file — see the "Tier Templates" section below.
- Bosses always need their own complete stat block; they never use a
  shared template.

### Signing in
- The Google sign-in button (top of the page) identifies who's acting as
  DM for this session and stamps your name onto saved files. Saving still
  works if you're not signed in but signing in is what makes the "reconnect
  last session" feature scope correctly to you specifically.

### Resizing panels
- Drag the thin dividers between panels to change their relative size.
  Your layout is remembered per-browser.

## 5. Tier Templates

Import a tier-templates file, and any **Basic** or **Enforcer** enemy that
doesn't define its own `dice`/`mods` will automatically use the shared
template for its tier instead. An enemy's own stats, if it has any, always
win. **Boss**-tier enemies never use templates; they always need their own 
full stat block.

The Enemy view always tells you plainly which situation you're in: no
template loaded, template in use, or template loaded but this enemy has its
own stats that take priority.
