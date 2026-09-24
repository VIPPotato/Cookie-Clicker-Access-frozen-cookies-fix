// Test harness for Cookie Clicker Access v14.0 changes.
// Loads main.js in a fake Game/DOM environment and exercises the changed logic.
// Run: node harness.js   (exit 0 = all green)
'use strict';
const fs = require('fs');

const MAIN = process.env.CC_MAIN ||
  'D:/Documents/projects/games/!done/Cookie-Clicker-Access-frozen-cookies-fix/main.js';

let pass = 0, fail = 0;
const failures = [];
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; failures.push(name + (detail ? ' -> ' + detail : '')); console.log('  FAIL  ' + name + (detail ? ' -> ' + detail : '')); }
}
function eq(name, actual, expected) {
  ok(name, actual === expected, 'got ' + JSON.stringify(actual) + ', expected ' + JSON.stringify(expected));
}
// Run a block of assertions. A missing function or a throw is a section failure,
// not a crash, so the suite still reports when pointed at the pre-fix build.
function section(title, fn) {
  console.log('\n--- ' + title + ' ---');
  try { fn(); }
  catch (e) {
    fail++;
    failures.push(title + ' ABORTED: ' + e.message);
    console.log('  FAIL  section aborted: ' + e.message);
  }
}
function need(names) {
  for (const n of [].concat(names)) {
    if (typeof MOD[n] !== 'function') throw new Error('MOD.' + n + ' does not exist');
  }
}

// ---------- Minimal DOM ----------
class El {
  constructor(tag) {
    this.tagName = (tag || 'div').toUpperCase();
    this.attrs = {};
    this.dataset = {};
    this.children = [];
    this.parentNode = null;
    this.style = { cssText: '', display: '', pointerEvents: '' };
    this._text = '';
    this._html = '';
    this._listeners = {};
    this.id = '';
    this._classes = [];
  }
  get parentElement() { return this.parentNode; }
  get className() { return this._classes.join(' '); }
  set className(v) { this._classes = String(v).split(/\s+/).filter(Boolean); }
  get classList() {
    const self = this;
    return {
      contains: c => self._classes.indexOf(c) !== -1,
      add: c => { if (self._classes.indexOf(c) === -1) self._classes.push(c); },
      remove: c => { self._classes = self._classes.filter(x => x !== c); }
    };
  }
  setAttribute(k, v) { this.attrs[k] = String(v); if (k === 'id') this.id = String(v); }
  getAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null; }
  removeAttribute(k) { delete this.attrs[k]; }
  hasAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attrs, k); }
  appendChild(c) { if (c.parentNode) c.parentNode.removeChild(c); c.parentNode = this; this.children.push(c); return c; }
  removeChild(c) { this.children = this.children.filter(x => x !== c); c.parentNode = null; return c; }
  remove() { if (this.parentNode) this.parentNode.removeChild(this); }
  insertBefore(n, ref) {
    if (n.parentNode) n.parentNode.removeChild(n);
    n.parentNode = this;
    const i = ref ? this.children.indexOf(ref) : -1;
    if (i === -1) this.children.push(n); else this.children.splice(i, 0, n);
    return n;
  }
  get nextSibling() {
    if (!this.parentNode) return null;
    const i = this.parentNode.children.indexOf(this);
    return this.parentNode.children[i + 1] || null;
  }
  get nextElementSibling() { return this.nextSibling; }
  get previousElementSibling() {
    if (!this.parentNode) return null;
    const i = this.parentNode.children.indexOf(this);
    return i > 0 ? this.parentNode.children[i - 1] : null;
  }
  get firstChild() { return this.children[0] || null; }
  get childNodes() { return this.children; }
  set textContent(v) { this._text = String(v); this.children = []; }
  get textContent() {
    if (this.children.length) return this.children.map(c => c.textContent).join('');
    return this._text;
  }
  set innerHTML(v) { this._html = String(v); if (v === '') this.children = []; }
  get innerHTML() { return this._html; }
  addEventListener(t, fn) { (this._listeners[t] = this._listeners[t] || []).push(fn); }
  dispatch(t, ev) { (this._listeners[t] || []).forEach(fn => fn(ev || {})); }
  click() { this.dispatch('click', { stopPropagation() {}, preventDefault() {}, target: this }); }
  focus() { DOC._focused = this; }
  _all() { let out = []; for (const c of this.children) { out.push(c); out = out.concat(c._all()); } return out; }
  querySelectorAll(sel) { return matchAll(this, sel); }
  querySelector(sel) { const r = matchAll(this, sel); return r.length ? r[0] : null; }
}

