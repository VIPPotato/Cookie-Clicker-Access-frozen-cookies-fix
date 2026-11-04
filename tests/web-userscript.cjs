'use strict';
// Execute the actual generated userscript in a Node VM, then run its production
// startup/menu/reset callers with narrow DOM/game boundaries. Optional globals
// are supplied (and access-counted), not omitted to make discovery look inert.
// No browser, game, personal state, network or dependency installation.
// Run: CC_MAIN=<generated.user.js> node tests/web-userscript.cjs
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const payloadPath = process.env.CC_MAIN;
if (!payloadPath || !path.isAbsolute(payloadPath)) throw Error('CC_MAIN must name the actual generated userscript');
const source = fs.readFileSync(payloadPath, 'utf8');
const steamSource = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
const sha = text => crypto.createHash('sha256').update(text).digest('hex');
const checks = [];
const check = (name, passed, detail) => checks.push({ name, passed: !!passed, ...(detail === undefined ? {} : { detail }) });
const errors = [];
try {
  const adapterSymbol = /(?:[Gg]reenhouse|[Ff]rozenCookies|a11yFrozen|fc_menu|fcButton|grandpas greenhouse|frozen_cookies|steamOptionalMod|FCshortcuts)/;
  check('actual generated text excludes every optional adapter symbol family', !adapterSymbol.test(source));
  check('base Frozen shimmer compatibility explanation is retained', source.includes('Frozen Cookies runs eval() with toString()'));
  const timers = [], hooks = [], events = [], spoken = [], notices = [], lookups = [];
  const mods = new Proxy({}, { get(target, key) {
    if (['grandpas greenhouse', 'frozen_cookies'].includes(key)) lookups.push('Game.mods.' + key);
    return target[key];
  } });
  const menu = { querySelector() { return null; }, querySelectorAll() { return []; } };
  const document = { activeElement: null,
    documentElement: { addEventListener(type, fn) { events.push({ owner: 'html', type, fn }); },
      removeEventListener(type, fn) { const index = events.findIndex(item => item.owner === 'html' && item.type === type && item.fn === fn); if (index !== -1) events.splice(index, 1); } },
    addEventListener(type, fn) { events.push({ owner: 'document', type, fn }); },
    querySelector() { return null; }, querySelectorAll() { return []; },
    getElementById(id) { return id === 'menu' ? menu : null; }
  };
  const Game = { ready: false, mods, keys: {}, prefs: { screenreader: 1 }, ObjectsById: [], Objects: {}, Upgrades: {}, seasons: {},
    onMenu: '', promptOn: 0, OnAscend: false, AscendTimer: 0, cookies: 100,
    registerMod(id, mod) { mods[id] = mod; },
    registerHook(type, callback) { hooks.push({ type, callback }); },
    Notify(...args) { notices.push(args); }, UpdateMenu() {}, ShowMenu(what) { this.onMenu = what || ''; }, ClosePrompt() {},
    Prompt() {}, DrawBuildings() {}, RebuildUpgrades() {}, crateTooltip() {}, BuildAscendTree() {}, ToggleSpecialMenu() {}, AddToLog() {}
  };
  const context = { document, Game, console, l: id => document.getElementById(id), loc: text => text,
    setTimeout(callback, delay) { timers.push({ callback, delay }); return timers.length; }, clearTimeout() {},
    addEventListener() {}, PlaySound() {}, App: new Proxy({ mods: { frozen_cookies: { disabled: false }, 'grandpas greenhouse': { disabled: false } } }, {
      get(target, key) { lookups.push('App.' + String(key)); return target[key]; }
    }) };
  context.window = context;
  Object.defineProperty(context, 'FrozenCookies', { get() { lookups.push('FrozenCookies'); return { version: '2.052.8', branch: 'erb-', FCshortcuts: 1 }; } });
  mods.frozen_cookies = { init: 0 }; mods['grandpas greenhouse'] = { init: 0, version: '1.5' };
  vm.createContext(context);
  vm.runInContext(source, context, { filename: payloadPath });
  check('web wrapper waits until Game.ready', !mods['screen reader accessibility'] && timers.length === 1 && timers[0].delay === 100);
  Game.ready = true; timers.shift().callback();
  const mod = mods['screen reader accessibility'];
  check('actual delayed userscript registers the unchanged mod id', !!mod);
  check('registered object has no adapter, discovery, shield or preference member', Object.keys(mod).every(key => !adapterSymbol.test(key)));
  const originalShimmerSetup = mod.setupGoldenCookieAnnouncements;
  // Boundary substitutes are only unrelated base UI helpers. init(), its inline
  // wrappers, enhanceOptionsMenu(), save/load and shimmer policy remain real.
  const uiBoundaries = ['createLiveRegion', 'createAssertiveLiveRegion', 'overrideDrawBuildings', 'wrapPermanentSlotFunctions',
    'enhanceMainUI', 'enhanceUpgradeShop', 'enhanceAscensionUI', 'setupNewsTicker', 'createWrinklerOverlays', 'enhanceSugarLump',
    'enhanceShimmeringVeil', 'enhanceDragonUI', 'enhanceSantaUI', 'enhanceQoLSelectors', 'setupMilkSelectorOverride',
    'setupBackgroundSelectorOverride', 'setupSoundSelectorOverride', 'enhanceBuildingMinigames', 'startBuffTimer', 'createActiveBuffsPanel',
    'createShimmerPanel', 'createMainInterfaceEnhancements', 'createGameStatsPanel', 'filterUnownedBuildings', 'labelBuildingLevels',
    'enhanceNotes', 'updateDynamicLabels'];
  for (const name of uiBoundaries) mod[name] = () => {};
  mod.announce = (text, force) => spoken.push({ text, force }); mod.announceUrgent = text => spoken.push({ text, urgent: true });
  mod.init();
  for (const input of ['', '{broken', '{"greenhouseAccessibilityEnabled":false,"frozenCookiesAccessibilityEnabled":false}']) mod.load(input);
  check('web mod saves no optional state after legacy loads', mod.save() === '');
  check('production startup has only base draw/reset hooks, no optional logic discovery', JSON.stringify(hooks.map(item => item.type).sort()) === JSON.stringify(['draw', 'reset']));
  check('startup announces exactly version 15.0 without absent-mod offers', JSON.stringify(spoken) === JSON.stringify([{ text: 'Screen Reader Accessibility mod version 15.0 loaded.', force: undefined }]));
  check('startup notification reports version 15.0', notices.length === 1 && notices[0][1] === 'Version 15.0');
  check('production startup never discovers supplied optional globals', lookups.length === 0, [...lookups]);
  // Deliver each already-scheduled base callback once; do not invent a real game
  // loop. UI dependencies above are deliberately inert, and no save API exists.
  while (timers.length) timers.shift().callback();
  Game.ShowMenu('prefs'); mod.enhanceOptionsMenu();
  for (const hook of hooks) hook.callback(false);
  while (timers.length) timers.shift().callback();
  const beforeSaveFeedback = spoken.length;
  for (const event of events.filter(item => item.type === 'keydown')) event.fn({ key: 's', keyCode: 83, ctrlKey: true });
  check('generated base Ctrl+S feedback survives without an optional shield', spoken.length === beforeSaveFeedback + 1 && spoken.at(-1).text === 'Game saved.' && spoken.at(-1).force === true);
  check('startup/menu/reset never discover supplied optional globals', lookups.length === 0, lookups);
  check('no optional input listener exists in generated startup', events.every(item => !adapterSymbol.test(String(item.fn))));

  let steamMod;
  vm.runInNewContext(steamSource, { Game: { registerMod(id, object) { steamMod = object; } } });
  check('generated shimmer method is byte-equivalent to the retained Steam method', String(originalShimmerSetup) === String(steamMod.setupGoldenCookieAnnouncements));
  const rewards = [], popup = text => rewards.push(text);
  Game.Popup = popup;
  const popFunc = vm.runInContext('(function() { Game.Popup("Synthetic golden reward", 0, 0); return 42; })', context);
  Game.shimmerTypes = { golden: { popFunc, last: 'multiply cookies' } };
  Game.shimmer = vm.runInContext('(function FixtureShimmer() {})', context);
  Game.shimmer.prototype.pop = vm.runInContext('(function(event) { return Game.shimmerTypes.golden.popFunc.call(this, event); })', context);
  originalShimmerSetup.call(mod);
  check('base access wraps shimmer.pop, never native golden.popFunc', Game.shimmer.prototype._a11yPopWrapped === true && Game.shimmerTypes.golden.popFunc === popFunc);
  const beforeReward = spoken.length;
  const shimmer = new Game.shimmer(); shimmer.type = 'golden'; shimmer.id = 1;
  check('generated shimmer path retains original return and reward', shimmer.pop({}) === 42 && rewards.length === 1 && rewards[0] === 'Synthetic golden reward');
  check('generated shimmer path announces exact captured reward once', spoken.length === beforeReward + 1 && spoken.at(-1).text === 'Synthetic golden reward' && spoken.at(-1).urgent === true);
  check('shimmer restores popup/notification boundaries after ordinary completion', Game.Popup === popup && mod.shimmerPopupActive === false);
} catch (error) { errors.push({ kind: error.name, message: error.message, stack: error.stack }); }
const result = { payloadPath, payloadSha256: sha(source), steamSourceSha256: sha(steamSource), testSha256: sha(fs.readFileSync(__filename)),
  checked: checks.length, failed: checks.filter(item => !item.passed), errors,
  limits: ['Node VM with DOM/game boundary doubles; no real browser keyboard defaults, game hooks, screen reader speech or live integration.'] };
console.log(JSON.stringify(result, null, 2));
if (!checks.length || result.failed.length || errors.length) process.exitCode = 1;
