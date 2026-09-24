# Cookie Clicker Access - Changelog

## Version 14.0

### Renamed for all screen readers
- The mod is now called **Screen Reader Accessibility Enhancements**, replacing "NVDA Accessibility Enhancements". The mod has always supported JAWS, Narrator and VoiceOver as well as NVDA, and the old name misrepresented that
- The internal mod ID changed from `nvda accessibility` to `screen reader accessibility`. Any mod that referenced the old ID through `Game.mods['nvda accessibility']` must be updated
- The startup announcement now says "Screen Reader Accessibility mod version 14.0 loaded."

### Stats Menu Structure
- Added a heading outline to the Stats menu: `H2` on each section banner, `H3` on subsection titles, and `H4` before each crate box, so the menu can be navigated with single-key heading jumps
- Each crate box is now a labelled group announcing its name and item count (for example `Achievements, 316 items`), with the name derived from the crates it actually contains
- Section titles only become headings when they head a subsection, so inline values such as `Prestige level: N` are no longer read as headers

### Milk Readout
- The milk flavour in the stats readout now follows the Milk selector instead of always reporting the achievement rank flavour, matching what the game draws and what the big cookie label says
- During a Born again ascension the readout falls back to the rank flavour, because the game ignores the selector in that state
- Rank and percentage remain achievement-based

### Pantheon
- Spirit placement is now verified before it is announced: the slot is read back after the attempt, so a failed placement no longer reports success and no longer spends a worship swap
- Added an "already in that slot" response, which previously reported a spirit's own slot as occupied
- A failure inside the game's placement call is now reported instead of being silently swallowed

### Permanent Upgrade Slots
- The permanent slot picker now announces how many upgrades are on offer and moves focus to the first crate when it opens
- Re-labelling after a selection no longer pulls focus back to the top of the list

### Dragon Aura Prompt
- Added a safety net that labels the game's native dragon aura prompt if another mod or game path opens it, since its crates are otherwise unlabelled with no keyboard access
- Choosing an aura in that prompt rebuilds it from scratch, so the crates are now relabelled on every refresh; previously the prompt went mute and lost keyboard access after the first selection
- After a selection, focus returns to the chosen aura and the pending choice is announced, with a reminder that Confirm still has to be activated to apply it
- Each crate now states whether it is the aura currently equipped in that slot or the one selected but not yet applied
- Aura names are read from the game's localized names, so a translated game is no longer described in English
- The mod's own inline aura picker in the dragon panel is unchanged and still the normal route

### Challenge Mode Prompt
- The challenge mode picker shown when starting an ascension now labels each mode crate with its name, whether it is currently selected, and what the mode changes
- Picking a mode rebuilds the prompt, so the crates are relabelled on every refresh; previously the prompt went silent and lost keyboard access after the first pick
- Mode names are read from the game's localized names
- Removed a duplicate handler that was overwriting these labels shortly after the prompt opened, which had dropped every mode description

### Prompt Focus
- Choosing an option in any prompt now leaves focus on the option you picked; a dialog-heading focus pass was overriding it a moment later in the dragon aura, permanent slot, and challenge mode pickers
- Prompts that have no specialized handling still move focus to their heading as before

### Announcements
- Non-urgent announcements are suppressed while a modal dialog is open, so background chatter no longer talks over a prompt
- Urgent announcements (shimmers, wrinklers, veil breaks, achievements) are never suppressed
- Dialogs keep their own speech, including the save confirmation, slot selection feedback, and the aura and upgrade counts

### Documentation
- The mod is published on the Steam Workshop, and the README now points there as the install route: https://steamcommunity.com/sharedfiles/filedetails/?id=3807399658
- The README explains that an older copy of the accessibility mod has to be removed first. Because the mod ID changed, the game treats the old copy as a separate mod, loads both, and reads every label twice
- The README carries a section listing what this fork changes against the upstream repository it was forked from, and a compatibility list covering Frozen Cookies, Cookie Garden Helper Reloaded, CCSE and Cookie Assistant
- Added instructions for running the test harness with `node tests/harness.js`
- `info.txt` author updated to VIPPotato

## Version 13.10

