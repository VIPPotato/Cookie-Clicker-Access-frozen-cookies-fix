'use strict';
// Isolated source-linked Frozen Cookies UI checks. No game, installed mod, save,
// bootstrap, fc_main top-level initialization, or scheduled automation callback is run.
// Native choice activation below uses HTMLElement.click(). Synthetic key events
// test the adapter's div/anchor handlers, NOT trusted browser button defaults.
// A separate Node VM replay exercises the pinned combo's Garden state with inert
// effect recorders. It is not a live automation or ordinary-progression test.
// Run serially, with CC_TEST_SCRATCH set to the absolute Hermes scratch directory.
// Optional: CC_MAIN, CC_FROZEN_SOURCE (native source directory), CHROME_PATH.
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const vm = require('node:vm');
const repo = path.resolve(__dirname, '..');
const mainPath = path.resolve(process.env.CC_MAIN || path.join(repo, 'main.js'));
const nativePath = process.env.CC_FROZEN_SOURCE || 'C:/Users/hacke/AppData/Local/hermes/cache/scratch/frozen-cookies-797f1740-inspection';
const chrome = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const scratchRoot = process.env.CC_TEST_SCRATCH;
if (!scratchRoot || !path.isAbsolute(scratchRoot)) throw Error('Set CC_TEST_SCRATCH to the absolute Hermes scratch directory.');
if (!path.isAbsolute(nativePath)) throw Error('CC_FROZEN_SOURCE must be an absolute native source directory.');
const scratch = fs.mkdtempSync(path.join(scratchRoot, 'cc-frozen-browser-'));
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const source = fs.readFileSync(mainPath, 'utf8');
const gameSourcePath = process.env.CC_GAME_SOURCE || 'D:/Games/Steam/steamapps/common/Cookie Clicker/resources/app/src/main.js';
const gameSource = fs.readFileSync(gameSourcePath, 'utf8');
const pinned = {
  'fc_button.js': '12f59856faa655c4965fb1cd3459a32dea3a0317187d81b3dc163258cfe01596',
  'fc_main.js': '79e01acb53201cf029bbaab7b8f909e31c196ee594a66758cf004b84880dc233',
  'fc_preferences.js': '16ed7f38a535a814b43d0ac98f5cd2c8bd43c865ab1cc91b0a74a44f81de0ea4',
  'fc_infobox.js': '0e373472c078f75f79e897c10f1494cc26d50928fb121b1605a214dd38326e20',
  'fc_spells.js': '03ac860cf7534ae6b0293acf3e472379da960a96a0e11b3efb4092b2e17216f4',
  'jquery-3.6.0.min.js': 'ff1523fb7389539c84c65aba19260648793bb4f5e29329d2ee8804bc37a3fe6e',
  'jquery-ui-1.12.1.js': '4f455eb2ddf2094ee969f470f6bfac7adb4c057e8990a374e9da819e943c777d'
};
const native = {}, nativeFiles = [];
for (const [name, expected] of Object.entries(pinned)) {
  const file = path.join(nativePath, name), bytes = fs.readFileSync(file), hash = sha(bytes);
  if (hash !== expected) throw Error('Pinned native source hash mismatch: ' + file + ' (' + hash + ')');
  native[name] = bytes.toString('utf8'); nativeFiles.push({ name, path: file, bytes: bytes.length, sha256: hash });
}
function between(text, from, to) {
  const start = text.indexOf(from), end = text.indexOf(to, start + from.length);
  if (start < 0 || end < 0) throw Error('Missing exact source-extraction boundary: ' + from + ' / ' + to);
  return text.slice(start, end);
}
const spans = {
  shortcuts: between(native['fc_main.js'], 'document.addEventListener("keydown", function (event)', 'function writeFCButton('),
  clipboard: between(native['fc_main.js'], 'function copyToClipboard(', '// todo: add bind'),
  reset: between(native['fc_main.js'], 'function fcReset()', 'function saveFCData('),
  nativeKeys: between(gameSource, "AddEvent(window,'keyup'", "AddEvent(window,'visibilitychange'"),
  baseKeys: between(source, '// Disable game keyboard shortcuts', '// Escape closes open panels'),
  resetHook: between(source, "Game.registerHook('reset', function(hard)", "\n\t\tGame.Notify('Accessibility Enhanced'"),
  numeric: between(native['fc_main.js'], 'function userInputPrompt(', 'function cyclePreference('),
  start: between(native['fc_main.js'], 'function FCStart()', '// --- Reward Cookie Helper ---'),
  graphs: between(native['fc_main.js'], 'function statSpeed()', 'function updateCaches('),
  buffFactors: between(native['fc_main.js'], 'function clickBuffBonus()', 'function hasClickBuff()'),
  transpose: between(native['fc_main.js'], 'function transpose(', 'function smartTrackingStats('),
  format: between(native['fc_infobox.js'], 'function scientificNotation(', '// functionality for the infobox'),
  installer: between(native['fc_button.js'], 'function FCMenu()', '// Cycle through the preference values'),
  opener: between(native['fc_button.js'], '$("#logButton").before(', '$("<style>")'),
  showAndPrompt: between(source, '// Wrap Game.ShowMenu to announce menu open/close', '// Notification system:'),
  escape: between(source, '// Escape closes open panels', "document.addEventListener('keyup'"),
  baseFreeze: between(source, '// Wrap Game.UpdateMenu to suppress rebuilds', '// Wrap Game.RebuildUpgrades')
};
const scheduleTargets = [...new Set([...spans.start.matchAll(/set(?:Interval|Timeout)\(\s*(\w+)\s*,/g)].map(match => match[1]))];
const inventoryFile = path.join(nativePath, 'preference-inventory.json');
const inventory = JSON.parse(fs.readFileSync(inventoryFile, 'utf8'));
if (inventory.revision !== '797f1740011eac6ff6c1c1fe8c5d8b964d0522bd') throw Error('Wrong native preference inventory revision.');
const script = text => '<script>' + text.replace(/<\/script/gi, '<\\/script') + '</script>';
const gardenSourcePath = process.env.CC_GARDEN_SOURCE || 'D:/Games/Steam/steamapps/common/Cookie Clicker/resources/app/src/minigameGarden.js';
const gardenSource = fs.readFileSync(gardenSourcePath, 'utf8');
const comboSource = between(native['fc_spells.js'], 'function auto100ConsistencyComboAction()', 'function autoSweetAction()');
const canPlantSource = between(gardenSource, 'M.canPlant=function(me)', 'M.cursor=1;');
function replayGardenBranch() {
  const checks = [], observations = [], errors = [];
  const check = (name, passed) => checks.push({ name, passed: !!passed });
  function replay(options = {}) {
    const effects = [], seed = { id: 14, unlocked: options.unlocked ?? 0 };
    const garden = { plantsById: Array.from({ length: 15 }, () => ({})), plants: { whiskerbloom: seed },
      plot: Array.from({ length: 6 }, () => Array.from({ length: 6 }, () => [0, 0])), getCost: () => 1,
      harvestAll: () => effects.push({ name: 'harvestAll' }), clickTile: (x, y) => effects.push({ name: 'clickTile', x, y }) };
    garden.plantsById[14] = seed;
    if (options.existing) garden.plot[0][0] = [15, 10];
    const game = { cookies: options.cookies ?? 100, dragonLevel: options.dragon ?? 27,
      Objects: Object.fromEntries(['Farm', 'Mine', 'Factory', 'Bank', 'Temple', 'Wizard tower', 'Shipment', 'Alchemy lab', 'Time machine'].map(name => [name, { amount: 50, level: options.tower ?? 10 }])) };
    // Compile the exact native Garden affordability predicate, whose M is the
    // Garden owner. No fake unlock gate is added: this native method checks cost.
    vm.runInNewContext(canPlantSource, { M: garden, Game: game });
    const context = { G: options.noGarden ? null : garden, M: options.noGrimoire ? null : { magic: 0, magicM: 98 },
      Game: game, FrozenCookies: { auto100ConsistencyCombo: options.enabled ?? 1, autoSweet: 0, towerLimit: 0 },
      BuildingSpecialBuff: () => true, logEvent: (...args) => effects.push({ name: 'log', args }) };
    vm.createContext(context); vm.runInContext(comboSource, context);
    context.auto100ConsistencyComboAction.state = 3; // deliberately selected synthetic internal state, NOT reached by playing
    vm.runInContext('auto100ConsistencyComboAction()', context);
    const observation = { options, effects, seedUnlocked: seed.unlocked, state: context.auto100ConsistencyComboAction.state, enabled: context.FrozenCookies.auto100ConsistencyCombo,
      selectedSeed: garden.seedSelected ?? null, nativeCanPlant: garden.canPlant(seed) };
    observations.push(observation); return observation;
  }
  try {
    const actual = replay();
    check('conditional native combo stage calls harvest then every native planting endpoint', actual.effects.length === 37 && actual.effects[0].name === 'harvestAll' && actual.effects.slice(1).every(effect => effect.name === 'clickTile') && actual.selectedSeed === 14 && actual.state === 4);
    check('native combo covers all 36 distinct plot coordinates', new Set(actual.effects.slice(1).map(effect => effect.x + ',' + effect.y)).size === 36);
    check('source condition is locked seed, and actual native affordability has no unlock guard', actual.nativeCanPlant === true && actual.seedUnlocked === 0);
    for (const options of [{ enabled: 0 }, { noGarden: true }, { noGrimoire: true }, { dragon: 26 }, { tower: 9 }, { unlocked: 1 }, { existing: true }]) {
      const observation = replay(options);
      check(JSON.stringify(options) + ': actual gate skips Garden mutation', !observation.effects.some(effect => ['harvestAll', 'clickTile'].includes(effect.name)));
    }
    const poor = replay({ cookies: 0 });
    check('insufficient cookies refuse planting but do not prevent the earlier native harvest', poor.effects.length === 1 && poor.effects[0].name === 'harvestAll' && poor.nativeCanPlant === false && poor.state === 4);
  } catch (error) { errors.push({ kind: error.name, message: error.message, stack: error.stack }); }
  return { checks, observations, errors, checked: checks.length, failed: checks.filter(check => !check.passed),
    comboSha256: sha(comboSource), canPlantSha256: sha(canPlantSource), gardenSourcePath, gardenSourceSha256: sha(gardenSource),
    limits: 'Whole pinned combo body at forced synthetic state 3, with inert harvest/click endpoints and exact native canPlant. Does not establish normal combo progression, live Garden writes or combined gameplay.' };
}
const gardenReplay = replayGardenBranch();

function setupFixture() {
  window.l = id => document.getElementById(id);
  window.fixtureErrors = [];
  window.addEventListener('error', event => fixtureErrors.push({ kind: 'window.error', message: event.message, stack: event.error?.stack || null }));
  window.addEventListener('unhandledrejection', event => fixtureErrors.push({ kind: 'unhandledrejection', message: String(event.reason), stack: event.reason?.stack || null }));
  window.hooks = { logic: [], reset: [] };
  window.calls = { starts: 0, choices: [], refreshStore: 0, rebuildUpgrades: 0, menuEmpty: 0, baseRender: [], show: [], close: 0,
    forbidden: [], network: [], windows: [], plot: [], order: [], shortcutEffects: [] };
  window.App = { mods: { frozen_cookies: { disabled: false } } };
  window.AddEvent = (target, type, callback) => target.addEventListener(type, callback, false);
  window.timers = []; let timerId = 0;
  window.setTimeout = (callback, delay = 0, ...args) => { const item = { id: ++timerId, kind: 'timeout', callback, delay: Number(delay), args, canceled: false, ran: false }; timers.push(item); return item.id; };
  window.setInterval = (callback, delay = 0, ...args) => { const item = { id: ++timerId, kind: 'interval', callback, delay: Number(delay), args, canceled: false, ran: false }; timers.push(item); return item.id; };
  window.clearTimeout = window.clearInterval = id => { const item = timers.find(item => item.id === id); if (item) item.canceled = true; };
  for (const name of ['fetch', 'WebSocket']) window[name] = function () { calls.network.push(name); throw Error('Network forbidden in isolated fixture: ' + name); };
  // jQuery constructs an XHR for feature detection without opening/sending it.
  // Count actual I/O admission, not that harmless constructor probe.
  calls.xhrConstructions = 0;
  window.XMLHttpRequest = function InertXHR() { calls.xhrConstructions++; };
  for (const method of ['open', 'send']) window.XMLHttpRequest.prototype[method] = function () { calls.network.push('XMLHttpRequest.' + method); throw Error('XHR I/O forbidden in isolated fixture'); };
  window.open = (...args) => { calls.windows.push(args); return null; };
  window.loc = value => value;
  window.Beautify = value => String(value);
  window.rawFormatter = value => String(value);
  window.formatLong = []; window.formatShort = [];
  window.formatEveryThirdPower = () => value => String(value);
  window._ = { keys: Object.keys };
  window.G = window.B = window.T = window.M = {}; // synthetic, already available minigames; never initialized
  window.Game = {
    ready: true, mods: {}, Objects: {}, ObjectsById: [], UpgradesById: [], AchievementsById: [], onMenu: '', promptOn: 0, promptNoClose: false,
    T: 0, version: 2.053, fps: 30, cookies: 100, cookiesPs: 1, cookiesEarned: 100, cookiesReset: 0, heavenlyChips: 0, elderWrath: 0,
    goldenClicks: 0, missedGoldenClicks: 0, cookieClicks: 0, seed: 'isolated-ui-fixture', startDate: Date.now(), callingMenu: false,
    clickStr: 'onclick', keys: {}, prefs: {}, OnAscend: false, AscendTimer: 0, toSave: false,
    tooltip: { dynamic: false }, shimmerTypes: { golden: { last: 'none' } },
    registerMod(id, mod) { this.mods[id] = mod; },
    registerHook(type, callback) { (hooks[type] || (hooks[type] = [])).push(callback); },
    RefreshStore() { calls.refreshStore++; }, RebuildUpgrades() { calls.rebuildUpgrades++; },
    Has() { return false; }, HasUnlocked() { return false; }, HasAchiev() { return true; }, hasBuff() { return false; }, hasAura() { return false; },
    mouseCps() { return 1; }, HowMuchPrestige() { return 0; },
    // Host double follows native ShowMenu: do NOT clear children before UpdateMenu.
    // That old subtree is essential to the FC -> log/prefs transition regression.
    ShowMenu(what) {
      calls.show.push({ from: this.onMenu, requested: what ?? null });
      this.onMenu = !what || this.onMenu === what ? '' : what;
      l('menu').style.display = this.onMenu ? 'block' : 'none';
      this.UpdateMenu();
    },
    UpdateMenu() {
      calls.baseRender.push(this.onMenu);
      l('menu').innerHTML = this.onMenu ? '<div class="subsection"><div class="title">Native ' + this.onMenu + '</div><button id="baseControl">Base menu control</button></div>' : '';
    },
    // Synthetic base host, retaining native a.option inline ClosePrompt BEFORE
    // jQuery's subsequently attached FC Confirm callback. Close hides, not empties.
    Prompt(content, options) {
      this.promptOn = 1; this.promptNoClose = false; l('prompt').style.display = 'block';
      l('promptContent').innerHTML = content;
      l('promptOptions').innerHTML = options.map((option, index) => '<a class="option" id="promptOption' + index + '" onclick="Game.ClosePrompt();">' + option + '</a>').join(' ');
    },
    ClosePrompt() { calls.close++; calls.order.push({ kind: 'close', input: l('fcGenericInput')?.value || null }); this.promptOn = 0; l('prompt').style.display = 'none'; }
  };
  // Display-only dependency DTOs. These are NOT Frozen Cookies calculation or
  // automation implementations, and are not claimed as mechanics coverage.
  const rec = { id: 0, type: 'building', cost: 100, delta_cps: 1, base_delta_cps: 1, efficiency: 100, efficiencyScore: 1, purchase: { name: 'Synthetic Cursor', unlocked: 1 } };
  window.nextPurchase = window.nextChainedPurchase = () => rec;
  window.recommendationList = () => [rec];
  window.bestBank = () => ({ cost: 0, efficiency: 0 });
  for (const name of ['cpsBonus', 'clickBuffBonus', 'baseCps', 'effectiveCps']) window[name] = () => 1;
  for (const name of ['cookieValue', 'maxLuckyValue', 'calculateChainValue', 'chainBank', 'gcPs', 'wrinklerValue', 'chocolateValue', 'baseClickingCps', 'luckyBank', 'luckyFrenzyBank', 'cookieEfficiency']) window[name] = () => 0;
  window.divCps = (value, cps) => value / cps;
  window.liveWrinklers = () => [];
  window.nextHC = () => 'Synthetic estimate';
  for (const name of ['autoCookie', 'fcClickCookie', 'autoFrenzyClick', 'autoGSBuy', 'autoGodzamokAction', 'autoCast', 'autoTicker', 'autoFTHOFComboAction',
    'auto100ConsistencyComboAction', 'autoSweetAction', 'autoEasterAction', 'autoHalloweenAction', 'autoBankAction', 'autoBrokerAction', 'autoLoanBuy',
    'autoDragonAction', 'petDragonAction', 'autoDragonAura0Action', 'autoDragonAura1Action', 'autoDragonOrbsAction', 'autoSugarFrenzyAction', 'autoWorship0Action', 'autoWorship1Action', 'autoWorship2Action',
    'buyOtherUpgrades', 'autoCycliusAction', 'recommendedSettingsAction', 'minigameCheckAction', 'smartTrackingStats', 'PlaySound']) {
    window[name] = function forbiddenAutomationCallback() { calls.forbidden.push(name); throw Error('Forbidden native action callback: ' + name); };
  }
  for (const name of ['Win', 'Reset', 'WriteSave', 'CollectWrinklers', 'SparkleAt', 'ClickCookie', 'Ascend', 'LoadMod']) Game[name] = (...args) => { calls.forbidden.push({ name, args }); throw Error('Forbidden game action: ' + name); };
}

async function browserFixture(data) {
  const result = { scenario: data.scenario, checks: [], preconditions: [], blocks: [], errors: [], samples: {}, limitations: [
    'Source-linked isolated Chrome DOM/events only; no actual game, NVDA, audible speech or virtual-cursor acceptance.',
    'Choice buttons are tested with HTMLElement.click(); synthetic KeyboardEvent does not trigger trusted browser Enter/Space defaults.',
    'Host Game.ShowMenu/Prompt/ClosePrompt and read-only calculation DTOs are synthetic; FC UI builders, handlers, validators, FCStart and graph dialog calls are source-extracted unchanged.',
    'All timers are inert except explicitly whitelisted prompt/menu-focus callbacks and native UI-only one-second refresh attempts. No automation callback executes.',
    'Exact native document letter listener and base window key handlers are installed, with inert effect recorders. Synthetic events do not establish trusted browser editing, in-game delivery or NVDA commands. Infobox updateTimers/drawCircles and graph/saveStats bodies are pinned native producers; their calculation inputs are synthetic.'
  ] };
  let phase = 'setup';
  const mod = Game.mods['screen reader accessibility'];
  const text = value => String(value || '').replace(/\s+/g, ' ').trim();
  const name = element => element ? text(element.getAttribute('aria-label') || (element.getAttribute('aria-labelledby') || '').split(/\s+/).filter(Boolean).map(id => l(id)?.textContent || '').join(' ') || element.textContent) : '';
  const desc = element => element ? text((element.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean).map(id => l(id)?.textContent || '').join(' ')) : '';
  const check = (label, passed, detail) => result.checks.push({ phase, name: label, passed: !!passed, ...(detail === undefined ? {} : { detail }) });
  function precondition(label, passed, detail) {
    result.preconditions.push({ phase, name: label, passed: !!passed, ...(detail === undefined ? {} : { detail }) });
    if (!passed) { const error = Error(label); error.name = 'FixturePreconditionError'; throw error; }
  }
  async function section(label, callback, requires = true) {
    phase = label;
    if (!requires) { result.blocks.push({ name: label, status: 'not-reached', reason: 'Missing adapter API or failed earlier fixture precondition' }); return; }
    try { await callback(); result.blocks.push({ name: label, status: 'completed' }); }
    catch (error) { result.blocks.push({ name: label, status: 'aborted' }); result.errors.push({ phase: label, kind: error.name, message: error.message, stack: error.stack }); }
  }
  function key(element, value, extra = {}) {
    precondition('keyboard target exists and is connected', !!element?.isConnected, element?.id || null);
    const code = value === 'Escape' ? 27 : value === 'Enter' ? 13 : value === ' ' ? 32 : /^[a-z]$/i.test(value) ? value.toUpperCase().charCodeAt(0) : 0;
    const event = new KeyboardEvent('keydown', { key: value, keyCode: code, which: code, bubbles: true, cancelable: true, ...extra });
    element.dispatchEvent(event); return event;
  }
  const focusEvents = [];
  document.addEventListener('focusin', event => focusEvents.push({ phase, type: 'in', id: event.target.id, action: event.target.getAttribute?.('data-a11y-frozen-action') || null }));
  document.addEventListener('focusout', event => focusEvents.push({ phase, type: 'out', id: event.target.id, connected: event.target.isConnected, related: event.relatedTarget?.id || null }));
  function focus(element) {
    precondition('focus target connected and rendered', !!element?.isConnected && element.getClientRects().length > 0, element?.id || null);
    element.focus(); precondition('native activeElement reaches target', document.activeElement === element, { target: element.id, active: document.activeElement?.id });
  }
  // Code evaluation is limited to hash-checked pinned upstream files and exact
  // spans of the explicitly selected local CC_MAIN, never page/user input.
  const globalEval = sourceText => (0, eval)(sourceText);
  const installAccessWrappers = () => { new Function('MOD', data.spans.showAndPrompt)(mod); new Function('MOD', data.spans.baseFreeze)(mod); new Function('MOD', data.spans.baseKeys + data.spans.escape)(mod); };
  const submitted = [];
  mod.announce = value => submitted.push(String(value)); mod.announceUrgent = value => submitted.push(String(value));
  const numericFields = { cookieClickSpeed: 250, frenzyClickSpeed: 250, mineMax: 100, factoryMax: 100, HCAscendAmount: 1, minCpSMult: 7,
    minLoanMult: 7, manaMax: 100, minASFMult: 100, orbMax: 100, manBankMins: 1, maxSpecials: 1 };
  let defaults, originalOpenerAttributes, nativeInstaller, originalPromptFunction;
  const attrs = element => JSON.stringify([...element.attributes].map(attr => [attr.name, attr.value]).sort((a, b) => a[0].localeCompare(b[0])));
  const settings = () => JSON.stringify({ choices: Object.fromEntries(Object.entries(FrozenCookies.preferenceValues).filter(([, item]) => item.display).map(([key]) => [key, FrozenCookies[key]])),
    numeric: Object.fromEntries(Object.keys(numericFields).map(key => [key, FrozenCookies[key]])) });
  const schedule = () => JSON.stringify(timers.map(timer => ({ id: timer.id, delay: timer.delay, canceled: timer.canceled, ran: timer.ran })));
  const automationSchedule = () => JSON.stringify(timers.filter(timer => timer.kind === 'interval' || timer.callback?.name === 'forbiddenAutomationCallback' ||
    timer.callback === window.saveStats || String(timer.callback).includes('smartTrackingStats(')).map(timer => ({ id: timer.id, delay: timer.delay, canceled: timer.canceled, ran: timer.ran })));
  function loadNative() {
    window.FrozenCookies = { version: '2.052.8', branch: 'erb-', currentBank: { cost: 0 }, targetBank: { cost: 0 }, frenzyTimes: {}, trackedStats: [],
      frequency: 100, lastHCTime: Date.now(), lastHCAmount: 0, maxHCPercent: 0, lastGraphDraw: 0, minDelay: 1000, ...numericFields };
    globalEval(data.nativePreferences);
    for (const [key, item] of Object.entries(FrozenCookies.preferenceValues)) if (item.display) FrozenCookies[key] = item.default;
    globalEval(data.nativeInfobox); globalEval(data.spans.buffFactors); globalEval(data.spans.numeric); globalEval(data.spans.graphs); globalEval(data.spans.transpose); globalEval(data.spans.start);
    window.probabilitySpan = (type, now, chance) => now + chance * 300;
    window.maxCookieTime = () => 300;
    window.delayAmount = () => 0;
    window.decodeHtml = value => $('<div>').html(value).text();
    Game.buffs = {}; Game.shimmerTypes.golden.time = 0;
    calls.infobox = [];
    const actualCircles = window.drawCircles;
    window.drawCircles = function (rows, ...args) { calls.infobox.push(rows.map(row => ({ name: row.name, display: row.display }))); return actualCircles.call(this, rows, ...args); };
    precondition('every exact native FCStart timer target is explicitly supplied', data.scheduleTargets.every(name => typeof window[name] === 'function'),
      data.scheduleTargets.filter(name => typeof window[name] !== 'function'));
    const actualStart = window.FCStart;
    window.FCStart = function () { calls.starts++; calls.order.push({ kind: 'start', promptOn: Game.promptOn }); return actualStart.apply(this, arguments); };
    globalEval(data.nativeButtons);
    // Only these producer bodies execute, never fc_main's top-level setup.
    // Their consequential endpoints record into disposable fixture arrays.
    globalEval(data.spans.clipboard); globalEval(data.spans.reset);
    window.prompt = (...args) => { calls.shortcutEffects.push({ name: 'clipboard', args }); return null; };
    window.toggleFrozen = (...args) => calls.shortcutEffects.push({ name: 'toggleFrozen', args });
    for (const name of ['Toggle', 'WriteSave', 'Notify', 'CollectWrinklers', 'oldReset']) Game[name] = (...args) => {
      calls.shortcutEffects.push({ name, args }); return name === 'WriteSave' ? 'INERT EXPORT' : undefined;
    };
    window.B = { goodsById: [{}, {}], sellGood: (...args) => calls.shortcutEffects.push({ name: 'sellGood', args }) };
    window.G = { harvestAll: (...args) => calls.shortcutEffects.push({ name: 'harvestAll', args }) };
    Game.Reset = window.fcReset;
    globalEval(data.spans.shortcuts);
    nativeInstaller = window.FCMenu; originalPromptFunction = window.userInputPrompt;
    originalOpenerAttributes = attrs(l('fcButton'));
    const actualChoice = window.setPreferenceDirect;
    window.setPreferenceDirect = function (key, value) { calls.choices.push({ key, value }); return actualChoice.apply(this, arguments); };
    const empty = $.fn.empty;
    $.fn.empty = function () { if ([...this].some(element => element === l('menu'))) calls.menuEmpty++; return empty.apply(this, arguments); };
    $.jqplot = (...args) => { calls.plot.push(args); return {}; };
    Game.mods.frozen_cookies = { init: 0 };
    FCMenu(); // UI-only installer, not FCStart or initialization
    defaults = settings();
  }
  const api = ['initFrozenCookiesAccessibility', 'updateFrozenCookiesAccessibility', 'clearFrozenCookiesAccessibility'].every(method => typeof mod[method] === 'function');
  let uiReady = false, focusReady = false;
  function update() { Game.T += 30; mod.updateFrozenCookiesAccessibility(); }
  function pendingUI() {
    // Only actual accessibility prompt/default/menu-focus closures are delivered.
    // Never drain arbitrary callbacks or the FCStart action schedules.
    const allowed = timers.filter(timer => !timer.ran && !timer.canceled && timer.kind === 'timeout' && timer.delay <= 150 &&
      /focusPromptDefault|btnId|fcButton|enhanceMenuHeadings|enhanceOptionsMenu|enhanceInfoMenu/.test(String(timer.callback)));
    allowed.sort((a, b) => a.delay - b.delay || a.id - b.id);
    for (const timer of allowed) { timer.ran = true; timer.callback(...timer.args); }
    return allowed;
  }
  function nativeRefreshAttempt() {
    const timer = timers.find(timer => !timer.ran && !timer.canceled && timer.delay === 1000 && /Game\.callingMenu = false/.test(String(timer.callback)) && /Game\.UpdateMenu\(\)/.test(String(timer.callback)));
    if (timer) { timer.ran = true; timer.callback(...timer.args); return true; }
    Game.UpdateMenu(); return false;
  }
  const entries = () => Object.entries(FrozenCookies.preferenceValues).filter(([, item]) => item.display);
  const row = key => l(key + 'Button_0')?.closest('.listing');
  const action = extra => row(extra.preference)?.querySelector('a.option[id="' + extra.id + '"]');
  function reopen() {
    if (Game.promptOn) Game.ClosePrompt();
    if (Game.onMenu === 'fc_menu') Game.ShowMenu();
    Game.ShowMenu('fc_menu'); update(); pendingUI();
  }
  await section('fixture and load order', async () => {
    if (document.readyState !== 'complete') await new Promise(resolve => window.addEventListener('load', resolve, { once: true }));
    window.focus(); focusReady = document.hasFocus();
    precondition('isolated Chrome document has native focus', focusReady, { hasFocus: document.hasFocus(), active: document.activeElement?.id });
    focus(l('outside')); focus(l('statsButton'));
    precondition('native focus events were delivered', focusEvents.some(event => event.id === 'outside') && focusEvents.some(event => event.id === 'statsButton'));
    check('adapter API exists', api, { missing: ['initFrozenCookiesAccessibility', 'updateFrozenCookiesAccessibility', 'clearFrozenCookiesAccessibility'].filter(method => typeof mod[method] !== 'function'), category: api ? 'available' : 'missing-feature' });
    check('support toggles are absent from the mod object', !('frozenCookiesAccessibilityEnabled' in mod) && !('greenhouseAccessibilityEnabled' in mod));
    check('no support preference envelope is saved', mod.save() === '', mod.save());
    globalEval(data.spans.nativeKeys);
    if (data.scenario === 'access-first') {
      installAccessWrappers();
      if (api) {
        const before = Game.UpdateMenu, timersBefore = schedule();
        mod.initFrozenCookiesAccessibility(); mod.initFrozenCookiesAccessibility(); update();
        check('absent native mod does not wrap updater, shield input, announce or schedule actions', !mod._frozenCookiesAccessibility && !mod._frozenCookiesShortcutShield && Game.UpdateMenu === before && schedule() === timersBefore && calls.starts === 0 && submitted.length === 0);
        window.FrozenCookies = { version: '2.052.8', branch: 'erb-' }; update();
        check('early global alone is not native readiness', !mod._frozenCookiesAccessibility && calls.starts === 0);
      }
      loadNative();
    } else { loadNative(); installAccessWrappers(); }
    const stateBefore = settings(), schedulesBefore = schedule(), initialHooks = hooks.logic.length;
    if (api) { mod.initFrozenCookiesAccessibility(); mod.initFrozenCookiesAccessibility(); update(); }
    check('discovery and double init never change native settings or schedules', settings() === stateBefore && schedule() === schedulesBefore && calls.starts === 0);
    if (api) check('exactly one bounded logic hook', hooks.logic.length === (data.scenario === 'access-first' ? initialHooks : initialHooks + 1) && hooks.logic.length === 1, hooks.logic.length);
    Game.ShowMenu('fc_menu'); if (api) update();
    precondition('actual pinned native builder rendered complete control schema', l('fcEfficiencyTable') && document.querySelectorAll('#menu button.fc-multichoice-btn').length === data.inventory.counts.choiceButtonsIfAllValuesValid);
    check('native schema and retained inventory agree exactly', JSON.stringify(entries().map(([key, item]) => ({ key, hint: item.hint, display: item.display, default: item.default, extras: item.extras || null }))) ===
      JSON.stringify(data.inventory.entries.filter(item => item.display).map(item => ({ key: item.key, hint: item.hint, display: item.display, default: item.default, extras: item.extras }))));
    check('all native choice groups and extra occurrences render', entries().length === 64 && document.querySelectorAll('#menu a.option').length === 14 && document.querySelectorAll('#menu .fc-section-heading').length === 13);
    check('native defaults remain intact after opening', settings() === defaults);
    uiReady = true;
  });
  const enabled = api && uiReady && focusReady;
  await section('native letters, editing, save and shield lifecycle', async () => {
    const nativeFC = FrozenCookies, nativeMod = Game.mods.frozen_cookies;
    const platformListenerAPI = EventTarget.prototype.addEventListener;
    const originalShortcut = FrozenCookies.FCshortcuts;
    const originalTracked = FrozenCookies.trackedStats;
    const savedSettings = settings(), savedStarts = calls.starts, savedSchedule = schedule();
    const effects = () => JSON.stringify(calls.shortcutEffects);
    const positiveControls = [];
    const letters = ['a', 'b', 'c', 'e', 'r', 's', 'w'];
    const flags = [{}, { ctrlKey: true }, { altKey: true }, { shiftKey: true }, { metaKey: true },
      { repeat: true }, { ctrlKey: true, shiftKey: true, repeat: true }, { ctrlKey: true, altKey: true, metaKey: true }];
    const host = document.createElement('div'); host.id = 'editingFixture';
    host.innerHTML = '<input id="inlineInput"><textarea id="inlineTextarea"></textarea><div id="inlineEditable" contenteditable="true"><span id="editableChild">text</span></div><textarea id="readonlyExport" readonly>abcersw</textarea><button id="letterButton">Other control</button>';
    document.body.appendChild(host);
    const targets = [document.body, l('inlineInput'), l('inlineTextarea'), l('inlineEditable'), l('editableChild'), l('readonlyExport'), l('letterButton')];
    let targetKeys = 0, ancestorKeys = 0, htmlKeys = 0, docKeys = 0, pairedReleases = 0, shortcutWrites = 0;
    const targetObserver = event => { if (event.target === event.currentTarget) targetKeys++; }, ancestorObserver = () => ancestorKeys++, htmlObserver = () => htmlKeys++, docObserver = () => docKeys++;
    for (const target of targets.slice(1)) target.addEventListener('keydown', targetObserver);
    host.addEventListener('keydown', ancestorObserver); document.documentElement.addEventListener('keydown', htmlObserver); document.addEventListener('keydown', docObserver);
    let shortcutValue = originalShortcut;
    Object.defineProperty(FrozenCookies, 'FCshortcuts', { configurable: true, enumerable: true, get: () => shortcutValue, set: value => { shortcutWrites++; shortcutValue = value; } });
    for (const value of [0, 1]) {
      shortcutValue = value; update();
      for (const target of targets) for (const letter of letters) for (const extra of flags) {
        const before = effects(), saves = submitted.length; Game.toSave = false;
        const event = key(target, extra.shiftKey ? letter.toUpperCase() : letter, extra);
        check('FCshortcuts=' + value + ' ' + (target.id || 'body') + ' ' + letter + ' ' + JSON.stringify(extra) + ': native actions suppressed', effects() === before);
        const baseSave = letter === 's' && extra.ctrlKey;
        check('editing default preserved except native Ctrl+S ' + value + ' ' + (target.id || 'body') + ' ' + letter + ' ' + JSON.stringify(extra), event.defaultPrevented === !!baseSave && Game.toSave === !!baseSave);
        if (baseSave) check('Ctrl+S feedback retains exact base key semantics', submitted.length === saves + (extra.shiftKey ? 0 : 1) && (extra.shiftKey || submitted.at(-1) === 'Game saved.'));
        Game.keys[event.keyCode] = 1;
        target.dispatchEvent(new KeyboardEvent('keyup', { key: letter, keyCode: event.keyCode, bubbles: true, ...extra }));
        if (Game.keys[event.keyCode] === 0) pairedReleases++;
      }
    }
    check('native release clears every consumed letter without another action', pairedReleases === targets.length * letters.length * flags.length * 2 && calls.shortcutEffects.length === 0);
    check('target, delegated ancestor and later same-HTML-node handlers all run', targetKeys === 6 * 7 * 8 * 2 && ancestorKeys === targetKeys && htmlKeys === 7 * 7 * 8 * 2);
    check('only the known letters are stopped before native document listener', docKeys === 0);
    const outside = key(l('inlineInput'), 'x', { ctrlKey: true });
    check('unclaimed key reaches document and retains defaults', docKeys === 1 && !outside.defaultPrevented);
    const prevented = e => e.preventDefault(); l('inlineInput').addEventListener('keydown', prevented);
    key(l('inlineInput'), 'r'); l('inlineInput').removeEventListener('keydown', prevented);
    check('already consumed field key cannot escape to native Reset', calls.shortcutEffects.length === 0);
    for (const [ascend, timer] of [[true, 0], [false, 5], [false, 0], [false, '0']]) {
      Game.OnAscend = ascend; Game.AscendTimer = timer; Game.toSave = false;
      const event = key(l('inlineInput'), 's', { ctrlKey: true });
      check('Ctrl+S preserves native ascension gate ' + ascend + ':' + JSON.stringify(timer), Game.toSave === (!ascend && timer == 0) && event.defaultPrevented === (!ascend && timer == 0) && calls.shortcutEffects.length === 0);
    }
    Game.OnAscend = false; Game.AscendTimer = 0;
    Game.promptOn = 1; Game.toSave = false; key(l('inlineInput'), 's', { ctrlKey: true });
    check('prompt keeps base Ctrl+S save and feedback without native FC action', Game.toSave && calls.shortcutEffects.length === 0); Game.promptOn = 0;
    check('discovery and all shielded chords never write FCshortcuts or restart automation', shortcutWrites === 0 && calls.starts === savedStarts && schedule() === savedSchedule);
    const shieldAPI = ['clearFrozenCookiesShortcutShield', 'updateFrozenCookiesShortcutShield'].every(name => typeof mod[name] === 'function');
    check('shield has an explicit removable/rebindable lifecycle', shieldAPI);
    if (shieldAPI) {
      mod.clearFrozenCookiesShortcutShield(); mod.clearFrozenCookiesShortcutShield();
      precondition('explicit teardown actually removes the shield', !mod._frozenCookiesShortcutShield);
      for (const letter of letters) {
        calls.shortcutEffects.length = 0; key(document.body, letter);
        const names = calls.shortcutEffects.map(effect => effect.name);
        const expected = { a: ['Toggle', 'toggleFrozen'], b: ['clipboard'], c: ['Toggle', 'toggleFrozen'], e: ['WriteSave', 'clipboard'],
          r: ['CollectWrinklers', 'sellGood', 'sellGood', 'harvestAll', 'oldReset'], s: ['WriteSave'], w: ['Notify'] }[letter];
        check('native positive control reaches exact inert effects for ' + letter, JSON.stringify(names) === JSON.stringify(expected), names);
        positiveControls.push({ letter, effects: [...calls.shortcutEffects] });
      }
      calls.shortcutEffects.length = 0; shortcutValue = 0; Game.toSave = false;
      const beforeNativeSave = submitted.length, nativeSave = key(document.body, 's', { ctrlKey: true });
      check('unshielded native Ctrl+S control queues save once with base feedback', nativeSave.defaultPrevented && Game.toSave && submitted.length === beforeNativeSave + 1 && submitted.at(-1) === 'Game saved.' && calls.shortcutEffects.length === 0);
      shortcutValue = 1;
      calls.shortcutEffects.length = 0; update(); const stable = mod._frozenCookiesShortcutShield;
      for (let i = 0; i < 5; i++) update();
      check('repeated discovery keeps one shield identity', stable === mod._frozenCookiesShortcutShield);
      key(document.body, 'r'); check('rebind blocks actual pre-reset Garden/stock mutation path', calls.shortcutEffects.length === 0);
      new Function('MOD', data.spans.resetHook)(mod);
      precondition('production reset callback was registered exactly once', hooks.reset.length === 1);
      hooks.reset[0](false);
      check('production reset callback retires menu and shortcut owners', !mod._frozenCookiesAccessibility && !mod._frozenCookiesShortcutShield);
      update(); key(document.body, 'r');
      check('next discovery rebinds input and native menu after reset teardown', !!mod._frozenCookiesAccessibility && !!mod._frozenCookiesShortcutShield && calls.shortcutEffects.length === 0);
      // Disabling/removal occurs between discovery and delivery: no stale shield.
      for (const disabled of ['descriptor', 'registration', 'not-ready', 'web-host']) {
        if (disabled === 'descriptor') App.mods.frozen_cookies.disabled = true;
        if (disabled === 'registration') delete Game.mods.frozen_cookies;
        if (disabled === 'not-ready') nativeMod.init = function () {};
        if (disabled === 'web-host') window.App = null;
        const speech = submitted.length; key(document.body, 'a');
        check(disabled + ': no stale input shield before next discovery tick', !mod._frozenCookiesShortcutShield && calls.shortcutEffects.length === 2);
        calls.shortcutEffects.length = 0; update(); update();
        check(disabled + ': no adapter, warning or native setting change', !mod._frozenCookiesAccessibility && submitted.length === speech && shortcutWrites === 0);
        window.App = { mods: { frozen_cookies: { disabled: false } } }; Game.mods.frozen_cookies = nativeMod; nativeMod.init = 0; update();
        key(document.body, 'a'); check(disabled + ': automatic re-entry protects letters again', !!mod._frozenCookiesShortcutShield && calls.shortcutEffects.length === 0);
      }
      const opener = l('fcButton'); opener.remove(); update();
      key(document.body, 'r');
      check('missing menu capability never releases initialized FC shortcuts', !mod._frozenCookiesAccessibility && !!mod._frozenCookiesShortcutShield && calls.shortcutEffects.length === 0);
      l('logButton').before(opener); update();
      const uiFields = Object.fromEntries(['preferenceValues', 'currentBank', 'targetBank', 'frenzyTimes'].map(name => [name, nativeFC[name]]));
      for (const name of Object.keys(uiFields)) delete nativeFC[name]; update(); key(document.body, 'r');
      check('missing UI state does not revoke initialized shortcut protection', !mod._frozenCookiesAccessibility && !!mod._frozenCookiesShortcutShield && calls.shortcutEffects.length === 0);
      Object.assign(nativeFC, uiFields); update();
      window.FrozenCookies = { ...nativeFC }; update();
      key(document.body, 'r'); check('new native identity is shielded without accumulating listeners', calls.shortcutEffects.length === 0 && !!mod._frozenCookiesAccessibility);
      window.FrozenCookies = nativeFC; update();
    }
    shortcutValue = originalShortcut;
    Object.defineProperty(nativeFC, 'FCshortcuts', { configurable: true, enumerable: true, writable: true, value: originalShortcut });
    nativeFC.trackedStats = originalTracked;
    check('shortcut preference and other native choices are preserved', settings() === savedSettings);
    check('shared event-registration API was never rewritten', EventTarget.prototype.addEventListener === platformListenerAPI);
    for (const target of targets.slice(1)) target.removeEventListener('keydown', targetObserver);
    host.removeEventListener('keydown', ancestorObserver); document.documentElement.removeEventListener('keydown', htmlObserver); document.removeEventListener('keydown', docObserver);
    host.remove(); Game.toSave = false; calls.shortcutEffects.length = 0; update();
    result.samples.shortcutPositiveControls = positiveControls;
  }, enabled);
  await section('icon and menu transitions', async () => {
    const opener = l('fcButton');
    check('native icon is one named keyboard button', opener.getAttribute('role') === 'button' && opener.tabIndex === 0 && name(opener) === 'Frozen Cookies' && opener.getAttribute('aria-controls') === 'menu');
    check('icon expanded state reflects FC menu', opener.getAttribute('aria-expanded') === 'true');
    focus(opener); const before = calls.show.length; key(opener, ' ');
    check('Space reaches exactly one original icon click and closes', calls.show.length === before + 1 && Game.onMenu === '' && opener.getAttribute('aria-expanded') === 'false');
    key(opener, 'Enter'); check('Enter reaches native opener and expands', Game.onMenu === 'fc_menu' && opener.getAttribute('aria-expanded') === 'true');
    const visibleBefore = calls.show.length;
    for (const extra of [{ repeat: true }, { ctrlKey: true }, { altKey: true }, { shiftKey: true }, { metaKey: true }]) key(opener, 'Enter', extra);
    Game.promptOn = 1; key(opener, 'Enter'); Game.promptOn = 0;
    opener.setAttribute('aria-disabled', 'true'); key(opener, 'Enter'); opener.removeAttribute('aria-disabled');
    check('modified repeated covered and disabled icon keys refuse activation', calls.show.length === visibleBefore && Game.onMenu === 'fc_menu');
    const originalBank = settings();
    l('fcOpenLogPanel').click(); pendingUI();
    check('FC to log renders the new base menu despite old FC heading', Game.onMenu === 'log' && l('baseControl') && !l('autoClickButton_0') && opener.getAttribute('aria-expanded') === 'false');
    mod.enhanceInfoMenu(); const logTitle = l('menu').querySelector('.subsection > .title');
    Game.ShowMenu('prefs'); pendingUI(); mod.enhanceOptionsMenu();
    check('log to prefs renders Options rather than retaining log heading', Game.onMenu === 'prefs' && l('menu').querySelector('.subsection > .title') !== logTitle && l('menu').textContent.includes('prefs'));
    key(opener, ' '); pendingUI();
    check('icon switches from enhanced Options to FC', Game.onMenu === 'fc_menu' && !!l('autoClickButton_0') && !l('baseControl') && opener.getAttribute('aria-expanded') === 'true');
    check('switching menus never commits native settings', settings() === originalBank);
  }, enabled);
  await section('complete native schema and choices', async () => {
    reopen(); const beforeFocus = settings(), schedulesBefore = schedule();
    for (const [keyName, item] of entries()) {
      const group = row(keyName), hint = group?.querySelector('.fc-hint-label');
      check(keyName + ': native hint names one listing group', group?.getAttribute('role') === 'group' && name(group) === text(hint?.textContent), { role: group?.getAttribute('role'), name: name(group), hint: text(hint?.textContent) });
      for (let index = 0; index < item.display.length; index++) {
        const button = l(keyName + 'Button_' + index);
        check(keyName + ':' + index + ': retains native button text and pressed state', button?.tagName === 'BUTTON' && text(button.textContent) === text(item.display[index]) &&
          [null, 'button'].includes(button.getAttribute('role')) && button.getAttribute('aria-pressed') === String(index === FrozenCookies[keyName]) && !button.disabled && !button.hasAttribute('aria-disabled'));
        focus(button);
      }
    }
    check('focusing every native choice changes no settings or schedules', settings() === beforeFocus && schedule() === schedulesBefore);
    const nativeButton = l('autoClickButton_0'), priorChoices = calls.choices.length;
    check('synthetic Enter and Space are not adapter-generated native-button clicks', !key(nativeButton, 'Enter').defaultPrevented && !key(nativeButton, ' ').defaultPrevented && calls.choices.length === priorChoices,
      'This asserts the absence of duplicate adapter activation, NOT browser default keyboard activation.');
    const fallback = Game.oldUpdateMenu, root = l('menu'), stableButtons = [...root.querySelectorAll('button.fc-multichoice-btn')], beforeEmpty = calls.menuEmpty;
    for (const [keyName, item] of entries()) {
      for (let index = 0; index < item.display.length; index++) {
        const button = l(keyName + 'Button_' + index), starts = calls.starts, count = calls.choices.length, updater = Game.UpdateMenu;
        focus(button); button.click();
        check(keyName + ':' + index + ': native direct selection runs once and retains focused node', calls.starts === starts + 1 && calls.choices.length === count + 1 &&
          FrozenCookies[keyName] === index && Game.UpdateMenu !== updater && l(button.id) === button && document.activeElement === button && button.getAttribute('aria-pressed') === 'true' && button.classList.contains('selected'));
        check(keyName + ':' + index + ': one selected choice in same native group', [...row(keyName).querySelectorAll('button.fc-multichoice-btn')].every((element, candidate) =>
          element.getAttribute('aria-pressed') === String(candidate === index) && element.classList.contains('selected') === (candidate === index)));
      }
    }
    check('all native selections preserve cached fallback and actual DOM generation', Game.oldUpdateMenu === fallback && calls.menuEmpty === beforeEmpty && stableButtons.every(button => l(button.id) === button));
    check('native choices still perform their own store and upgrade refreshes', calls.refreshStore === calls.choices.length && calls.rebuildUpgrades === calls.choices.length);
    for (const [keyName, item] of entries()) FrozenCookies[keyName] = item.default; update();
    check('only synthetic fixture fields were restored to native defaults', settings() === defaults);
    const notice = l('a11yFrozenSnapshot');
    check('snapshot notice explains close and reopen freshness', !!notice && /snapshot/i.test(notice.textContent) && /close/i.test(notice.textContent) && /reopen/i.test(notice.textContent));
    check('native warnings notes and information remain non-live', !!root.querySelector('.fc-warning') && root.querySelectorAll('.fc-section-heading').length === 13 &&
      !root.querySelector('[aria-live], [role="status"], [role="alert"]') && [...root.querySelectorAll('.fc-section-heading')].every(element => element.getAttribute('role') !== 'button'));
    check('major native titles are headings and efficiency table retains headers', [...root.querySelectorAll('.subsection > .title')].every(element => element.getAttribute('role') === 'heading') && root.querySelectorAll('#fcEfficiencyTable th').length === 5);
  }, enabled);
  await section('periodic refresh and installer replacement', async () => {
    reopen(); const button = l('autoBuyButton_0'); focus(button);
    const root = l('menu'), nodes = [...root.childNodes], empty = calls.menuEmpty, saved = settings(), schedulesBefore = automationSchedule(), announcements = submitted.length;
    root.scrollTop = 333; const scroll = root.scrollTop;
    let deliveredNativeRefresh = false;
    for (let second = 0; second < 65; second++) { deliveredNativeRefresh = nativeRefreshAttempt() || deliveredNativeRefresh; update(); }
    check('native one-second UI callback was actually delivered', deliveredNativeRefresh);
    check('65 refresh attempts preserve every top-level node focus and scroll', nodes.every((node, index) => root.childNodes[index] === node) && root.childNodes.length === nodes.length && document.activeElement === button && root.scrollTop === scroll && calls.menuEmpty === empty);
    check('refresh does not restart automation write options or announce', settings() === saved && calls.starts === calls.choices.length && automationSchedule() === schedulesBefore && submitted.length === announcements,
      { settingsUnchanged: settings() === saved, starts: calls.starts, choices: calls.choices.length, announcementsAdded: submitted.length - announcements, schedulesBeforeBytes: schedulesBefore.length });
    focus(l('outside')); const oldButton = l('autoBuyButton_0');
    for (let second = 0; second < 65; second++) Game.UpdateMenu();
    check('whole open menu stays stable even with focus outside', document.activeElement === l('outside') && l('autoBuyButton_0') === oldButton && calls.menuEmpty === empty);
    const oldFallback = Game.oldUpdateMenu, installerCalls = [], returnToken = {};
    window.FCMenu = function replacementInstaller(...args) { installerCalls.push({ receiver: this, args }); nativeInstaller.apply(this, args); return returnToken; };
    update(); const receiver = {}, argument = {};
    const returned = FCMenu.call(receiver, argument), immediatelyWrapped = Game.UpdateMenu;
    Game.UpdateMenu();
    check('new installer synchronously preserves wrapper receiver arguments and return', returned === returnToken && installerCalls.length === 1 && installerCalls[0].receiver === receiver && installerCalls[0].args[0] === argument && Game.UpdateMenu === immediatelyWrapped && l('autoBuyButton_0') === oldButton);
    check('FCMenu replacement never rewrites Game.oldUpdateMenu', Game.oldUpdateMenu === oldFallback);
    for (const destination of ['stats', 'prefs', 'log']) {
      Game.ShowMenu(destination); mod.enhanceMenuHeadings(l('menu'));
      const title = l('menu').querySelector('.subsection > .title'), renders = calls.baseRender.length;
      FCMenu(); Game.UpdateMenu();
      check(destination + ': reinstall retains existing base heading freeze', l('menu').querySelector('.subsection > .title') === title && calls.baseRender.length === renders);
      l('menu').dataset.a11yEnhanced = 'true'; title.removeAttribute('role'); Game.UpdateMenu();
      check(destination + ': stale dataset does not replace actual heading predicate', calls.baseRender.length === renders + 1);
    }
    reopen();
    FrozenCookies.minCpSMult = 1234; FrozenCookies.mineMax = 42; update();
    const duplicateExtras = [...document.querySelectorAll('#menu a[id="minCpSMult"]')];
    check('external synthetic amounts patch both duplicate minCpSMult occurrences', duplicateExtras.length === 2 && duplicateExtras.every(element => element.textContent.includes(fcBeautify(1234))) && action(data.inventory.extras.find(extra => extra.id === 'mineMax')).textContent.includes('42'));
    Object.assign(FrozenCookies, numericFields); update();
  }, enabled);
  await section('all extra anchors native prompts and cancellation', async () => {
    reopen(); const saved = settings();
    for (let index = 0; index < data.inventory.extras.length; index++) {
      const extra = data.inventory.extras[index], element = action(extra);
      precondition(extra.preference + ':' + extra.id + ': native occurrence exists', !!element && element.getAttribute('onclick') === extra.onclick);
      check(extra.preference + ':' + extra.id + ': uniquely named keyboard action', element.getAttribute('role') === 'button' && element.tabIndex === 0 && !!name(element) && element.getAttribute('data-a11y-frozen-action') === extra.preference + ':' + extra.id);
      if (extra.id === 'viewStats') continue;
      focus(element); const starts = calls.starts, close = calls.close;
      key(element, index % 2 ? ' ' : 'Enter');
      const input = l('fcGenericInput'), title = l('promptContent').querySelector('h3'), description = l('promptContent').querySelector('.block');
      precondition(extra.preference + ':' + extra.id + ': native numeric prompt reached', Game.promptOn === 1 && !!input);
      check(extra.preference + ':' + extra.id + ': native field labelled and immediately focused selected', input.type === 'text' && name(input) === text(title.textContent) && desc(input) === text(description.textContent) &&
        document.activeElement === input && input.selectionStart === 0 && input.selectionEnd === input.value.length && mod.promptFocusClaimed === true);
      const deferred = pendingUI();
      check(extra.preference + ':' + extra.id + ': settles past actual generic heading callback', deferred.some(timer => String(timer.callback).includes('focusPromptDefault')) && document.activeElement === input);
      input.value = '999';
      key(l('promptOption1'), 'Enter'); await Promise.resolve();
      check(extra.preference + ':' + extra.id + ': native Cancel makes no callback and restores exact occurrence', Game.promptOn === 0 && calls.close === close + 1 && calls.starts === starts && settings() === saved && document.activeElement === element);
    }
    const duplicate = data.inventory.extras.filter(extra => extra.id === 'minCpSMult').map(extra => action(extra));
    check('duplicate native IDs have separate stable adapter action identities', duplicate.length === 2 && duplicate[0] !== duplicate[1] && new Set(duplicate.map(element => element.getAttribute('data-a11y-frozen-action'))).size === 2);
    const anchor = action(data.inventory.extras[0]), attempts = calls.close, starts = calls.starts;
    for (const extra of [{ repeat: true }, { ctrlKey: true }, { altKey: true }, { shiftKey: true }, { metaKey: true }]) key(anchor, 'Enter', extra);
    anchor.setAttribute('aria-disabled', 'true'); key(anchor, ' '); anchor.removeAttribute('aria-disabled');
    Game.promptOn = 1; key(anchor, 'Enter'); Game.promptOn = 0;
    // Deliberately retain connected markup while changing the synthetic active
    // owner, so this tests the inactive-menu guard, not a missing target.
    Game.onMenu = 'log'; key(anchor, 'Enter'); Game.onMenu = 'fc_menu';
    check('extra action guards reject repeated modified disabled covered and inactive keys', Game.promptOn === 0 && calls.close === attempts && calls.starts === starts);
    reopen();
  }, enabled);
  await section('numeric native validation callback order and focus ownership', async () => {
    const speed = data.inventory.extras.find(extra => extra.id === 'cookieClickSpeed');
    const ascend = data.inventory.extras.find(extra => extra.id === 'chipsToAscend');
    const secondDuplicate = data.inventory.extras.find(extra => extra.preference === 'autoCasting');
    const cases = [
      [speed, '1000', 1000], [speed, '1000.5', null], [speed, '-1', null], [speed, 'not a number', null],
      [speed, '0x10', 16], [speed, '1.5', 1.5], [speed, '', 0], [ascend, '0', null], [ascend, '1', 1], [secondDuplicate, '12.5', 12.5], [secondDuplicate, '-0.5', null]
    ];
    for (const [extra, value, expected] of cases) {
      const field = extra.id === 'chipsToAscend' ? 'HCAscendAmount' : extra.id, element = action(extra), previous = FrozenCookies[field];
      focus(element); key(element, 'Enter'); const input = l('fcGenericInput');
      precondition('validation starts in actual native numeric prompt', Game.promptOn === 1 && document.activeElement === input);
      pendingUI(); input.value = value; const starts = calls.starts, order = calls.order.length;
      key(l('promptOption0'), ' '); await Promise.resolve(); update();
      const events = calls.order.slice(order);
      check(extra.preference + ':' + extra.id + ': native Number grammar ' + JSON.stringify(value), FrozenCookies[field] === (expected === null ? previous : expected) && calls.starts === starts + 1 && Game.promptOn === 0,
        { value, expected: expected === null ? previous : expected, actual: FrozenCookies[field] });
      check(extra.preference + ':' + extra.id + ': native close precedes unchanged FC callback ' + JSON.stringify(value), events.length === 2 && events[0].kind === 'close' && events[0].input === (value || null) && events[1].kind === 'start' && events[1].promptOn === 0);
      check(extra.preference + ':' + extra.id + ': Confirm restores exact native occurrence ' + JSON.stringify(value), document.activeElement === element && action(extra) === element);
    }
    const element = action(secondDuplicate); focus(element); key(element, 'Enter'); pendingUI();
    Game.ClosePrompt(); Game.Prompt('<h3>Different prompt generation</h3><input id="newPromptField">', ['Cancel']); focus(l('newPromptField')); await Promise.resolve();
    check('retired prompt close cannot steal a new prompt generation', Game.promptOn === 1 && document.activeElement === l('newPromptField'));
    Game.ClosePrompt(); await Promise.resolve();
    focus(element); key(element, 'Enter'); pendingUI(); Game.ClosePrompt(); Game.ShowMenu('log'); focus(l('outside')); await Promise.resolve();
    check('deferred prompt return yields to menu switch and outside focus', Game.onMenu === 'log' && document.activeElement === l('outside'));
    reopen(); Object.assign(FrozenCookies, numericFields); update();
  }, enabled);
  await section('quiet native infobox and recorded-stat snapshots', async () => {
    reopen();
    const panel = l('a11yFrozenReadouts');
    check('present native mod exposes one labelled text-readout section', !!panel && panel.tagName === 'SECTION' && name(panel) === 'Frozen Cookies text readouts');
    if (!panel) { check('readout behavior requires implemented production UI', false, 'missing-feature'); return; }
    const info = l('a11yFrozenInfoboxData'), infoRefresh = l('a11yFrozenInfoboxRefresh');
    const stats = l('a11yFrozenStatsData'), statsRefresh = l('a11yFrozenStatsRefresh');
    precondition('both readouts and named native refresh buttons exist', info && stats && infoRefresh?.tagName === 'BUTTON' && statsRefresh?.tagName === 'BUTTON');
    check('initial missing-draw and empty-record states are explicit', /not available yet/i.test(info.textContent) && /No recorded samples/i.test(stats.textContent));
    const before = { settings: settings(), starts: calls.starts, schedule: automationSchedule(), tracked: JSON.stringify(FrozenCookies.trackedStats), speech: submitted.length };
    const renderedRows = () => [...info.querySelectorAll('li')].map(element => text(element.textContent));
    const nativeRows = () => calls.infobox.at(-1).filter(row => row.name).map(row => mod.stripHtml(row.name + (row.display ? ': ' + row.display : '')));
    for (const fancy of [0, 1, 2, 3]) {
      const previous = FrozenCookies.fancyui; FrozenCookies.fancyui = fancy;
      const oldText = info.textContent; updateTimers();
      check('native draw is passive until refresh, fancyui=' + fancy, info.textContent === oldText);
      focus(infoRefresh); infoRefresh.click();
      check('readout copies exact native names and timeDisplay values, fancyui=' + fancy, JSON.stringify(renderedRows()) === JSON.stringify(nativeRows().concat(['Frenzy: ' + fcBeautify(cpsBonus() * clickBuffBonus())])));
      check('refresh retains exact button focus and leaves fancy UI unchanged', document.activeElement === infoRefresh && FrozenCookies.fancyui === fancy);
      FrozenCookies.fancyui = previous;
    }
    const buffNames = ['Clot', 'Elder frenzy', 'Frenzy', 'Dragon Harvest', 'Click frenzy', 'Dragonflight', 'Cursed finger', 'Cookie storm'];
    for (const buff of buffNames) {
      Game.buffs = { [buff]: { time: 330, multCpS: 7, multClick: 13 } };
      Game.hasBuff = name => Game.buffs[name] || false;
      updateTimers(); infoRefresh.click();
      check(buff + ': actual native timed variant survives composition', JSON.stringify(renderedRows()) === JSON.stringify(nativeRows().concat(['Frenzy: ' + fcBeautify(cpsBonus() * clickBuffBonus())])));
    }
    Game.buffs = { 'Building special': { type: { name: 'building buff' }, time: 600, multCpS: 9 } };
    updateTimers(); infoRefresh.click();
    check('native building-special duration and multiplier remain readable', renderedRows().includes('Building Special (x9) Time: ' + timeDisplay(20)));
    Game.buffs = {}; Game.hasBuff = () => false;
    const oldDelay = delayAmount, oldCookies = Game.cookies;
    window.delayAmount = () => 500; Game.cookies = 10; updateTimers(); infoRefresh.click();
    check('native bank-completion row is preserved without a new formula', JSON.stringify(renderedRows()) === JSON.stringify(nativeRows().concat(['Frenzy: ' + fcBeautify(cpsBonus() * clickBuffBonus())])) && renderedRows().some(row => row.startsWith('Bank Completion:')));
    window.delayAmount = oldDelay; Game.cookies = oldCookies;
    const oldNext = window.nextChainedPurchase, oldPrereq = window.upgradePrereqCost;
    window.nextChainedPurchase = () => ({ cost: 500, purchase: { name: 'Chain &amp; <b>target</b>', getPrice: () => 100 } });
    window.upgradePrereqCost = (purchase, full) => full ? 500 : 300;
    updateTimers(); infoRefresh.click();
    check('native chain prerequisite text uses decoded sanitized native output', JSON.stringify(renderedRows()) === JSON.stringify(nativeRows().concat(['Frenzy: ' + fcBeautify(cpsBonus() * clickBuffBonus())])) && renderedRows().includes('Chain to: Chain & target') && !info.textContent.includes('<b>'), { rendered: renderedRows(), native: nativeRows() });
    window.nextChainedPurchase = oldNext; window.upgradePrereqCost = oldPrereq;
    Game.season = 'fools'; Game.foolObjects = { 'Synthetic Cursor': { name: 'Synthetic fool name' } };
    updateTimers(); infoRefresh.click();
    check('native Business Day name is retained, not a cached ordinary name', renderedRows().some(row => row.startsWith('Next: Synthetic fool name:')));
    Game.season = '';
    const oldSpeed = FrozenCookies.cookieClickSpeed, oldCps = Game.cookiesPs;
    FrozenCookies.cookieClickSpeed = 0; Game.cookiesPs = 0; Game.cookies = 0; updateTimers(); infoRefresh.click();
    check('native indefinite estimate stays Never rather than an invented duration', renderedRows().includes('Next: Synthetic Cursor: Never!'));
    FrozenCookies.cookieClickSpeed = oldSpeed; Game.cookiesPs = oldCps; Game.cookies = oldCookies;
    const captured = [...info.childNodes], oldText = info.textContent, oldStatsNodes = [...stats.childNodes];
    const mutations = new MutationObserver(() => {}); mutations.observe(info, { subtree: true, childList: true, characterData: true }); mutations.observe(stats, { subtree: true, childList: true, characterData: true });
    focus(infoRefresh); const scroll = l('menu').scrollTop;
    for (let second = 0; second < 35; second++) { Game.buffs = { Frenzy: { time: second * 30, multCpS: 7 } }; updateTimers(); Game.UpdateMenu(); update(); }
    check('35 native display/logic ticks never rewrite either snapshot or move focus/scroll', info.textContent === oldText && captured.every((node, index) => info.childNodes[index] === node) &&
      oldStatsNodes.every((node, index) => stats.childNodes[index] === node) && document.activeElement === infoRefresh && l('menu').scrollTop === scroll && submitted.length === before.speech);
    check('native display ticks produce no transient readable-data mutations either', mutations.takeRecords().length === 0); mutations.disconnect();
    Game.buffs = {};
    FrozenCookies.trackedStats = [{ time: 1200, baseCps: 12.5, effectiveCps: 23.75, hc: 45 }, { time: 65432, baseCps: 99, effectiveCps: 100, hc: 46 }];
    const recorded = JSON.stringify(FrozenCookies.trackedStats);
    focus(statsRefresh); statsRefresh.click();
    const table = stats.querySelector('table');
    check('table has native graph series and run-elapsed time headers', table && [...table.querySelectorAll('th')].map(node => text(node.textContent)).join('|') === 'Time since run start|Base CPS|Effective CPS|Earned HC');
    check('all recorded rows use actual graph time and numeric formatters', JSON.stringify([...table.querySelectorAll('tbody tr')].map(row => [...row.cells].map(cell => cell.textContent))) ===
      JSON.stringify(FrozenCookies.trackedStats.map(sample => [timeDisplay(sample.time / 1000), Beautify(sample.baseCps), Beautify(sample.effectiveCps), Beautify(sample.hc)])));
    check('refresh is read-only and retains keyboard focus without speech', JSON.stringify(FrozenCookies.trackedStats) === recorded && document.activeElement === statsRefresh && calls.starts === before.starts && automationSchedule() === before.schedule && settings() === before.settings && submitted.length === before.speech);
    const nativeSave = window.saveStats; window.saveStats = () => { throw Error('Text refresh must not collect a sample'); };
    infoRefresh.click(); statsRefresh.click(); window.saveStats = nativeSave;
    check('refresh does not call saveStats or viewStatGraphs', JSON.stringify(FrozenCookies.trackedStats) === recorded && calls.plot.length === 0);
    const currentText = stats.textContent; FrozenCookies.trackedStats.push({ time: 90000, baseCps: 22, effectiveCps: 33, hc: 55 }); update();
    check('background samples do not churn the stable readable table', stats.textContent === currentText);
    statsRefresh.click(); check('explicit refresh admits a new real recorded row', stats.querySelectorAll('tbody tr').length === 3);
    FrozenCookies.trackedStats = [{ time: NaN, baseCps: undefined, effectiveCps: Infinity, hc: null }]; statsRefresh.click();
    check('invalid recorded fields are unavailable, never invented zero or timestamp', stats.querySelectorAll('td').length === 4 && [...stats.querySelectorAll('td')].every(cell => cell.textContent === 'Unavailable'));
    FrozenCookies.trackedStats = [{ time: 1000, baseCps: 12, effectiveCps: 34, hc: 5 }];
    const formatter = window.timeDisplay; let formatterReached = false; window.timeDisplay = () => { formatterReached = true; throw Error('Unsupported formatter'); }; statsRefresh.click(); window.timeDisplay = formatter;
    check('unavailable native formatting is contained to the readout', formatterReached && stats.textContent === 'Text data is unavailable.' && !!mod._frozenCookiesAccessibility);
    FrozenCookies.trackedStats = []; statsRefresh.click();
    check('empty refresh remains empty and does not enable collection', /No recorded samples/i.test(stats.textContent) && FrozenCookies.trackedStats.length === 0 && settings() === before.settings);
    FrozenCookies.trackedStats = null; statsRefresh.click();
    check('missing stats capability has a local explicit empty alternative', stats.textContent === 'Recorded stats are unavailable.' && !!mod._frozenCookiesAccessibility); FrozenCookies.trackedStats = [];
    check('new controls rely on native keyboard defaults, not duplicate key handlers', !key(statsRefresh, 'Enter').defaultPrevented && !key(infoRefresh, ' ').defaultPrevented);
    check('readouts expose no live regions or unsupported button roles on data', !panel.querySelector('[aria-live], [role="status"], [role="alert"]') && !stats.querySelector('[role="button"]') && !info.querySelector('[role="button"]'));
    Game.promptOn = 1; const covered = stats.textContent; statsRefresh.click(); Game.promptOn = 0;
    check('covered menu refresh refuses without touching data', stats.textContent === covered);
    const retired = statsRefresh; reopen(); const newStats = l('a11yFrozenStatsData');
    FrozenCookies.trackedStats = [{ time: 1000, baseCps: 9, effectiveCps: 8, hc: 7 }]; const freshText = newStats.textContent; retired.click();
    check('retired readout callback cannot change a new menu generation', newStats.textContent === freshText);
    FrozenCookies.trackedStats = []; reopen();
    result.samples.readoutNativeRows = calls.infobox.at(-1);
  }, enabled);
  await section('real jquery UI graph Escape ownership', async () => {
    const extra = data.inventory.extras.find(extra => extra.id === 'viewStats'), element = action(extra);
    focus(element); const tracked = FrozenCookies.trackedStats.length, baseShows = calls.show.length;
    key(element, 'Enter');
    precondition('actual native viewStatGraphs opened real jquery UI dialog', !!l('statGraphContainer') && $('#statGraphContainer').dialog('isOpen'));
    const dialog = l('statGraphContainer').closest('.ui-dialog'), close = dialog.querySelector('.ui-dialog-titlebar-close');
    check('native graph samples only synthetic stats and reaches plot spy', FrozenCookies.trackedStats.length === tracked + 1 && calls.plot.length === 1 && calls.plot[0][1].length === 3);
    check('native jquery dialog retains name real close button and focus', dialog.getAttribute('role') === 'dialog' && name(dialog) === 'Frozen Cookies Tracked Stats' && close.tagName === 'BUTTON' && dialog.contains(document.activeElement) && Game.promptOn === 0);
    check('adapter recognizes visible native graph', typeof mod.frozenCookiesGraphOpen === 'function' && mod.frozenCookiesGraphOpen());
    const graphReadout = l('a11yFrozenGraphReadouts'), graphData = l('a11yFrozenGraphStatsData'), refresh = l('a11yFrozenGraphStatsRefresh');
    check('native graph exposes a named quiet table beside, not inside, the plot', !!graphReadout && name(graphReadout) === 'Tracked stats text' && graphReadout.parentElement === l('statGraphContainer') && !l('statGraphs').contains(graphReadout) && graphData?.querySelectorAll('tbody tr').length === tracked + 1 && !graphReadout.querySelector('[aria-live], [role="status"], [role="alert"]'));
    if (refresh) {
      focus(refresh); const snapshot = graphData.textContent, nodes = [...graphData.childNodes], count = FrozenCookies.trackedStats.length;
      const plotsBefore = calls.plot.length; FrozenCookies.lastGraphDraw = 0;
      saveStats(false); // the actual native producer redraws an already open graph
      update();
      check('native collected sample/redraw leaves readout nodes and focus unchanged', calls.plot.length === plotsBefore + 1 && FrozenCookies.trackedStats.length === count + 2 && graphData.textContent === snapshot && nodes.every((node, index) => graphData.childNodes[index] === node) && document.activeElement === refresh);
      const countBefore = FrozenCookies.trackedStats.length, graphCalls = calls.plot.length, starts = calls.starts;
      refresh.click();
      check('graph Refresh reads all actual samples without collecting or plotting', graphData.querySelectorAll('tbody tr').length === countBefore && FrozenCookies.trackedStats.length === countBefore && calls.plot.length === graphCalls && calls.starts === starts && document.activeElement === refresh);
      const covered = l('a11yFrozenStatsData').textContent; l('a11yFrozenStatsRefresh').click();
      check('underlying menu refresh refuses graph takeover', l('a11yFrozenStatsData').textContent === covered);
    }
    const same = l('autoBuyButton_0');
    for (let i = 0; i < 30; i++) { Game.UpdateMenu(); update(); }
    check('open graph preserves underlying FC DOM and opener', action(extra) === element && l('autoBuyButton_0') === same);
    const consumed = key(refresh || close, 'Escape'); await Promise.resolve();
    check('one native jquery Escape closes only graph and preserves FC menu', consumed.defaultPrevented && !$('#statGraphContainer').dialog('isOpen') && Game.onMenu === 'fc_menu' && calls.show.length === baseShows);
    check('native jquery graph close restores exact View Stat Graphs opener', document.activeElement === element);
    if (refresh) {
      const graphText = graphData.textContent; FrozenCookies.trackedStats.push({ time: 99999, baseCps: 6, effectiveCps: 7, hc: 8 }); refresh.click();
      check('closed native graph refuses its retained refresh callback', graphData.textContent === graphText);
      focus(element); key(element, ' ');
      check('reopening keeps text hosts and refreshes the native one-shot sample', l('a11yFrozenGraphReadouts') === graphReadout && graphData.querySelectorAll('tbody tr').length === FrozenCookies.trackedStats.length);
      const nativeClose = l('statGraphContainer').closest('.ui-dialog').querySelector('.ui-dialog-titlebar-close');
      nativeClose.click();
      check('native titlebar Close still returns focus to its opener', !mod.frozenCookiesGraphOpen() && document.activeElement === element);
    }
    const bodyEvent = new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, which: 27, bubbles: true, cancelable: true }); bodyEvent.preventDefault(); document.body.dispatchEvent(bodyEvent);
    check('generic Escape respects an already consumed event', Game.onMenu === 'fc_menu');
    key(element, 'Escape'); pendingUI(); await Promise.resolve();
    check('next unconsumed Escape closes FC with named opener return', Game.onMenu === '' && document.activeElement === l('fcButton') && submitted.some(message => message === 'Frozen Cookies menu closed.'));
    reopen();
  }, enabled);
  await section('rebind cleanup preferences and unsupported states', async () => {
    if ($('#statGraphContainer').length && $('#statGraphContainer').dialog('isOpen')) $('#statGraphContainer').dialog('close');
    reopen(); const saved = settings(), starts = calls.starts;
    const detachedAction = action(data.inventory.extras[0]), oldRoot = l('menu');
    const newRoot = document.createElement('div'); newRoot.id = 'menu'; newRoot.style.display = 'block'; oldRoot.replaceWith(newRoot);
    // Rebind a supported native generation, not an empty div that cannot yet
    // satisfy the native-menu shape contract. Install/render the unchanged
    // native builder first, just as when the host replaces its menu content.
    nativeInstaller(); Game.UpdateMenu();
    precondition('replacement root contains complete actual native UI before discovery', newRoot.querySelectorAll('button.fc-multichoice-btn').length === 247);
    update(); Game.UpdateMenu(); update();
    check('replacement menu discovers and decorates actual rebuilt native controls', l('menu') === newRoot && l('autoClickButton_0')?.getAttribute('aria-pressed') === 'true');
    detachedAction.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    check('detached old menu action loses adapted keyboard handler', Game.promptOn === 0 && calls.starts === starts);
    const oldOpener = l('fcButton'); oldOpener.remove(); globalEval(data.spans.opener); update();
    const beforeShow = calls.show.length; oldOpener.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    check('old detached icon is inert and new native icon rebinds', calls.show.length === beforeShow && l('fcButton').getAttribute('role') === 'button' && !oldOpener.hasAttribute('role'));
    key(l('fcButton'), 'Enter'); key(l('fcButton'), 'Enter');
    check('new opener still invokes exactly one native click per activation', calls.show.length === beforeShow + 2 && Game.onMenu === 'fc_menu');
    const priorGlobal = FrozenCookies; window.FrozenCookies = { ...priorGlobal }; const priorRegistry = Game.mods.frozen_cookies; Game.mods.frozen_cookies = { init: 0 }; update();
    check('replacement native global and registration identity requalify without changes', !!mod._frozenCookiesAccessibility && settings() === saved && calls.starts === starts);
    Game.ShowMenu('prefs'); mod.enhanceOptionsMenu(); mod.enhanceOptionsMenu();
    check('Options has neither support toggle nor empty optional subsection', !l('a11yFrozenCookiesEnabled') && !l('a11yGreenhouseEnabled') && !l('menu').textContent.includes('Experimental mod support'));
    App.mods.frozen_cookies.disabled = true; update();
    check('disabled native mod restores icon and retires both capabilities', !mod._frozenCookiesAccessibility && !mod._frozenCookiesShortcutShield && attrs(l('fcButton')) === originalOpenerAttributes && settings() === saved && calls.starts === starts);
    const nativeUpdate = Game.UpdateMenu, nativePrompt = window.userInputPrompt;
    mod.load(mod.save());
    check('empty save load leaves disabled native functions alone', mod.save() === '' && Game.UpdateMenu === nativeUpdate && window.userInputPrompt === nativePrompt);
    App.mods.frozen_cookies.disabled = false; update();
    check('native reenable discovers existing FC without restart', !!mod._frozenCookiesAccessibility && calls.starts === starts);
    mod.load('{"greenhouseAccessibilityEnabled":false,"frozenCookiesAccessibilityEnabled":false}'); update();
    check('both legacy false preferences are ignored', !('greenhouseAccessibilityEnabled' in mod) && !('frozenCookiesAccessibilityEnabled' in mod) && !!mod._frozenCookiesAccessibility);
    mod.load(''); update();
    check('legacy empty data retains automatic capabilities', !!mod._frozenCookiesAccessibility && !!mod._frozenCookiesShortcutShield);
    reopen();
    for (const [field, invalid] of [['version', 'unsupported'], ['branch', 'unsupported'], ['autoBuy', -1], ['autoBuy', '0'], ['autoBuy', 0.5]]) {
      const previous = FrozenCookies[field], beforeWarnings = submitted.length;
      FrozenCookies[field] = invalid; const badSettings = settings(); update(); update();
      check('unsupported ' + field + '=' + JSON.stringify(invalid) + ' refuses without repairing native data', !mod._frozenCookiesAccessibility && FrozenCookies[field] === invalid && settings() === badSettings && calls.starts === starts);
      check('same unsupported identity does not spam warning', submitted.length <= beforeWarnings + 1, submitted.slice(beforeWarnings));
      // A failed native identity is intentionally latched. Retry with a fresh
      // supported identity, rather than clearing the adapter's private latch.
      FrozenCookies[field] = previous; window.FrozenCookies = { ...FrozenCookies }; update();
      check('fresh supported identity recovers after ' + field + '=' + JSON.stringify(invalid), !!mod._frozenCookiesAccessibility);
    }
    const nativeMod = Game.mods.frozen_cookies; nativeMod.init = function pendingNativeInit() { calls.forbidden.push('pendingNativeInit'); }; update();
    check('registered but uninitialized mod stays unadapted', !mod._frozenCookiesAccessibility); nativeMod.init = 0; update();
    const wasReady = Game.ready; Game.ready = false; update(); check('Game.ready false refuses adapter without initialization', !mod._frozenCookiesAccessibility); Game.ready = wasReady; update();
    const opener = l('fcButton'); opener.setAttribute('aria-label', 'Foreign owner label');
    const originalDraw = mod._frozenCookiesAccessibility.drawOriginal, originalGraphs = mod._frozenCookiesAccessibility.graphOriginal;
    const foreignInstaller = function foreignInstaller() {}, foreignUpdater = function foreignUpdater() {};
    window.FCMenu = foreignInstaller; Game.UpdateMenu = foreignUpdater; mod.clearFrozenCookiesAccessibility();
    check('cleanup respects foreign attributes and later function owners', opener.getAttribute('aria-label') === 'Foreign owner label' && window.FCMenu === foreignInstaller && Game.UpdateMenu === foreignUpdater);
    check('cleanup removes owned menu notice and action attributes', !l('a11yFrozenSnapshot') && !l('menu').querySelector('[data-a11y-frozen-action]'));
    check('cleanup restores exact native readout producers and removes both text surfaces', window.drawCircles === originalDraw && window.viewStatGraphs === originalGraphs && !l('a11yFrozenReadouts') && !l('a11yFrozenGraphReadouts'));
    check('all rebind disable failure and cleanup operations preserve native choices and numeric fields', settings() === saved && calls.starts === starts);
    window.FrozenCookies = priorGlobal; Game.mods.frozen_cookies = priorRegistry;
  }, enabled);
  phase = 'final safety';
  check('no automation game action network or popup executed', calls.forbidden.length === 0 && calls.network.length === 0 && calls.windows.length === 0, { forbidden: calls.forbidden, network: calls.network, windows: calls.windows });
  check('no interval callback was ever delivered', !timers.some(timer => timer.kind === 'interval' && timer.ran));
  result.errors.push(...fixtureErrors.map(error => ({ phase: 'browser event dispatch', ...error })));
  result.samples = { ...result.samples, browserUserAgent: navigator.userAgent, focusEvents, nativeVersion: window.FrozenCookies?.version, nativeChoices: calls.choices, starts: calls.starts, menuEmpty: calls.menuEmpty,
    baseRenders: calls.baseRender, showTransitions: calls.show, announcements: submitted,
    timers: timers.map(timer => ({ id: timer.id, kind: timer.kind, delay: timer.delay, callbackName: timer.callback?.name || '', callbackSource: String(timer.callback).slice(0, 240), canceled: timer.canceled, ran: timer.ran })),
    plotCalls: calls.plot.length, initialNativePromptWasWrapped: window.userInputPrompt !== originalPromptFunction };
  l('result').textContent = JSON.stringify(result);
}

