# Cookie Clicker Access (Frozen Cookies Compatibility Fork)

This mod makes Cookie Clicker fully accessible with screen readers such as NVDA, JAWS, and VoiceOver. It works with both the **Steam version** and the **web version** (via Tampermonkey).

This fork specifically resolves a critical incompatibility with automation mods like **Frozen Cookies**, ensuring that Golden Cookies, Wrath Cookies, and Reindeer can be clicked both automatically and manually without crashes.

---

## AI Disclaimer

**All code in this mod is AI-generated.** Development is directed and QA tested by human players, with code implementation assisted by Claude.

---

## Frozen Cookies & Automation Compatibility

In previous versions of the accessibility mod, running alongside **Frozen Cookies** resulted in a fatal issue: **Golden Cookies could not be clicked automatically or manually**, and would remain stuck on screen until they faded away.

### Why This Happened
Frozen Cookies replaces `Game.Popup` references inside `Game.shimmerTypes.golden.popFunc` by stringifying the function (`.toString()`) and re-evaluating it with `eval()` in the global scope. Because earlier versions of this mod wrapped `popFunc` in a closure with private scoped variables (`orig`, `MOD`), Frozen Cookies' `eval()` broke the closure scope. When any Golden Cookie was clicked, JavaScript threw an uncaught `ReferenceError: MOD is not defined`, aborting the click before the cookie could pop or grant rewards.

### The Solution in This Fork
* **Clean Separation of Hooks:** Instead of modifying `Game.shimmerTypes.golden.popFunc`, this fork wraps `Game.shimmer.prototype.pop`.
* **Zero Interference with `eval`:** `Game.shimmerTypes.golden.popFunc` remains pristine for Frozen Cookies to analyze and wrap.
* **Full Screen Reader Support Preserved:** When Frozen Cookies auto-clicks a Golden Cookie, when you click it with a mouse, or when you activate it via screen reader buttons, `shimmer.pop()` executes cleanly. NVDA announces the reward, cookie chain steps continue, and cookie storm drops are accurately counted.

---

## Mod Compatibility Matrix

| Mod | Compatibility | Notes |
| :--- | :--- | :--- |
| **Frozen Cookies** | **Fully Compatible** | Auto-clicking (`autoGC`, `autoReindeer`), auto-buying, and Grimoire automation work seamlessly. |
| **Cookie Garden Helper Reloaded (CGHR)** | **Fully Compatible** | Automatic planting, harvesting, and soil rotation work without interfering with garden grid accessibility. |
| **CCSE (Cookie Clicker Script Extender)** | **Fully Compatible** | Fully supported as the base mod loader. |
| **Cookie Assistant** | **Fully Compatible** | Fully compatible. |

---

## Installation

### Steam Version