### Store & Upgrade Navigation
- Added dedicated `H3` headings for all upgrade store categories:
  - `Special & Season Switches (H3)` above toggle upgrades (season switches, Golden switch, Shimmering veil, Rigidel, selectors)
  - `Research & Tech Upgrades (H3)` above Bingo Center research upgrades
  - `Vaulted Upgrades (H3)` above vaulted upgrades
  - `Available Upgrades (X available) (H3)` above standard upgrades, showing the total available count
- Added an informative focusable note directly below "Buy all available upgrades" when 0 standard upgrades are available (`"No standard upgrades available to purchase. All standard upgrades are bought. Check Special & Season Switches above for toggles and seasonal switches."`)
- Enhanced "Buy all available upgrades" button label to announce affordable and total counts (e.g. `"Buy all available upgrades (0 available)"` or `"Buy all available upgrades (3 affordable of 5)"`), and added voice announcement when clicked with 0 upgrades
- Added accessible ARIA region landmarks to store sections for clear container navigation

### Seasonal Drop Progress & Biscuit Labels
- Enhanced seasonal biscuit toggle buttons (Lovesick, Festive, Bunny, Ghostly) to announce seasonal drop progress:
  - Valentine's Day: `X/7 heart biscuits unlocked`
  - Christmas: `X/14 Santa's gifts, Y/7 reindeer cookies unlocked`
  - Easter: `X/20 eggs unlocked`
  - Halloween: `X/7 halloween cookies unlocked`
- Seasonal switch buttons announce remaining duration and cancel action when the season is currently active (e.g. `Active season: Valentine's day (23h 45m remaining). Click to cancel season`)
- Dynamic descriptions via `descFunc()` and `displayFuncWhenOwned()` are now rendered cleanly in focusable upgrade info notes below crates
- Enhanced Santa panel to announce gifts unlocked (`X of 14 Santa's gifts unlocked`)
- Active season readout in Status and Effects panel and season start announcements now include seasonal drop progress


- Fixed Golden Cookie and Reindeer clicking incompatibility with Frozen Cookies by wrapping `Game.shimmer.prototype.pop` instead of `Game.shimmerTypes.*.popFunc`
- Preserved vanilla `Game.shimmerTypes.golden.popFunc` so third-party mods using `eval()` stringification (such as Frozen Cookies) do not destroy closure variables and crash with `ReferenceError: MOD is not defined`
- Ensured automated clickers, manual clicks, and accessible shimmer buttons all trigger live NVDA reward announcements without conflict
- Updated documentation with an automation compatibility section, mod matrix, and repository references

## Version 13.8

- Simplified milk display under big cookie to show just rank and type (detailed info already in stats menu)
- Fixed sugar lump harvest announcements by wrapping Game.clickLump directly instead of using setTimeout
- Pantheon: slot labels now show only the active tier's effect plus dynamic info (e.g. Cyclius current bonus)
- Pantheon: spirit effects listed per slot tier (Diamond, Ruby, Jade) on separate lines for easy navigation
- Pantheon: simplified slot button labels and "slot already occupied" feedback

## Version 13.7

### Garden Grid Navigation
- Replaced tab-based garden navigation with a proper arrow key grid
- Grid uses `role="grid"` with rows and cells, navigable with arrow keys in NVDA focus mode
- Tab enters the grid at the top-left plot
- Grid size shown in the Plots heading (e.g. "Plots (6 by 6)")

### Other Changes
- Added "Available Upgrades" heading above the upgrade store section
- Purchased upgrades are now announced when using Buy All Upgrades button
- Dragon upgrade now announces what was trained (e.g. "Trained Breath of Milk")
- Focus restored to aura slot after confirming dragon aura selection
- Escape closes panels regardless of focus location (minigames, selectors, dragon, santa)
- Background and sound selector panels return focus to crate on close
- Removed "Click to open selector" from selector labels
- Garden plot labels show plant info before row/column coordinates
- Fixed FTHOF shimmer announcements for buff replacements and storm cookie drops
- Cleaned up ascension screen labels and heralds display
- Removed aria-label from building rows to properly expose inner buttons
- Fixed time-until-affordable showing before Genius Accounting upgrade is owned
- Blocked building purchase attempts when bulk amount is unaffordable
- Fixed role="note" spam, duplicate aria-labels, and building name/price leaking into screen reader output
- Fixed duplicate building info for screen readers

## Version 13.6

