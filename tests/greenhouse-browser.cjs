'use strict';
// Runs the real Greenhouse panel builders and delegated UI handlers in isolated
// headless Chrome, with a synthetic empty Garden. Never attaches to the game,
// reads a player save, or runs Greenhouse's automation hook. NVDA is not tested.
// Requires the user's installed Greenhouse source; no third-party code is bundled.
// Run Chrome fixtures serially: an inactive document can update activeElement
// without dispatching focus events. The fixture records that precondition.
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const repo = path.resolve(__dirname, '..');
const mainPath = process.env.CC_MAIN || path.join(repo, 'main.js');
const nativePath = process.env.CC_GREENHOUSE || 'D:/Games/Steam/steamapps/common/Cookie Clicker/resources/app/mods/workshop/GrandpasGreenhouse/main.js';
const chrome = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const scratchRoot = process.env.CC_TEST_SCRATCH;
const order = process.env.CC_GREENHOUSE_ORDER || 'native-first';
if (!['native-first', 'access-first'].includes(order)) throw Error('Unsupported CC_GREENHOUSE_ORDER');
if (!scratchRoot || !path.isAbsolute(scratchRoot)) throw Error('Set CC_TEST_SCRATCH to the absolute Hermes scratch directory.');
const scratch = fs.mkdtempSync(path.join(scratchRoot, 'cc-greenhouse-'));
const source = fs.readFileSync(mainPath, 'utf8');
const native = fs.readFileSync(nativePath, 'utf8');
const sha = text => crypto.createHash('sha256').update(text).digest('hex');
const frozenPath = path.join(process.env.CC_FROZEN_SOURCE || 'C:/Users/hacke/AppData/Local/hermes/cache/scratch/frozen-cookies-797f1740-inspection', 'fc_main.js');
const frozenSource = fs.readFileSync(frozenPath, 'utf8');
if (sha(frozenSource) !== '79e01acb53201cf029bbaab7b8f909e31c196ee594a66758cf004b84880dc233') throw Error('Pinned Frozen shortcut source changed');
const shortcutStart = frozenSource.indexOf('document.addEventListener("keydown", function (event)');
const shortcutEnd = frozenSource.indexOf('function writeFCButton(', shortcutStart);
if (shortcutStart < 0 || shortcutEnd < 0) throw Error('Native shortcut extraction boundaries changed');
const frozenShortcuts = frozenSource.slice(shortcutStart, shortcutEnd);
const end = native.lastIndexOf('})();');
if (end < 0 || !native.includes("var VERSION  = '1.5';")) throw Error('Unsupported native fixture source.');
// Test-only access to private UI producers. Their original bodies and event
// handlers remain intact; this export is inserted only into the scratch fixture.
const instrumented = native.slice(0, end) + 'globalThis.greenhouseFixture={buildPanel:buildPanel,refreshPanel:refreshPanel};\n' + native.slice(end);
const script = text => '<script>' + text.replace(/<\/script/gi, '<\\/script') + '</script>';
const html = '<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; img-src data:"><title>Greenhouse adapter fixture</title>' +
  '<div id="gardenHost"><div id="gardenContent"></div></div><button id="outside">Outside</button><div id="menu"></div><pre id="result"></pre>' + script(`
const l=id=>document.getElementById(id);
window.Beautify=value=>String(value); // display-only boundary used by native FC W
window.fixtureErrors=[];window.addEventListener('error',e=>fixtureErrors.push({message:e.message,stack:e.error?.stack}));
const hooks={logic:[],reset:[]};
const App={mods:{'grandpas greenhouse':{disabled:false},frozen_cookies:{disabled:false}}};
const Game={ready:true,mods:{},Objects:{},onMenu:'',promptOn:0,T:0,version:2.053,OnAscend:false,AscendTimer:0,toSave:false,
 registerMod(id,mod){this.mods[id]=mod;if(id==='grandpas greenhouse'){mod.init();mod.init=0;}},
 registerHook(type,fn){(hooks[type]||(hooks[type]=[])).push(fn);}};
const calls={plant:0,harvest:0,nativeShortcuts:0,network:[]};
const shortcutEffect=()=>{calls.nativeShortcuts++;return 'INERT';};
for(const name of ['Toggle','WriteSave','Reset','Notify'])Game[name]=shortcutEffect;
for(const name of ['toggleFrozen','copyToClipboard','getBuildingSpread','wrinklerValue'])window[name]=shortcutEffect;
for(const name of ['fetch','WebSocket','XMLHttpRequest'])window[name]=()=>{calls.network.push(name);throw Error('Network refused');};
const installShortcutState=()=>{window.FrozenCookies={version:'2.052.8',branch:'erb-',FCshortcuts:1,preferenceValues:{},currentBank:{},targetBank:{},frenzyTimes:{}};Game.mods.frozen_cookies={init:0};};
installShortcutState();
const garden={plot:Array.from({length:6},()=>Array.from({length:6},()=>[0,0])),getMuts:()=>[],
 plants:{},plantsById:[],plantsN:0,isTileUnlocked:(x,y)=>x<2&&y<2,soil:0,soilsById:[{name:'Dirt'}],nextStep:Date.now()+300000,
 useTool(){calls.plant++;},harvest(){calls.harvest++;}};
const farm={minigame:garden,minigameLoaded:true,onMinigame:true};Game.Objects.Farm=farm;
`) + (order === 'access-first' ? script(source) + script(`
Game.mods['screen reader accessibility'].initGreenhouseAccessibility();
Game.mods['screen reader accessibility'].initFrozenCookiesAccessibility();
Game.T=30;hooks.logic[0]();
`) + script(frozenShortcuts) + script(instrumented) : script(frozenShortcuts) + script(instrumented) + script(source)) + script(`
const result={checks:[],errors:[],samples:{}};
const focusEvents=[];let focusPhase='';
const focusSnapshots=[];
document.addEventListener('focusout',e=>{if(focusPhase)focusEvents.push({phase:focusPhase,target:e.target.id,connected:e.target.isConnected,related:e.relatedTarget?.id||null});});
function check(name,passed){result.checks.push({name,passed:!!passed});}
function key(el,key,extra={}){if(!el)return null;const keyCode=/^[a-z]$/i.test(key)?key.toUpperCase().charCodeAt(0):key==='Enter'?13:key==='Escape'?27:0;const e=new KeyboardEvent('keydown',{key,keyCode,bubbles:true,cancelable:true,...extra});el.dispatchEvent(e);return e;}
(async function(){
try{
 if(document.readyState!=='complete')await new Promise(resolve=>window.addEventListener('load',resolve,{once:true}));
 const mod=Game.mods['screen reader accessibility'],native=Game.mods['grandpas greenhouse'];
 const snapshot=phase=>focusSnapshots.push({phase,hasFocus:document.hasFocus(),active:document.activeElement?.id||null,remembered:mod._greenhouseAccessibility?.focused?.id||null,connected:mod._greenhouseAccessibility?.focused?.isConnected});
 window.focus();
 check('isolated fixture document receives focus events',document.hasFocus());
 const submitted=[];mod.announce=text=>submitted.push(text);mod.announceUrgent=text=>submitted.push(text);
 mod.initFrozenCookiesAccessibility();mod.updateFrozenCookiesAccessibility();
 check('FC input protection is independent of its absent menu capability',!!mod._frozenCookiesShortcutShield&&!mod._frozenCookiesAccessibility);
 const settings=native.getSettings();settings.mode='off';settings.tab='assistant';
 let root=greenhouseFixture.buildPanel(l('gardenContent'));greenhouseFixture.refreshPanel();
 const original=root.outerHTML,settingsBefore=native.save();
 mod.initGreenhouseAccessibility();mod.initGreenhouseAccessibility();
 const adapterHooks=hooks.logic.filter(fn=>String(fn).includes('MOD.updateGreenhouseAccessibility'));
 check('one bounded adapter hook registered',adapterHooks.length===1);
 const tick=()=>{Game.T=30;adapterHooks[0]();};tick();
 check('six native mode buttons adapted',root.querySelectorAll('[data-act="mode"][role="button"]').length===6);
 check('mode is not activated by focus',native.save()===settingsBefore);
 l('ggMode-tend').focus();check('focusing another mode leaves automation alone',settings.mode==='off');
 check('mode has current pressed state',l('ggMode-off').getAttribute('aria-pressed')==='true'&&l('ggMode-tend').getAttribute('aria-pressed')==='false');
 check('mode help is the original tooltip',l(l('ggMode-tend').getAttribute('aria-describedby')).textContent===l('ggMode-tend').getAttribute('data-tip'));
 const help=mod._greenhouseAccessibility.help;
 check('description storage creates no extra browse stops',help.hidden&&help.children.length>0);
 const stable=l('ggMode-tend');let nativeClicks=0;stable.addEventListener('click',()=>nativeClicks++);
 key(stable,'Enter');check('Enter reaches native mode handler once',settings.mode==='tend'&&nativeClicks===1);
 check('native selected state is refreshed immediately',stable.getAttribute('aria-pressed')==='true');
 key(l('ggMode-off'),' ');check('Space reaches native mode handler',settings.mode==='off');
 key(stable,'Enter',{repeat:true});key(stable,' ',{ctrlKey:true});
 check('held and modified presses do not change mode',settings.mode==='off'&&nativeClicks===1);
 Game.promptOn=1;key(stable,'Enter');Game.promptOn=0;Game.onMenu='stats';key(stable,'Enter');Game.onMenu='';
 farm.onMinigame=false;key(stable,'Enter');farm.onMinigame=true;
 check('covered or closed panel refuses activation',settings.mode==='off'&&nativeClicks===1);
 key(l('ggTab-settings'),'Enter');
 check('settings opens through native page handler',settings.tab==='settings'&&l('ggTabSettings').style.display!=='none');
 check('opening settings preserves automation mode',settings.mode==='off');
 check('settings control reports its page state',l('ggTab-settings').getAttribute('aria-pressed')==='true');
 check('native settings group headings exist',l('ggTabSettings').querySelectorAll('.ggSubHead[role="heading"][aria-level="5"]').length===4);
 const boxes=[...root.querySelectorAll('.ggSetItem input[type="checkbox"]')];
 check('all six native checkboxes retained',boxes.length===6&&boxes.every(box=>!box.hasAttribute('role')));
 check('each checkbox has original visible help',boxes.every(box=>l(box.getAttribute('aria-describedby'))===box.closest('.ggSetItem').querySelector('.ggSetHelp')));
 const box=l('ggSet-bankNew'),beforeChecked=settings.bankNew;box.click();
 check('native checkbox activation updates its setting once',settings.bankNew===!beforeChecked&&box.checked===settings.bankNew);
 check('checkbox has no duplicate live confirmation',submitted.length===0);
 box.focus();const oldBox=box,oldRoot=root,oldSettings=native.save();
 for(let n=0;n<60;n++){garden.nextStep-=1000;greenhouseFixture.refreshPanel();tick();}
 check('periodic refresh retains checkbox instance and focus',l('ggSet-bankNew')===oldBox&&document.activeElement===oldBox);
 check('periodic refresh leaves preferences unchanged',native.save()===oldSettings);
 check('periodic refresh submits no announcements',submitted.length===0);
 check('countdown and readouts are non-live',!root.querySelector('[aria-live], [role="status"], [role="alert"]'));
 // Layouts use the real library/editor/dialog handlers, with automation Off.
 // Only disposable fixture layouts are edited; no Garden step is executed.
 const layoutStart=native.save();
 const plant={key:'bakerWheat',name:"Baker's wheat",id:0,icon:0,plantable:true,unlocked:true};
 const locked={key:'thumbcorn',name:'Thumbcorn',id:1,icon:1,plantable:true,unlocked:false};
 garden.plants={bakerWheat:plant,thumbcorn:locked};garden.plantsById=[plant,locked];garden.plantsN=2;
 greenhouseFixture.refreshPanel();tick();
 const layouts=l('ggTab-layouts');
 check('Layouts is a keyboard button',layouts.getAttribute('role')==='button'&&layouts.tabIndex===0);
 key(layouts,'Enter');
 check('Layouts opens without changing automation',settings.tab==='layouts'&&settings.mode==='off');
 check('Layouts reports its selected page',layouts.getAttribute('aria-pressed')==='true'&&l('ggTab-settings').getAttribute('aria-pressed')==='false');
 check('all native Layout actions have button roles', [...l('ggTabLayouts').querySelectorAll('[data-act]')].every(el=>el.getAttribute('role')==='button'&&el.tabIndex===0));
 const action=act=>root.querySelector('[data-act="'+act+'"]');
 key(action('libNew'),'Enter');
 check('New reaches the native labelled name field',document.activeElement===l('ggDlgInput')&&!!l(l('ggDlgInput')?.getAttribute('aria-labelledby'))?.textContent);
 const name=l('ggDlgInput');
 if(name){for(const value of [0,1]){FrozenCookies.FCshortcuts=value;for(const letter of 'abcersw'){const e=key(name,letter);check('native Greenhouse name typing remains unprevented '+value+letter,!e.defaultPrevented&&calls.nativeShortcuts===0);}}}
 if(name){name.value='Keyboard layout';key(name,'Enter');}
 check('Enter in a name field creates the native layout',native.getLayouts().some(lay=>lay.name==='Keyboard layout')&&l('ggDialog').style.display==='none');
 check('closing a Layout dialog restores its opener',document.activeElement===action('libNew'));
 let row=action('libSel');
 check('library selection has name and selected state',row?.getAttribute('role')==='button'&&row.getAttribute('aria-pressed')==='true'&&row.textContent.includes('Keyboard layout'));
 const paint=()=>root.querySelector('[data-act="paint"][data-x="0"][data-y="0"]');
 check('paint tiles have row column and native contents',paint()?.getAttribute('aria-label')==='Row 1, column 1, empty');
 check('locked plot tiles remain read only', [...l('ggEditGrid').querySelectorAll('.ggLocked')].every(el=>el.getAttribute('role')!=='button'&&!el.hasAttribute('data-act')));
 let brush=root.querySelector('[data-act="brush"][data-seed="thumbcorn"]');
 check('locked seed is an available planning brush with a name',brush?.getAttribute('role')==='button'&&brush.getAttribute('aria-label')==='Thumbcorn, paint brush'&&!brush.hasAttribute('aria-disabled'));
 if(brush){brush.focus();key(brush,' ');}
 brush=root.querySelector('[data-act="brush"][data-seed="thumbcorn"]');
 check('brush selection retains focus through native palette replacement',document.activeElement===brush&&brush?.getAttribute('aria-pressed')==='true');
 let tile=paint();if(tile){tile.focus();key(tile,'Enter');}
 check('paint uses the editor not the live Garden',native.getEditorLayout()?.grid[0][0]==='thumbcorn'&&calls.plant===0&&calls.harvest===0);
 check('paint replacement restores exact coordinate focus and new label',document.activeElement===paint()&&paint()?.getAttribute('aria-label')==='Row 1, column 1, Thumbcorn (not unlocked yet)');
 const paintHost=paint(),layoutCount=native.getLayouts().length;
 for(let n=0;n<30;n++){greenhouseFixture.refreshPanel();tick();}
 check('unchanged Layout refresh keeps focused tile and data',paint()===paintHost&&document.activeElement===paintHost&&native.getLayouts().length===layoutCount);
 key(action('libRename'),'Enter');
 if(l('ggDlgInput'))l('ggDlgInput').value='Discarded rename';
 key(l('ggDlgInput')||layouts,'Escape');
 check('Escape cancels a Layout name without changing it and restores opener',native.getEditorLayout()?.name==='Keyboard layout'&&document.activeElement===action('libRename'));
 key(action('libRename'),'Enter');
 root.remove();await Promise.resolve();root=greenhouseFixture.buildPanel(l('gardenContent'));greenhouseFixture.refreshPanel();tick();
 check('Layout name field focus survives panel recreation',document.activeElement===l('ggDlgInput'));
 key(l('ggDlgInput'),'Escape');
 check('recreated Layout dialog keeps the correct opener',document.activeElement===action('libRename')&&native.getEditorLayout()?.name==='Keyboard layout');
 key(action('libDelete'),'Enter');
 check('destructive layout confirmation initially focuses Cancel',document.activeElement===action('dlgCancel'));
 key(action('dlgCancel')||layouts,'Escape');
 check('delete cancellation keeps layout and restores Delete',native.getLayouts().length===layoutCount&&document.activeElement===action('libDelete'));
 key(action('libExport'),'Enter');
 check('export keeps native labelled read-only textarea',l('ggDlgText')?.readOnly&&document.activeElement===l('ggDlgText')&&JSON.parse(l('ggDlgText').value)[0].grid[0][0]==='thumbcorn'&&!!l('ggDlgText').getAttribute('aria-labelledby'));
 key(l('ggDlgText')||layouts,'Escape');
 key(action('libImport'),'Enter');
 const text=l('ggDlgText');if(text){text.value='Not JSON';key(text,'Enter');}
 for(const letter of 'abcersw'){const e=key(text,letter,{ctrlKey:true});check('native Greenhouse import editing does not reach FC '+letter,!!e&&e.defaultPrevented===(letter==='s')&&calls.nativeShortcuts===0);}
 check('textarea Enter is not intercepted as submit',l('ggDialog').style.display!=='none'&&l('ggDlgMsg')?.textContent==='');
 key(action('dlgOk')||layouts,'Enter');
 check('invalid import retains native text error and no new layout',l('ggDlgText')?.value==='Not JSON'&&l('ggDlgMsg')?.textContent==='That is not valid JSON.'&&native.getLayouts().length===layoutCount);
 key(l('ggDlgText')||layouts,'Escape');
 const tracked=mod._greenhouseAccessibility?.changed.length||0;
 for(let n=0;n<20;n++){
  const empty=root.querySelector('[data-act="brush"][data-seed="'+(n%2?'':'thumbcorn')+'"]');
  if(empty){empty.focus();key(empty,'Enter');}
 }
 check('retired Layout hosts do not accumulate owned attributes or help',!mod._greenhouseAccessibility||mod._greenhouseAccessibility.changed.length<=tracked+5);
 check('previews are readable without pretending to be paint controls',[...l('ggGrid').querySelectorAll('.ggCell')].every(el=>!!el.getAttribute('aria-label')&&el.getAttribute('role')!=='button'));
 // Restore only synthetic fixture data before the pre-existing reset checks.
 native.load(layoutStart);garden.plants={};garden.plantsById=[];garden.plantsN=0;greenhouseFixture.refreshPanel();tick();submitted.length=0;
 const wipe=l('ggWipeBtn');key(wipe,'Enter');
 const cancel=root.querySelector('[data-act="wipeNo"]');
 check('reset question remains native and focuses safe cancellation',l('ggWipeRow').style.display!=='none'&&document.activeElement===cancel);
 check('reset question describes both choices',l(cancel.getAttribute('aria-describedby'))===l('ggWipeRow').querySelector('.ggAlertText'));
 key(cancel,'Escape');
 check('Escape cancels reset through native handler and returns focus',l('ggWipeRow').style.display==='none'&&document.activeElement===wipe);
 check('reset cancellation preserves all mod data',native.save()===oldSettings);
 key(wipe,'Enter');key(root.querySelector('[data-act="wipeNo"]'),'Enter');
 check('Enter cancellation also restores opener',document.activeElement===wipe&&l('ggWipeRow').style.display==='none');
 const removedPanel=root,removedCheckbox=l('ggSet-bankNew');removedCheckbox.focus();snapshot('before removal');focusPhase='checkbox removal';removedPanel.remove();snapshot('after removal');focusPhase='';await Promise.resolve();snapshot('after microtask');root=greenhouseFixture.buildPanel(l('gardenContent'));greenhouseFixture.refreshPanel();tick();snapshot('after rebuild');
 check('panel recreation restores exact checkbox focus',document.activeElement===l('ggSet-bankNew')&&l('ggSet-bankNew')!==removedCheckbox);
 check('removed root no longer responds to adapted keys',(()=>{const prior=native.save();key(removedPanel.querySelector('#ggMode-tend'),'Enter');return native.save()===prior;})());
 l('outside').focus();tick();check('normal refresh does not steal other focus',document.activeElement===l('outside'));
 // Drive the native readout producer through each branch that removes its help.
 // This is synthetic fixture state, not a gameplay automation step.
 for(const destination of ['off','tend','plant']){
  settings.mode='unlocks';settings.tab='assistant';greenhouseFixture.refreshPanel();tick();
  check('native Unlocks help is attached before '+destination,l(l('ggRecipe').getAttribute('aria-describedby'))?.textContent===native.getHelp('unlocks'));
  settings.mode=destination;greenhouseFixture.refreshPanel();tick();
  check('empty native help clears obsolete description in '+destination,!l('ggRecipe').hasAttribute('aria-describedby'));
 }
 settings.mode='off';settings.tab='settings';greenhouseFixture.refreshPanel();tick();
 for(const action of ['wipeNo','wipeYes']){
  key(l('ggWipeBtn'),'Enter');
  const oldChoice=root.querySelector('[data-act="'+action+'"]');oldChoice.focus();const oldId=oldChoice.id;
  root.remove();await Promise.resolve();root=greenhouseFixture.buildPanel(l('gardenContent'));greenhouseFixture.refreshPanel();tick();
  const newChoice=root.querySelector('[data-act="'+action+'"]');
  check(action+' focus survives reset-confirmation recreation',!!oldId&&newChoice.id===oldId&&document.activeElement===newChoice&&newChoice!==oldChoice);
  // Never activate the destructive choice, including in this empty fixture.
  key(root.querySelector('[data-act="wipeNo"]'),'Escape');
 }
 check('reset recreation and cancellation leave native data untouched',native.save()===oldSettings);
 const blurred=l('ggSet-bankNew');blurred.focus();focusPhase='explicit blur';blurred.blur();focusPhase='';
 // Let a deliberate blur settle before the independent later panel recreation.
 await Promise.resolve();
 root.remove();root=greenhouseFixture.buildPanel(l('gardenContent'));greenhouseFixture.refreshPanel();tick();
 check('deliberate blur relinquishes rebuild focus recovery',document.activeElement===document.body);
 const liveRole=l('ggMode-tend').getAttribute('role');
 const menu=l('menu');Game.onMenu='prefs';mod.enhanceOptionsMenu();mod.enhanceOptionsMenu();
 check('Options has no optional support toggles or empty subsection',!menu.querySelector('#a11yGreenhouseEnabled, #a11yFrozenCookiesEnabled')&&!menu.textContent.includes('Experimental mod support'));
 App.mods['grandpas greenhouse'].disabled=true;tick();
 check('disabled native entry tears down only its accessibility',!mod._greenhouseAccessibility&&l('ggMode-tend').getAttribute('role')===null&&native.save()===oldSettings);
 const beforeAbsence=submitted.length;tick();
 check('disabled native entry is silent',submitted.length===beforeAbsence);
 const withoutAdapter=root.outerHTML;
 check('adapter removal leaves no owned description markup',!withoutAdapter.includes('a11yGreenhouse'));
 App.mods['grandpas greenhouse'].disabled=false;Game.onMenu='';tick();
 mod.load('{"greenhouseAccessibilityEnabled":false,"frozenCookiesAccessibilityEnabled":false}');tick();
 check('native reenable and legacy false automatically restore support',!!mod._greenhouseAccessibility&&l('ggMode-tend').getAttribute('role')===liveRole);
 check('no persisted support settings remain',mod.save()===''&&!('greenhouseAccessibilityEnabled' in mod)&&!('frozenCookiesAccessibilityEnabled' in mod));
 delete Game.mods['grandpas greenhouse'];tick();tick();
 check('absent mod with retained DOM is untouched and silent',!mod._greenhouseAccessibility&&submitted.length===beforeAbsence&&!l('ggMode-tend').hasAttribute('role'));
 Game.mods['grandpas greenhouse']=native;tick();
 const beforeUnsupported=native.save();native.version='9.9';tick();tick();
 check('unknown version refuses adaptation without changing data',mod._greenhouseAccessibility===null&&native.save()===beforeUnsupported);
 check('unsupported-version warning is emitted once',submitted.length===1);
 native.version='1.5';root.remove();root=greenhouseFixture.buildPanel(l('gardenContent'));greenhouseFixture.refreshPanel();tick();
 check('fresh supported panel recovers locally',!!mod._greenhouseAccessibility);
 const oldGetter=native.getSettings;native.getSettings=()=>{throw Error('fixture read failure');};tick();tick();
 check('failing optional API is contained and warned once',mod._greenhouseAccessibility===null&&submitted.length===2);
 native.getSettings=oldGetter;mod._greenhouseFailure=null;tick();
 check('base-game mod object remains usable after optional failure',typeof mod.populateUpgradeLabel==='function'&&!!mod._greenhouseAccessibility);
 mod.clearGreenhouseAccessibility();
 check('readiness and refresh never plant or harvest',calls.plant===0&&calls.harvest===0);
 check('combined native UI typing never triggers FC letters or network',calls.nativeShortcuts===0&&calls.network.length===0);
 result.samples={nativeVersion:native.version,modeName:l('ggMode-tend').textContent,settingsCount:boxes.length,originalPanelBytes:original.length,focusEvents,focusSnapshots};
}catch(error){result.errors.push({message:error.message,stack:error.stack});}
result.errors.push(...fixtureErrors);
l('result').textContent=JSON.stringify(result);
})();
`);
const fixture = path.join(scratch, 'fixture.html');
const profile = path.join(scratch, 'chrome-profile');
fs.writeFileSync(fixture, html);
try {
  const run = cp.spawnSync(chrome, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--disable-background-networking', '--allow-file-access-from-files', '--user-data-dir=' + profile,
    '--dump-dom', 'file:///' + fixture.replaceAll('\\', '/')], { encoding: 'utf8', timeout: 45000, maxBuffer: 4 * 1024 * 1024 });
  fs.writeFileSync(path.join(scratch, 'chrome.stderr.log'), run.stderr || '');
  const match = (run.stdout || '').match(/<pre id="result">([\s\S]*?)<\/pre>/);
  if (!match) throw Error('No browser receipt: ' + (run.error?.message || run.stderr));
  const result = JSON.parse(match[1].replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&'));
  const receipt = { order, mainPath, sourceSha256: sha(source), nativePath, nativeSha256: sha(native),
    frozenPath, frozenSourceSha256: sha(frozenSource), shortcutSpanSha256: sha(frozenShortcuts),
    testSha256: sha(fs.readFileSync(__filename, 'utf8')), chromeExit: run.status, ...result };
  const receiptPath = path.join(scratch, 'browser-results.json');
  fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2));
  const failed = result.checks.filter(check => !check.passed);
  console.log(JSON.stringify({ checked: result.checks.length, failed: failed.map(check => check.name), errors: result.errors,
    chromeExit: run.status, receiptPath }, null, 2));
  if (run.status !== 0 || result.errors.length || result.checks.length === 0 || failed.length) process.exitCode = 1;
} finally {
  fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 150 });
  fs.rmSync(fixture, { force: true });
}