function matchOne(el, part) {
  part = part.trim();
  if (!part) return false;
  const notM = part.match(/^(.*):not\(\[([^\]]+)\]\)$/);
  if (notM) return matchOne(el, notM[1] || '*') && !el.hasAttribute(notM[2]);
  const attrM = part.match(/^([a-zA-Z0-9.#*]*)\[([a-zA-Z0-9-]+)(?:\s*=\s*"([^"]*)")?\]$/);
  if (attrM) {
    const [, base, attr, val] = attrM;
    if (base && !matchOne(el, base)) return false;
    if (!el.hasAttribute(attr)) return false;
    return val === undefined || el.getAttribute(attr) === val;
  }
  if (part === '*') return true;
  if (part[0] === '#') return el.id === part.slice(1);
  // Tag names can contain digits (h3, h5). An [a-zA-Z]-only pattern silently
  // matched nothing, so every querySelector('h3') in the mod returned null and
  // the tests agreed with each other while disagreeing with the browser.
  const m = part.match(/^([a-zA-Z][a-zA-Z0-9]*)?((?:\.[A-Za-z0-9_-]+)*)$/);
  if (!m) return false;
  const [, tag, cls] = m;
  if (tag && el.tagName !== tag.toUpperCase()) return false;
  for (const c of cls.split('.').filter(Boolean)) if (!el.classList.contains(c)) return false;
  return true;
}

function matchAll(root, sel) {
  const out = [];
  for (const group of sel.split(',')) {
    const g = group.trim();
    const isChild = g.indexOf('>') !== -1;
    const parts = isChild ? g.split('>').map(s => s.trim()) : g.split(/\s+/);
    for (const el of root._all()) {
      if (!matchOne(el, parts[parts.length - 1])) continue;
      if (parts.length === 1) { if (out.indexOf(el) === -1) out.push(el); continue; }
      if (isChild) {
        if (el.parentNode && matchOne(el.parentNode, parts[parts.length - 2]) && out.indexOf(el) === -1) out.push(el);
      } else {
        let a = el.parentNode, found = false;
        while (a) { if (matchOne(a, parts[parts.length - 2])) { found = true; break; } a = a.parentNode; }
        if (found && out.indexOf(el) === -1) out.push(el);
      }
    }
  }
  return out;
}

const DOC = {
  _focused: null,
  body: new El('body'),
  createElement: t => new El(t),
  getElementById: id => DOC.body._all().find(e => e.id === id) || null,
  addEventListener() {},
  get activeElement() { return DOC._focused; }
};

// ---------- Globals main.js expects ----------
global.document = DOC;
global.window = { addEventListener() {} };
global.l = id => DOC.getElementById(id);
global.loc = s => s;
global.Beautify = n => String(n);
global.romanize = n => 'R' + n;
global.PlaySound = () => {};

// Timers must fire in delay order, not insertion order. The mod schedules
// competing callbacks at 0, 50 and 100 ms against the same prompt DOM, and a
// FIFO queue hid a real focus conflict: a later-scheduled 100 ms heading focus
// actually runs after a 0 ms focus restore, not before it. Ties keep insertion
// order, which is what the browser does.
const timers = [];
let timerSeq = 0;
global.setTimeout = (fn, delay) => {
  timers.push({ fn, delay: delay || 0, seq: timerSeq++ });
  return timerSeq;
};
global.clearTimeout = () => {};
function runTimers(max = 50) {
  let n = 0;
  while (timers.length && n++ < max) {
    // Re-sort each pass: a callback may schedule another timer.
    timers.sort((a, b) => (a.delay - b.delay) || (a.seq - b.seq));
    const t = timers.shift();
    try { t.fn(); } catch (e) { console.log('  (timer threw: ' + e.message + ')'); }
  }
}

let MOD = null;
global.Game = {
  registerMod(name, obj) { MOD = obj; },
  registerHook() {},
  prefs: { screenreader: 1 },
  onMenu: '', promptOn: 0,
  Milks: [], AllMilks: [], milkType: 0, milkProgress: 0, ascensionMode: 0,
  AchievementsOwned: 0,
  UpgradesById: {}, AchievementsById: {}, Upgrades: {}, UpgradesInStore: [],
  Objects: {}, ObjectsById: {}, cookiesMultByType: {}, dragonAuras: {},
  permanentUpgrades: [-1, -1, -1, -1, -1],
  SelectingPermanentUpgrade: -1, nextAscensionMode: 0,
  ascensionModes: {}, seasons: {}, lumps: 0,
  Has: () => 0, HasAchiev: () => 0, CountsAsUpgradeOwned: () => 1,
  Notify() {}, ClosePrompt() {}, Prompt() {},
  ToggleSpecialMenu() {}, ShowMenu() {}, UpdateMenu() {}, DrawBuildings() {},
  RebuildUpgrades() {}, crateTooltip: () => '', getDynamicTooltip: () => '',
  SelectDragonAura() {}, AssignPermanentSlot() {}, PutUpgradeInPermanentSlot() {},
  PickAscensionMode() {}, UpdateAscensionModePrompt() {}
};

// ---------- Load the mod ----------
try { new Function(fs.readFileSync(MAIN, 'utf8'))(); }
catch (e) { console.log('LOAD FAILED: ' + e.message); process.exit(1); }
if (!MOD) { console.log('LOAD FAILED: registerMod never called'); process.exit(1); }
console.log('Loaded ' + MAIN);
console.log('Mod object: ' + Object.keys(MOD).length + ' members.\n');

// Capture announcements instead of touching live regions.
const spoken = [];
MOD._processQueue = function () {};
MOD._announceQueue = { push: t => spoken.push(t), unshift: t => spoken.unshift(t), length: 0 };
function clearSpoken() { spoken.length = 0; }

// =====================================================================
section("1. getMilkInfo: flavour follows the Milk selector", function () {
  need(['getMilkInfo']);
  Game.Milks = [{ name: 'Plain milk' }, { name: 'Chocolate milk' }, { name: 'Raspberry milk' }];
  Game.AllMilks = [{ name: 'Automatic' }, { name: 'Plain milk' }, { name: 'Chocolate milk' }, { name: 'Zebra milk' }];
  Game.milkProgress = 2.0;      // rank 2 -> Game.Milks[2] = Raspberry milk
  Game.AchievementsOwned = 50;

  Game.milkType = 0; Game.ascensionMode = 0;
  eq('automatic mode reports the rank milk', MOD.getMilkInfo().milkName, 'Raspberry milk');
  Game.milkType = 3;
  eq('selector choice wins (Zebra, not rank)', MOD.getMilkInfo().milkName, 'Zebra milk');
  Game.ascensionMode = 1;
  eq('Born again ignores the selector', MOD.getMilkInfo().milkName, 'Raspberry milk');
  Game.ascensionMode = 0;
  Game.milkType = 99;
  eq('out-of-range milkType falls back to rank', MOD.getMilkInfo().milkName, 'Raspberry milk');
  Game.milkType = 2;
  eq('getMilkInfo agrees with the Milk selector label source',
    MOD.getMilkInfo().milkName, Game.AllMilks[2].name);
  eq('rank and percent stay achievement based', MOD.getMilkInfo().rank, 3);
  eq('percent is achievement based', MOD.getMilkInfo().percent, 200);
  Game.milkType = 0;

  // =====================================================================
});
section("2. addStatsHeadings: heading outline over the stats menu", function () {
  need(['addStatsHeadings', 'enhanceMenuHeadings']);
  function buildStatsMenu() {
    DOC.body.children = [];
    DOC._focused = null;
    const menu = new El('div'); menu.id = 'menu'; DOC.body.appendChild(menu);
    const section = new El('div'); section.className = 'section'; section.textContent = 'Statistics';
    menu.appendChild(section);
    const subs = {};
    function subsection(titleText) {
      const sub = new El('div'); sub.className = 'subsection';
      const t = new El('div'); t.className = 'title'; t.textContent = titleText;
      sub.appendChild(t); menu.appendChild(sub); subs[titleText] = sub; return sub;
    }
    const general = subsection('General');
    // A .title that is inline DATA, not a section header (game reuses the class).
    const listing = new El('div'); listing.className = 'listing';
    const dataTitle = new El('span'); dataTitle.className = 'title'; dataTitle.textContent = 'Prestige level: 42';
    listing.appendChild(dataTitle); general.appendChild(listing);

    const upg = subsection('Upgrades');
    const pres = subsection('Prestige');
    const ach = subsection('Achievements');

    function crate(id, kind, extraClass) {
      const c = new El('button');
      c.className = 'crate ' + kind + (extraClass ? ' ' + extraClass : '');
      c.setAttribute('data-id', String(id));
      return c;
    }
    function crateBox(parent, crates) {
      const box = new El('div'); box.className = 'listing crateBox';
      crates.forEach(c => box.appendChild(c));
      parent.appendChild(box); return box;
    }
    Game.UpgradesById = {
      1: { id: 1, pool: 'debug', name: 'Debug upgrade' },
      2: { id: 2, pool: '', name: 'Plain upgrade' },
      3: { id: 3, pool: 'cookie', name: 'A cookie' },
      4: { id: 4, pool: 'prestige', name: 'Heavenly' }
    };
    Game.AchievementsById = {
      10: { id: 10, pool: 'normal', name: 'Wake and bake' },
      11: { id: 11, pool: 'shadow', name: 'Third party' },
      12: { id: 12, pool: 'dungeon', name: 'Dungeon thing' }
    };
    const boxes = {
      boxDebug: crateBox(upg, [crate(1, 'upgrade')]),
      boxNormal: crateBox(upg, [crate(2, 'upgrade'), crate(2, 'upgrade')]),
      boxCookie: crateBox(upg, [crate(3, 'upgrade')]),
      boxPrestige: crateBox(pres, [crate(4, 'upgrade', 'heavenly')]),
      boxAchNormal: crateBox(ach, [crate(10, 'achievement'), crate(10, 'achievement'), crate(10, 'achievement')]),
      boxAchShadow: crateBox(ach, [crate(11, 'achievement', 'shadow')]),
      boxAchDungeon: crateBox(ach, [crate(12, 'achievement')])
    };
    const emptyBox = crateBox(ach, []);   // no crates at all
    return { menu, section, dataTitle, boxes, emptyBox, subs };
  }
  function headingBefore(box) {
    const p = box.parentNode, i = p.children.indexOf(box);
    return i > 0 ? p.children[i - 1] : null;
  }

  let S = buildStatsMenu();
  Game.onMenu = 'stats';
  MOD.addStatsHeadings();

  eq('.section becomes a level 2 heading', S.section.getAttribute('aria-level'), '2');
  eq('.section gets heading role', S.section.getAttribute('role'), 'heading');
  const hDebug = headingBefore(S.boxes.boxDebug);
  ok('crate box gets a preceding heading', !!hDebug && hDebug.getAttribute('role') === 'heading');
  eq('box heading is level 4', hDebug && hDebug.getAttribute('aria-level'), '4');
  eq('debug pool named + counted', hDebug.textContent, 'Debug upgrades, 1 items');
  eq('normal upgrades box', headingBefore(S.boxes.boxNormal).textContent, 'Unlocked upgrades, 2 items');
  eq('cookie upgrades box', headingBefore(S.boxes.boxCookie).textContent, 'Cookie upgrades, 1 items');
  eq('prestige upgrades box', headingBefore(S.boxes.boxPrestige).textContent, 'Prestige upgrades, 1 items');
  eq('normal achievements box', headingBefore(S.boxes.boxAchNormal).textContent, 'Achievements, 3 items');
  eq('shadow box is NOT reported as "Achievements, 0 items"',
    headingBefore(S.boxes.boxAchShadow).textContent, 'Shadow achievements, 1 items');
  eq('dungeon achievements box', headingBefore(S.boxes.boxAchDungeon).textContent, 'Dungeon achievements, 1 items');
  eq('box itself becomes a group', S.boxes.boxAchShadow.getAttribute('role'), 'group');
  eq('group is labelled', S.boxes.boxAchShadow.getAttribute('aria-label'), 'Shadow achievements');
  ok('inline data .title is not promoted to a heading', S.dataTitle.getAttribute('role') === null);
  ok('an empty crate box gets no heading', headingBefore(S.emptyBox) === null ||
    headingBefore(S.emptyBox).getAttribute('aria-level') !== '4');

  const lvl4Before = S.menu._all().filter(e => e.getAttribute('aria-level') === '4').length;
  MOD.addStatsHeadings();
  eq('second pass adds no duplicate headings',
    S.menu._all().filter(e => e.getAttribute('aria-level') === '4').length, lvl4Before);

  S = buildStatsMenu(); Game.onMenu = 'prefs';
  MOD.addStatsHeadings();
  eq('no work when the stats menu is not open', S.section.getAttribute('role'), null);
  Game.onMenu = 'stats';

  S = buildStatsMenu(); Game.AchievementsById = {};
  MOD.addStatsHeadings();
  eq('shadow CLASS fallback when the pool lookup fails',
    headingBefore(S.boxes.boxAchShadow).textContent, 'Shadow achievements, 1 items');

  S = buildStatsMenu();
  MOD.enhanceMenuHeadings(S.menu);
  const subTitles = matchAll(S.menu, '.subsection > .title');
  eq('found all four subsection titles', subTitles.length, 4);
  ok('every subsection title is level 3', subTitles.every(t => t.getAttribute('aria-level') === '3'));
  ok('enhanceMenuHeadings leaves the inline data title alone', S.dataTitle.getAttribute('aria-level') === null);

  // =====================================================================
});
section("3. announce(): modal suppression", function () {
  need(['announce', 'announceUrgent', 'modalPanelOpen']);
  Game.promptOn = 0; clearSpoken();
  MOD.announce('background chatter');
  eq('speaks normally with no modal open', spoken.length, 1);

  Game.promptOn = 1; clearSpoken();
  MOD.announce('background chatter');
  eq('dropped while the game prompt is open', spoken.length, 0);
  MOD.announce('dialog says this', true);
  eq('force overrides suppression', spoken.length, 1);
  Game.promptOn = 0;

  const fakeDialog = new El('div'); fakeDialog.id = 'a11yUpgradeDialog'; DOC.body.appendChild(fakeDialog);
  clearSpoken();
  MOD.announce('background chatter');
  eq('dropped while our own dialog is open', spoken.length, 0);
  ok('modalPanelOpen() true for our dialog', MOD.modalPanelOpen() === true);
  fakeDialog.remove();
  ok('modalPanelOpen() false once the dialog is gone', MOD.modalPanelOpen() === false);
  clearSpoken();
  MOD.announce('back to normal');
  eq('speaks again after the dialog closes', spoken.length, 1);

  Game.promptOn = 1; clearSpoken();
  MOD._lastUrgentText = ''; MOD._lastUrgentTime = 0; MOD._announceProcessing = false;
  MOD.announceUrgent('GOLDEN COOKIE');
  eq('urgent is never suppressed by a modal', spoken.length, 1);
  Game.promptOn = 0;

  const savedPrompt = Object.getOwnPropertyDescriptor(Game, 'promptOn');
  Object.defineProperty(Game, 'promptOn', { get() { throw new Error('boom'); }, configurable: true });
  let threw = false;
  try { MOD.modalPanelOpen(); } catch (e) { threw = true; }
  ok('modalPanelOpen swallows a hostile Game.promptOn', !threw);
  Object.defineProperty(Game, 'promptOn', savedPrompt || { value: 0, writable: true, configurable: true });
  Game.promptOn = 0;

  // =====================================================================
});
section("4. Pantheon placement: verify then announce", function () {
  need(['createSpiritSlotButtons']);
  function makePantheon(slots, swaps) {
    const gods = {
      asceticism: { id: 0, name: 'Asceticism', slot: -1 },
      decadence: { id: 1, name: 'Decadence', slot: -1 },
      ruin: { id: 2, name: 'Ruin', slot: -1 }
    };
    const M = {
      gods, godsById: { 0: gods.asceticism, 1: gods.decadence, 2: gods.ruin },
      slot: slots.slice(), swaps: swaps, swapsUsed: 0, slotGodCalls: 0,
      // Mirrors minigamePantheon.js slotGod(): moves the god, swapping occupants.
      slotGod(god, slot) {
        M.slotGodCalls++;
        if (slot === god.slot) return;
        if (slot !== -1 && M.slot[slot] !== -1) {
          M.godsById[M.slot[slot]].slot = god.slot;
          if (god.slot !== -1) M.slot[god.slot] = M.slot[slot];
        } else if (god.slot !== -1) M.slot[god.slot] = -1;
        if (slot !== -1) M.slot[slot] = god.id;
        god.slot = slot;
      },
      useSwap(n) { M.swapsUsed += n; M.swaps = Math.max(0, M.swaps - n); }
    };
    for (let i = 0; i < M.slot.length; i++) if (M.slot[i] !== -1) M.godsById[M.slot[i]].slot = i;
    return M;
  }
  const SLOTS = ['Diamond', 'Ruby', 'Jade'];
  function pantheonRun(pan, godId, slotIndex) {
    Game.Objects['Temple'] = { id: 7, name: 'Temple', minigame: pan };
    MOD.enhancePantheonMinigame = function () {};   // avoid a full DOM rebuild in test
    DOC.body.children = [];
    const host = new El('div'); DOC.body.appendChild(host);
    const anchor = new El('div'); host.appendChild(anchor);
    MOD.createSpiritSlotButtons(pan.godsById[godId], anchor, pan, SLOTS);
    const container = anchor.nextSibling;          // inserted after the anchor
    if (!container) throw new Error('slot buttons were never inserted');
    clearSpoken();
    container.children[slotIndex].click();
    return spoken.slice();
  }

  let pan = makePantheon([-1, -1, -1], 3);
  let said = pantheonRun(pan, 0, 0);
  eq('places into an empty slot', pan.slot[0], 0);
  eq('spends exactly one swap', pan.swapsUsed, 1);
  eq('announces the placement', said[0], 'Asceticism placed in Diamond slot');

  pan = makePantheon([0, -1, -1], 3);
  said = pantheonRun(pan, 0, 0);
  eq('already in that slot says so plainly', said[0], 'Asceticism is already in the Diamond slot');
  eq('already in slot spends no swap', pan.swapsUsed, 0);
  eq('already in slot never calls slotGod', pan.slotGodCalls, 0);

  pan = makePantheon([1, -1, -1], 3);
  said = pantheonRun(pan, 0, 0);
  eq('an occupied slot is refused', said[0], 'Slot already occupied');
  eq('refusal spends no swap', pan.swapsUsed, 0);

  pan = makePantheon([-1, -1, -1], 0);
  said = pantheonRun(pan, 0, 1);
  eq('no swaps left is refused with a reason', said[0], 'Cannot place Asceticism. No worship swaps available.');
  eq('no swaps leaves the slot empty', pan.slot[1], -1);
  eq('no swaps spends nothing', pan.swapsUsed, 0);

  pan = makePantheon([-1, -1, -1], 3);
  pan.slotGod = function () { pan.slotGodCalls++; };      // silently does nothing
  said = pantheonRun(pan, 0, 2);
  eq('a silent slotGod failure is reported, not assumed',
    said[0], 'Could not place Asceticism in the Jade slot');
  eq('a failed placement spends no swap', pan.swapsUsed, 0);

  pan = makePantheon([-1, -1, -1], 3);
  pan.slotGod = function () { throw new Error('game blew up'); };
  said = pantheonRun(pan, 1, 0);
  eq('a throwing slotGod is announced, not silent', said[0], 'Error placing Decadence');

  // =====================================================================
});
section("5. Dragon aura prompt safety net", function () {
  need(['labelDragonAuraPrompt', 'wrapPermanentSlotFunctions']);
  Game.dragonAuras = {
    0: { name: 'No aura', dname: 'No aura', desc: 'Select an aura.' },
    1: { name: 'Breath of Milk', dname: 'Milchhauch', desc: 'Kittens are <b>5%</b> more effective.' },
    4: { name: 'Reaper of Fields', dname: 'Feldschnitter', desc: 'Golden cookies may trigger a <b>Dragon Harvest</b>.' }
  };
  Game.dragonAura = 1; Game.dragonAura2 = 0;
  Game.SelectingDragonAura = 1;
  function buildAuraPrompt(touch) {
    DOC.body.children = []; DOC._focused = null;
    const pc = new El('div'); pc.id = 'promptContentPickDragonAura'; DOC.body.appendChild(pc);
    [0, 1, 4].forEach(i => {
      const c = new El('div'); c.className = 'crate enabled';
      c.setAttribute(touch ? 'ontouchend' : 'onclick', "PlaySound('snd/tick.mp3');Game.SetDragonAura(" + i + ",0);");
      pc.appendChild(c);
    });
    const junk = new El('div'); junk.className = 'crate'; pc.appendChild(junk);  // no handler
    return pc;
  }
  let pc = buildAuraPrompt(false);
  clearSpoken();
  MOD.labelDragonAuraPrompt(0, 'open');
  let labelled = matchAll(pc, '.crate').filter(c => c.getAttribute('aria-label'));
  eq('labels every aura crate that has a handler', labelled.length, 3);
  // dname, not name: the game localizes aura names at src/main.js:14851, and
  // every other aura readout in the mod reads dname.
  // The space before the full stop is stripHtml's doing (main.js:5183 replaces
  // each tag with a space); it is pre-existing, mod-wide, and out of scope here.
  eq('label uses the localized name (dname), not the English key',
    labelled[2].getAttribute('aria-label'),
    'Feldschnitter. Golden cookies may trigger a Dragon Harvest .');
  eq('the equipped aura is marked as current', labelled[1].getAttribute('aria-label'),
    'Current aura. Milchhauch. Kittens are 5% more effective.');
  eq('aura crate gets a button role', labelled[0].getAttribute('role'), 'button');
  eq('aura crate gets a tab stop', labelled[0].getAttribute('tabindex'), '0');
  eq('announces the aura count and how to apply', spoken[0],
    '3 dragon auras available. Tab through them, press Enter to choose one, then Confirm to apply.');
  ok('focus lands on the first labelled crate', DOC._focused === labelled[0]);
  ok('a handler-less crate is left alone', matchAll(pc, '.crate')[3].getAttribute('aria-label') === null);

  // A pending selection that is not the equipped aura reads as "Selected.",
  // matching the inline dragon panel picker's wording.
  Game.SelectingDragonAura = 4;
  MOD.labelDragonAuraPrompt(0, 'quiet');
  eq('a pending, not yet applied pick reads as Selected',
    matchAll(pc, '.crate').filter(c => c.getAttribute('aria-label'))[2].getAttribute('aria-label'),
    'Selected. Feldschnitter. Golden cookies may trigger a Dragon Harvest .');
  Game.SelectingDragonAura = 1;

  // Slot 1 reads dragonAura2, so the "current" marker must follow the slot.
  MOD.labelDragonAuraPrompt(1, 'quiet');
  eq('slot 1 marks dragonAura2 as current, not dragonAura',
    matchAll(pc, '.crate').filter(c => c.getAttribute('aria-label'))[0].getAttribute('aria-label'),
    'Current aura. No aura. Select an aura.');

  const bogus = new El('div'); bogus.className = 'crate';
  bogus.setAttribute('onclick', 'Game.SetDragonAura(99,0);');
  pc.appendChild(bogus);
  clearSpoken();
  MOD.labelDragonAuraPrompt(0, 'quiet');
  ok('an unknown aura id is skipped, not invented', bogus.getAttribute('aria-label') === null);
  eq('a quiet pass stays silent', spoken.length, 0);

  pc = buildAuraPrompt(true);
  clearSpoken();
  MOD.labelDragonAuraPrompt(0, 'open');
  eq('reads the ontouchend handler too (Game.clickStr on touch)',
    matchAll(pc, '.crate').filter(c => c.getAttribute('aria-label')).length, 3);
  {
    const target = matchAll(pc, '.crate').filter(c => c.getAttribute('aria-label'))[0];
    let clicked = 0;
    target.addEventListener('click', () => { clicked++; });
    target.dispatch('keydown', { key: 'Enter', preventDefault() {} });
    ok('Enter activates an aura crate', clicked === 1);
    let clicked2 = false;
    const t2 = matchAll(pc, '.crate').filter(c => c.getAttribute('aria-label'))[1];
    t2.addEventListener('click', () => { clicked2 = true; });
    t2.dispatch('keydown', { key: ' ', preventDefault() {} });
    ok('Space activates an aura crate', clicked2);
    // Relabelling re-runs on every refresh pass, so the keydown listener must
    // be attached once per node or one Enter would fire two clicks.
    clicked = 0;
    MOD.labelDragonAuraPrompt(0, 'quiet');
    MOD.labelDragonAuraPrompt(0, 'quiet');
    target.dispatch('keydown', { key: 'Enter', preventDefault() {} });
    eq('relabelling does not stack a second keydown listener', clicked, 1);
  }
  DOC.body.children = []; clearSpoken();
  let auraThrew = false;
  try { MOD.labelDragonAuraPrompt(0, 'open'); } catch (e) { auraThrew = true; }
  ok('missing aura prompt is a silent no-op', !auraThrew && spoken.length === 0);

  {
    // Game.Prompt rewrites promptL.innerHTML wholesale (src/main.js:6334), and
    // SetDragonAura re-enters SelectDragonAura with update = 1 on every crate
    // click (src/main.js:14916). So a refresh destroys our labelled crates and
    // hands back fresh, unlabelled ones: the wrapper MUST relabel on a refresh.
    let rebuilt = null;
    Game.SelectDragonAura = function (slot, update) {
      rebuilt = buildAuraPrompt(false);   // simulate the innerHTML rebuild
    };
    delete Game.SelectDragonAura._a11yWrapped;
    MOD.wrapPermanentSlotFunctions();
    ok('SelectDragonAura is wrapped', Game.SelectDragonAura._a11yWrapped === true);
    const wrapped = Game.SelectDragonAura;
    MOD.wrapPermanentSlotFunctions();
    ok('re-wrapping SelectDragonAura is refused', Game.SelectDragonAura === wrapped);

    timers.length = 0; clearSpoken();
    Game.SelectingDragonAura = 1;
    Game.SelectDragonAura(0, false);
    let live = matchAll(rebuilt, '.crate').filter(c => c.getAttribute('aria-label'));
    eq('opening the prompt labels the crates', live.length, 3);
    ok('opening focuses the first crate', DOC._focused === live[0]);

    // The refresh pass: this is the case the old code skipped entirely.
    timers.length = 0; clearSpoken();
    Game.SelectingDragonAura = 4;            // as SetDragonAura would set it
    Game.SelectDragonAura(0, 1);
    live = matchAll(rebuilt, '.crate').filter(c => c.getAttribute('aria-label'));
    eq('a refresh relabels the rebuilt crates', live.length, 3);
    eq('a refresh confirms what was picked', spoken[0],
      'Selected: Feldschnitter. Choose Confirm to apply.');
    ok('a refresh restores focus to the picked crate',
      DOC._focused === live[2], 'focused=' + (DOC._focused && DOC._focused.getAttribute('aria-label')));
    // The deferred pass must not speak a second time.
    const spokenAfterRefresh = spoken.length;
    runTimers();
    eq('the deferred pass adds no extra speech', spoken.length, spokenAfterRefresh);
  }

  {
    // The generic Game.Prompt handler focuses the h3 100 ms after every build
    // (main.js:273), while a refresh restores focus to the picked crate at
    // 0 ms. Without the claim flag the later heading focus wins, so the
    // player's keypress reads the dialog title instead of their choice.
    need(['focusPromptDefault']);
    let rebuilt = null;
    Game.SelectDragonAura = function (slot, update) {
      rebuilt = buildAuraPrompt(false);                 // innerHTML rebuild
      const h = new El('h3'); h.textContent = "Set your dragon's aura";
      rebuilt.appendChild(h);
    };
    delete Game.SelectDragonAura._a11yWrapped;
    MOD.promptFocusClaimed = false;                     // as Game.Prompt resets
    MOD.wrapPermanentSlotFunctions();

    timers.length = 0; clearSpoken();
    Game.SelectingDragonAura = 4;
    Game.SelectDragonAura(0, 1);                        // the refresh pass
    const live = matchAll(rebuilt, '.crate').filter(c => c.getAttribute('aria-label'));
    ok('a refresh claims prompt focus', MOD.promptFocusClaimed === true);
    // Now run the real generic handler, as the 100 ms timer does in game.
    const moved = MOD.focusPromptDefault(rebuilt, []);
    ok('the generic handler stands down after a claim', moved === false);
    ok('focus stays on the picked crate, not the heading', DOC._focused === live[2],
      'focused=' + (DOC._focused && (DOC._focused.getAttribute('aria-label') || DOC._focused.tagName)));

    // With no claim, the same handler must still focus the heading: the
    // stand-down must not break ordinary prompts.
    MOD.promptFocusClaimed = false;
    DOC._focused = null;
    ok('an unclaimed prompt still focuses its heading',
      MOD.focusPromptDefault(rebuilt, []) === true &&
      DOC._focused === rebuilt.querySelector('h3'));
    // Headingless prompt falls back to the first option link.
    MOD.promptFocusClaimed = false;
    DOC._focused = null;
    const bare = new El('div');
    const opt = new El('a'); opt.className = 'option';
    ok('a headingless prompt focuses the first option',
      MOD.focusPromptDefault(bare, [opt]) === true && DOC._focused === opt);
  }

  // =====================================================================
});
section("6. Permanent slot picker: focus + count", function () {
  need(['labelPermanentUpgradePrompt']);
  function buildPermaPrompt(n) {
    DOC.body.children = []; DOC._focused = null;
    const wrap = new El('div'); DOC.body.appendChild(wrap);
    const pc = new El('div'); pc.id = 'promptContentPickPermaUpgrade'; wrap.appendChild(pc);
    Game.UpgradesById = {};
    for (let i = 1; i <= n; i++) {
      Game.UpgradesById[i] = { id: i, name: 'Upgrade ' + i, desc: 'Does <b>thing</b> ' + i + '.' };
      const c = new El('button');
      c.className = 'crate upgrade enabled';
      c.setAttribute('data-id', String(i));
      const lab = new El('label'); lab.className = 'srOnly'; c.appendChild(lab);
      pc.appendChild(c);
    }
    const opt = new El('a'); opt.className = 'option'; opt.textContent = 'Confirm'; wrap.appendChild(opt);
    return { pc, wrap, opt };
  }
  let PP = buildPermaPrompt(4);
  clearSpoken();
  MOD.labelPermanentUpgradePrompt();
  eq('announces how many upgrades are on offer', spoken[0], '4 upgrades available to slot');
  const permaCrates = matchAll(PP.pc, 'button.crate[data-id]');
  ok('focus lands on the first crate', DOC._focused === permaCrates[0]);
  eq('crate carries name + description', permaCrates[0].getAttribute('aria-label'), 'Upgrade 1. Does thing 1.');
  eq('srOnly label is filled too', permaCrates[0].children[0].textContent, 'Upgrade 1. Does thing 1.');
  eq('option link becomes a button', PP.opt.getAttribute('role'), 'button');

  DOC._focused = permaCrates[2];
  clearSpoken();
  MOD.labelPermanentUpgradePrompt();
  ok('re-labelling does not yank focus back to the top', DOC._focused === permaCrates[2]);
  eq('re-labelling stays silent', spoken.length, 0);

  PP = buildPermaPrompt(1);
  clearSpoken();
  MOD.labelPermanentUpgradePrompt();
  eq('singular wording for a single upgrade', spoken[0], '1 upgrade available to slot');

  PP = buildPermaPrompt(0);
  clearSpoken();
  MOD.labelPermanentUpgradePrompt();
  eq('an empty list is still announced', spoken[0], '0 upgrades available to slot');
  ok('an empty list focuses nothing', DOC._focused === null);

  // =====================================================================
});
section("7. Challenge mode prompt: rebuild survival", function () {
  need(['labelChallengeModePrompt']);
  // Game.PickAscensionMode re-enters ITSELF on every crate click
  // (src/main.js:4036) and Game.Prompt rewrites promptL.innerHTML wholesale
  // (src/main.js:6334), so each pick hands back brand new, unlabelled crates.
  Game.ascensionModes = {
    0: { name: 'None', dname: 'Keine', desc: 'No special modifier.' },
    1: { name: 'Born again', dname: 'Neugeboren', desc: 'Everything is <b>reset</b>.' }
  };
  Game.nextAscensionMode = 0;
  const byId = {};
  function buildChallengePrompt() {
    DOC.body.children = []; DOC._focused = null;
    for (const k in byId) delete byId[k];
    const wrap = new El('div'); DOC.body.appendChild(wrap);
    const pc = new El('div'); pc.id = 'promptContentPickChallengeMode'; wrap.appendChild(pc);
    const h = new El('h3'); h.textContent = 'Select a challenge mode'; pc.appendChild(h);
    for (const i in Game.ascensionModes) {
      const c = new El('div'); c.className = 'crate enabled';
      c.id = 'challengeModeSelector' + i;
      pc.appendChild(c); byId[c.id] = c;
    }
    const opt = new El('a'); opt.className = 'option'; opt.textContent = 'Confirm'; wrap.appendChild(opt);
    return { pc, wrap, opt };
  }
  // The labeller reads crates through l('challengeModeSelector'+i), so the id
  // lookup must see the freshly built nodes.
  const realL = global.l;
  global.l = id => byId[id] || realL(id);

  let CP = buildChallengePrompt();
  clearSpoken();
  MOD.promptFocusClaimed = false;
  MOD.labelChallengeModePrompt('open');
  eq('labels each challenge mode crate with its localized name',
    byId.challengeModeSelector1.getAttribute('aria-label'), 'Neugeboren. Everything is reset .');
  eq('marks the currently selected mode',
    byId.challengeModeSelector0.getAttribute('aria-label'),
    'Keine. Currently selected. No special modifier.');
  eq('crate gets a button role', byId.challengeModeSelector0.getAttribute('role'), 'button');
  eq('crate gets a tab stop', byId.challengeModeSelector0.getAttribute('tabindex'), '0');
  eq('option link becomes a button', CP.opt.getAttribute('role'), 'button');
  // On a first open the generic Game.Prompt handler reads the whole dialog, so
  // the labeller must NOT claim focus and must stay silent.
  eq('opening the prompt adds no speech of its own', spoken.length, 0);
  ok('opening leaves focus to the generic prompt handler',
    MOD.promptFocusClaimed === false);

  {
    const target = byId.challengeModeSelector1;
    let clicked = 0;
    target.addEventListener('click', () => { clicked++; });
    target.dispatch('keydown', { key: 'Enter', preventDefault() {}, target });
    ok('Enter activates a challenge mode crate', clicked === 1);
    target.dispatch('keydown', { key: ' ', preventDefault() {}, target });
    ok('Space activates a challenge mode crate', clicked === 2);
    MOD.labelChallengeModePrompt('open');
    MOD.labelChallengeModePrompt('open');
    clicked = 0;
    target.dispatch('keydown', { key: 'Enter', preventDefault() {}, target });
    eq('relabelling does not stack a second keydown listener', clicked, 1);
  }

  // The rebuild: the player picked mode 1, so the game rebuilt the prompt and
  // destroyed the crate they activated. Focus must land on its replacement and
  // the new pick must be spoken, or the keypress produces no speech at all.
  CP = buildChallengePrompt();
  Game.nextAscensionMode = 1;
  clearSpoken();
  MOD.promptFocusClaimed = false;
  MOD.labelChallengeModePrompt('refresh');
  eq('a rebuild relabels the fresh crates',
    matchAll(CP.pc, '.crate').filter(c => c.getAttribute('aria-label')).length, 2);
  eq('a rebuild confirms what was picked', spoken[0],
    'Selected: Neugeboren. Choose Confirm to apply.');
  ok('a rebuild restores focus to the picked crate',
    DOC._focused === byId.challengeModeSelector1,
    'focused=' + (DOC._focused && DOC._focused.id));
  ok('a rebuild claims focus so the heading handler stands down',
    MOD.promptFocusClaimed === true);
  ok('the generic handler then leaves the crate alone',
    MOD.focusPromptDefault(CP.pc, [CP.opt]) === false &&
    DOC._focused === byId.challengeModeSelector1);

  // A mode with no dname must still read, and an absent crate must not throw.
  Game.ascensionModes = { 0: { name: 'None' }, 7: { name: 'Ghost' } };
  Game.nextAscensionMode = 0;
  CP = buildChallengePrompt();
  delete byId.challengeModeSelector7;          // crate missing from the DOM
  clearSpoken();
  let cmThrew = false;
  try { MOD.labelChallengeModePrompt('open'); } catch (e) { cmThrew = true; }
  ok('a missing crate is skipped, not fatal', !cmThrew);
  eq('falls back to name when dname is absent',
    byId.challengeModeSelector0.getAttribute('aria-label'), 'None. Currently selected.');
  ok('a description-less label carries no trailing space',
    !/\s$/.test(byId.challengeModeSelector0.getAttribute('aria-label')));

  DOC.body.children = []; clearSpoken();
  let gone = false;
  try { MOD.labelChallengeModePrompt('refresh'); } catch (e) { gone = true; }
  ok('a closed prompt is a silent no-op', !gone && spoken.length === 0);

  global.l = realL;
  // =====================================================================
});
section("8. Source invariants: no duplicate game-function wrappers", function () {
  // Structural check on the source text, because the harness never calls init()
  // and so cannot see two wrappers installed on the same game function. A
  // duplicate wrapper is silent: both run, the later one wins, and the earlier
  // one's labels are overwritten 50 ms after the player opens the dialog.
  const text = fs.readFileSync(MAIN, 'utf8');
  const counts = {};
  const re = /Game\.([A-Za-z_][A-Za-z0-9_]*)\s*=\s*function/g;
  let m;
  while ((m = re.exec(text)) !== null) counts[m[1]] = (counts[m[1]] || 0) + 1;

  // Known-good multiples: short lived capture wrappers that save the original
  // and restore it in the same call, plus one guarded persistent Popup wrapper.
  const allowed = { Notify: 3, Popup: 2 };
  const offenders = Object.keys(counts)
    .filter(k => counts[k] > (allowed[k] || 1))
    .map(k => k + ' x' + counts[k]);
  ok('each game function is wrapped exactly once', offenders.length === 0,
    offenders.join(', '));

  // PickAscensionMode specifically: it used to be wrapped twice, and the second
  // wrapper called a now deleted labeller that dropped the descriptions.
  eq('Game.PickAscensionMode is wrapped once', counts.PickAscensionMode, 1);
  // Match a definition or a call, not a bare mention: the comment explaining
  // why the duplicate was removed names the old function on purpose.
  ok('the superseded labelChallengeModeSelector is neither defined nor called',
    !/labelChallengeModeSelector\s*(?::\s*function|\()/.test(text));
  // =====================================================================
});
console.log('\n=============================================');
console.log('PASS ' + pass + '   FAIL ' + fail);
if (fail) { console.log('\nFailures:'); failures.forEach(f => console.log('  - ' + f)); }
console.log('=============================================');
process.exit(fail ? 1 : 0);