1. Download the latest release from the [Releases page](https://github.com/VIPPotato/Cookie-Clicker-Access-frozen-cookies-fix/releases).
2. Extract the zip file.
3. Copy the `Cookie-Clicker-Access` folder into your Cookie Clicker local mods folder:
   `[Steam Install Path]\steamapps\common\Cookie Clicker\resources\app\mods\local\Cookie-Clicker-Access\`
4. Launch Cookie Clicker, open **Options > Mods**, and ensure **NVDA Accessibility Enhancements** is enabled.
5. Restart the game when prompted to load the mod.

### Web Version (Tampermonkey)

**Quick Start:**
1. Install the [Tampermonkey](https://www.tampermonkey.net/) browser extension (Chrome, Firefox, Edge, Safari).
2. Install the userscript from: [cookie-clicker-accessibility.user.js](https://raw.githubusercontent.com/VIPPotato/Cookie-Clicker-Access-frozen-cookies-fix/main/cookie-clicker-accessibility.user.js)
   * Tampermonkey will open an installation tab.
   * Click **Install** to confirm.
3. Open [Cookie Clicker Web](https://orteil.dashnet.org/cookieclicker/) — the mod will load automatically once the game finishes initializing.

**Verification:**
* Open your browser console (F12) and verify: `"Cookie Clicker Accessibility Mod loaded and registered!"`.
* Typing `Object.keys(Game.mods)` in console should include `"nvda accessibility"`.

---

## Getting Started & Landmark Navigation

When loaded, the mod announces `"NVDA Accessibility mod version 13.10 loaded."`

The game interface is organized into accessible landmark sections using clean HTML headings. Use your screen reader's single-key navigation (such as pressing **H** in NVDA browse mode) to quickly jump between sections:

* **News (H2):** The game's news ticker (focusable; live announcements muted to avoid speech spam).
* **Store (H2):** Accessible store section containing:
  * **Special & Season Switches (H3):** Seasonal triggers (Lovesick, Festive, Bunny, Ghostly) with unlock progress, Golden Switch, Shimmering Veil, Rigidel, and selectors.
  * **Research & Tech Upgrades (H3):** Bingo Center research upgrades.
  * **Vaulted Upgrades (H3):** Upgrades placed in the vault to prevent accidental purchase.
  * **Available Upgrades (H3):** Standard upgrades with count indicator (`Available Upgrades (X available)`), "Buy all available upgrades" button, and status notes.
  * **Buildings (H3):** Building purchase buttons with production statistics and cost.
* **Wrinklers (H2):** Active wrinklers with buttons to inspect sucked cookies and pop them.
* **Status and Effects (H2):** Current game state — Dragon level and auras, Santa, active season with drop progress, Grandmapocalypse stage, Elder Pledge status, Golden Switch, Shimmering Veil, and active buffs with countdown timers.
* **Shimmers (H2):** Active Golden Cookies, Wrath Cookies, and Reindeer with time remaining.

---

## Feature Overview

### 1. Clicking the Big Cookie
The Big Cookie has an accessible label and can be clicked normally using your screen reader activation key or mouse. Below it are accessible text readouts for **Cookies per Click** and **Milk Progress**.

### 2. Buying Upgrades
Upgrades appear in the Store section, divided into clean categories:
* **Special & Season Switches:** Shows toggle switches and season switches. Season switch buttons announce current seasonal drop progress (e.g. `0/7 heart biscuits unlocked`, `14/14 Santa's gifts, 7/7 reindeer cookies unlocked`), active season status with countdown timer, and cancel options.
* **Available Upgrades:** Standard upgrades labeled with name, cost, and effect description. If an upgrade is currently unaffordable, an estimated "time until affordable" countdown is announced. If all standard upgrades are owned (0 available), a clear note explains that all standard upgrades are bought.
* **Buy All Upgrades Button:** Announces affordable and total counts (e.g. `Buy all available upgrades (3 affordable of 5)`), and speaks the names of all purchased upgrades upon activation.

### 3. Buying Buildings
Buildings appear under the **Buildings** heading. Each building shows its name, whether it is affordable, the current cost (adjusted for bulk buy: 1, 10, 100, Max), and the quantity owned. Below each building is an info line with production details. Unlocked buildings are revealed progressively to keep the list clean.

### 4. Ascending (Prestige)
* The **Legacy** button displays potential prestige and Heavenly Chip gains.
* On the Ascension screen, Heavenly Upgrades are labeled with name, cost, and owned state.
* Permanent upgrade slots open an accessible dialog: browse with **Up/Down Arrows**, press **Enter** to slot an upgrade, or press **Escape** to cancel.

---

## Minigames

Minigames unlock when their corresponding building reaches Level 1 (using sugar lumps). Each minigame includes an accessible Open/Close toggle button. Pressing **Escape** from anywhere will also close open minigame panels.

### Garden (Farm)
* **Arrow-Key Grid:** Focus the garden grid below the **Plots** heading. Navigate between plots using **Arrow Keys** (in NVDA focus mode). Each tile announces its coordinates (`R#, C#`), plant type, growth percentage, and harvest readiness.
* **Planting & Harvesting:** Press **Enter** or **Space** on an empty plot to plant your selected seed, or on a mature plant to harvest it.
* **Seeds & Soils:** Tab through the unlocked seed bag and soil selectors to change setups.
* **Harvest Mature Only:** An accessible button that harvests only fully mature plants, protecting growing parents and mutations.

### Grimoire (Wizard Tower)
* Magic bar displays current and maximum magic along with total spells cast.
* Each spell displays magic cost, cast availability, effect summary, and backfire odds.

### Pantheon (Temple)
* **Worship Slots:** Diamond, Ruby, and Jade slots display their current occupant or "Empty".
* **Spirits:** Each spirit lists its flavor title, tier descriptions, and dedicated placement buttons for Diamond, Ruby, and Jade slots.
* Swap counts and cooldown timers are displayed clearly.

### Stock Market (Bank)
* Each stock displays current price, shares owned, and trend direction (Rising, Falling, or Stable).
* Buy and Sell buttons are labeled with stock symbol and share quantity.

---

## Special Game Mechanics

* **Shimmers (Golden Cookies, Wrath Cookies, Reindeer):**
  * Spawns trigger an assertive announcement (e.g. *"A Golden Cookie has appeared!"*).
  * A warning fires 10 seconds before a shimmer fades.
  * The Shimmers panel contains clickable buttons for each active shimmer with countdown timers.
  * During Cookie Chains and Cookie Storms, individual spam is suppressed; start, step count, and finish totals are announced concisely.
  * **Fully compatible with automated clickers (Frozen Cookies).**
* **Wrinklers:** Spawns are announced. Each wrinkler has a button showing swallowed cookies (if *Eye of the wrinkler* is owned) and can be popped individually.
* **Sugar Lumps:** Status announcements indicate lump type (Normal, Bifurcated, Golden, Meaty, Caramelized), harvest readiness, and lump bank totals.
* **Krumblor the Dragon & Santa:** Fully accessible menus for leveling, petting, and choosing dragon auras.

---

## Keyboard Shortcuts

| Key | Context | Action |
| :--- | :--- | :--- |
| **H** / **Shift+H** | Browse Mode | Jump to next / previous section heading. |
| **Arrow Keys** | Garden Grid | Move between garden plots (focus mode). |
| **Enter** / **Space** | Focused Element | Activate button, purchase building/upgrade, or harvest/plant. |
| **Escape** | Any Open Panel | Dismiss minigames, Dragon menu, Santa menu, or dialog prompts. |
| **Ctrl+S** | Game Screen | Save game (triggers "Game saved" voice announcement). |

---

## Building from Source (Userscript)

If you modify the source code and wish to recompile the Tampermonkey userscript:

1. Clone this repository.
2. Edit `main.js`.
3. In a bash terminal, run:
   ```bash
   chmod +x build-userscript.sh
   ./build-userscript.sh
   ```
4. The generated `cookie-clicker-accessibility.user.js` will contain the bundled script ready for Tampermonkey import.

---

## Credits & Acknowledgements

* **Original Mod:** Created by [FioraXena](https://github.com/FioraXena/Cookie-Clicker-Enhanced-NVDA-Accessibility-Steam-Only-) (Version 12).
* **Continued Development:** Maintained and expanded by [Amsel](https://github.com/Amsel142857/Cookie-Clicker-Access) (Versions 13.0–13.8).
* **Frozen Cookies Compatibility Fix:** Implemented in this fork by [VIPPotato](https://github.com/VIPPotato/Cookie-Clicker-Access-frozen-cookies-fix).
* **Tampermonkey Userscript Port:** Contributed by [guilevi](https://github.com/guilevi).
* **Cookie Clicker:** Created by Orteil / DashNet.