const receipt = { mainPath, sourceSha256: sha(source), testPath: __filename, testSha256: sha(fs.readFileSync(__filename)),
  gameSourcePath, gameSourceSha256: sha(gameSource),
  nativePath, nativeRevision: inventory.revision, nativeVersion: inventory.version, nativeFiles,
  inventory: { path: inventoryFile, sha256: sha(fs.readFileSync(inventoryFile)), counts: inventory.counts },
  extractedSpans: Object.fromEntries(Object.entries(spans).map(([name, body]) => [name, { bytes: Buffer.byteLength(body), sha256: sha(body) }])),
  chrome, nodeVersion: process.version, scheduleTargets, gardenReplay, scenarios: [], errors: [] };
const receiptPath = path.join(scratch, 'browser-results.json');
try {
  for (const scenario of ['frozen-first', 'access-first']) {
    const fixture = path.join(scratch, scenario + '.html'), profile = path.join(scratch, scenario + '-profile');
    const data = { scenario, spans, inventory, scheduleTargets, nativePreferences: native['fc_preferences.js'], nativeButtons: native['fc_button.js'], nativeInfobox: native['fc_infobox.js'] };
    const html = '<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\' \'unsafe-eval\'; style-src \'unsafe-inline\'; img-src data:"><title>Frozen Cookies isolated UI fixture</title>' +
      '<style>body{font-family:sans-serif}#menu{height:500px;overflow:auto;display:none}#prompt{display:none;position:fixed;inset:20px;background:white;z-index:2000000}.ui-dialog{background:white}.ui-widget-overlay{position:fixed;inset:0}#fcButton{display:inline-block;min-width:80px;min-height:30px}a.option{display:inline-block;padding:4px}</style>' +
      '<button id="outside">Outside</button><button id="statsButton">Statistics</button><button id="prefsButton">Options</button><div id="logButton">Info</div><canvas id="backgroundLeftCanvas" height="600" width="400"></canvas><div id="menu"></div><div id="prompt"><div id="promptContent"></div><div id="promptOptions"></div></div><pre id="result"></pre>' +
      script('(' + setupFixture.toString() + ')();') + script(native['jquery-3.6.0.min.js']) + script(native['jquery-ui-1.12.1.js']) + script(source) +
      script('(' + browserFixture.toString() + ')(' + JSON.stringify(data) + ').catch(error=>{l("result").textContent=JSON.stringify({scenario:' + JSON.stringify(scenario) + ',checks:[],errors:[{kind:error.name,message:error.message,stack:error.stack}],eventErrors:fixtureErrors});});');
    fs.writeFileSync(fixture, html);
    try {
      const args = ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-background-networking',
        '--disable-component-update', '--disable-sync', '--allow-file-access-from-files', '--user-data-dir=' + profile, '--dump-dom', 'file:///' + fixture.replaceAll('\\', '/')];
      const run = cp.spawnSync(chrome, args, { encoding: 'utf8', timeout: 60000, maxBuffer: 16 * 1024 * 1024 });
      fs.writeFileSync(path.join(scratch, scenario + '.chrome.stderr.log'), run.stderr || '');
      const match = (run.stdout || '').match(/<pre id="result">([\s\S]*?)<\/pre>/);
      if (!match) {
        receipt.scenarios.push({ scenario, chromeExit: run.status, checks: [], errors: [{ kind: 'NoBrowserReceipt', message: run.error?.message || run.stderr || 'No populated #result' }] });
      } else {
        const result = JSON.parse(match[1].replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&'));
        receipt.scenarios.push({ chromeExit: run.status, ...(run.error ? { processError: run.error.message } : {}), ...result });
      }
    } finally {
      fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
      fs.rmSync(fixture, { force: true });
    }
  }
} catch (error) { receipt.errors.push({ kind: error.name, message: error.message, stack: error.stack }); }
receipt.totals = { checked: receipt.scenarios.reduce((sum, result) => sum + result.checks.length, 0),
  failed: receipt.scenarios.reduce((sum, result) => sum + result.checks.filter(check => !check.passed).length, 0),
  errors: receipt.errors.length + receipt.scenarios.reduce((sum, result) => sum + result.errors.length, 0),
  notReached: receipt.scenarios.flatMap(result => (result.blocks || []).filter(block => block.status === 'not-reached').map(block => result.scenario + ': ' + block.name)) };
fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2));
console.log(JSON.stringify({ ...receipt.totals, gardenReplay: { checked: gardenReplay.checked, failed: gardenReplay.failed, errors: gardenReplay.errors }, scenarios: receipt.scenarios.map(result => ({ scenario: result.scenario, chromeExit: result.chromeExit,
  checked: result.checks.length, failed: result.checks.filter(check => !check.passed).map(check => ({ phase: check.phase, name: check.name, detail: check.detail })),
  errorCount: result.errors.length, errorKinds: [...new Set(result.errors.map(error => error.kind + ': ' + error.message))],
  failedPreconditions: (result.preconditions || []).filter(check => !check.passed) })), receiptPath }, null, 2));
if (gardenReplay.failed.length || gardenReplay.errors.length || !gardenReplay.checked || receipt.totals.failed || receipt.totals.errors || !receipt.totals.checked || receipt.totals.notReached.length || receipt.scenarios.length !== 2 || receipt.scenarios.some(result => result.chromeExit !== 0)) process.exitCode = 1;