### Inaccessible Elements
- Added prestige details to Game Stats panel (run duration, prestige level, CpS%, cookies to next level, ascending gains)
- Added Buy All Upgrades button accessibility (role, tabindex, keyboard support)
- Added dragon boost indicator labels when Supreme Intellect aura is active
- Added jukebox control accessibility (play, loop, auto buttons; seek slider label)
- Added gift system input labels (gift code, amount, message, error announcements)
- Hidden mute buttons from screen readers (visual-only feature)
- Hidden version badge and update notification from screen readers

### Notification System Overhaul
- Categorized all notifications: startup (persistent, no live region), user-initiated (hidden, live region only), non-user-initiated (persistent + live region)
- Achievement notifications now persistent until dismissed and announced via live region
- Shimmer click results suppressed from notifications (already announced via live region)

### Accessible Selector Panels
- Replaced visual-only background selector with accessible button panel
- Replaced visual-only golden cookie sound selector with accessible button panel
- Permanent upgrade slots now show assigned upgrade name in label

### Cleanup
- Removed duplicate Pantheon panel (was creating a second set of controls alongside the inline ones)
- Removed unused Garden accessible panel (dead code)
- Removed legacy Garden module from web build (web version now uses same inline code as Steam)
- Updated Tampermonkey userscript name and namespace to match current repo

### Fixes
- Fixed wrinkler labels showing cookies sucked without Eye of the Wrinkler upgrade
- Removed "Click to pop" from wrinkler labels
- Fixed news ticker: grandma quotes and speaker now read on same line
- Fixed pantheon focus issues: stopped DOM reordering, anchored spirit elements to placeholders
- Rounded garden times to nearest minute to prevent screen reader spam
- Hidden You building customizer (values are meaningless without visual preview)
- Added guilevi credit to README for Tampermonkey userscript support

## Version 13.2

- Press Escape to close any open minigame panel, dragon panel, or milk selector
- Garden plant activity (growth, maturity, decay) is now announced via live region while the garden minigame is open
- Improved dragon panel accessibility
- Improved ascension screen accessibility

## Version 12

- Added Statistics Module for accessible upgrade and achievement labels
- Added Grimoire accessible spell structure (H3 headings, cost, effect, Cast buttons)
- Added Enhanced Pantheon panel with slot details and effect percentages
- Added Dragon Aura selection dialog with keyboard navigation
- Added Permanent upgrade slot selection dialog on ascension screen
- Added Heavenly Chips counter on ascension screen
- Added Cookie Chain and Cookie Storm tracking with start/end announcements
- Added seasonal shimmer variant names (Bunny, Heart, Pumpkin, Contract)
- Added Active Shimmers panel with clickable buttons and countdown timers
- Added Harvest Mature Only button in Garden
- Added collapsible Garden Information panel with current effects and tips
- Added building production stats (individual CPS, total CPS, percentage of total)
- Added toggle upgrade effect descriptions (Elder Pledge, Golden Switch, etc.)
- Added milk progress display with rank, type, and achievements to next rank
- Added season display in main interface
- Added cookies per click display
- Added progressive building reveal (owned + next + mystery)
- Added building level display with sugar lump cost in store
- Added Stock Market accessibility (stock labels, buy/sell buttons)
- Added QoL selector accessibility (Milk, Background, Season, Sound)
- Added Shimmering Veil break alert
- Added batch processing for statistics menu to avoid UI freezing

## Version 11.7

- Added bulk pricing support for buildings (1, 10, 100, max)
- Added News heading for ticker accessibility
- Fixed buff list formatting issues
- Fixed live region announcements to show only the latest message

## Version 11

- Garden coordinates standardized to R#, C# format
- Improved garden responsiveness and soil labels
- Fixed minigame buttons not detected by screen reader
- Added season change notifications and current season display
- Added Available Buildings region
- Fixed wrinkler buttons not being read properly by NVDA
- Added wrinkler spawn announcements
- Improved shimmer fading alerts

## Version 9

- Garden minigame fully accessible with virtual grid navigation
- Enter Garden Grid button for arrow key navigation
- Seed selection dialog for empty plots
- Harvestable plants and available seeds sections
- Soil buttons work with keyboard (Enter/Space)
- Hidden FPS counter and undefined elements from screen readers

## Version 8

- Pantheon accessibility improvements with keyboard support
- Shimmer announcement system (removed buttons, kept live announcements)
