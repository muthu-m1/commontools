'use strict';
const { app, BrowserWindow, Tray, Menu, ipcMain, screen, shell, dialog, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const appbar = require('./appbar');
const { DEFAULTS, mergeState, sanitize, isAllowedUrl, cpuPercent, isLaunchable } = require('./logic');

const DOCK_H = 56;
const MARGIN = 8;
const IS_WIN = process.platform === 'win32';

// Flyout sizes [w, h] per widget.
const FLYOUTS = {
  calendar: [304, 352], weather: [320, 360], pomodoro: [280, 300], timer: [280, 320],
  todos: [320, 420], notes: [320, 320], worldclocks: [300, 260], settings: [400, 560],
};

let store = structuredClone(DEFAULTS);
let dock = null;
let flyout = null;
let flyoutId = null;
let flyoutOpenedAt = 0;
let tray = null;
let contentWidth = 640;
let prevCpus = os.cpus();

if (!app.requestSingleInstanceLock()) app.quit();

// ---------- persistence ----------
const storeFile = () => path.join(app.getPath('userData'), 'lumabar.json');
function loadStore() {
  try { store = sanitize(JSON.parse(fs.readFileSync(storeFile(), 'utf8'))); }
  catch { store = sanitize(null); }
}
let saveTimer = null;
function saveSoon() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fs.mkdir(path.dirname(storeFile()), { recursive: true }, () =>
      fs.writeFile(storeFile(), JSON.stringify(store, null, 2), () => {}));
  }, 300);
}
const broadcast = () => BrowserWindow.getAllWindows().forEach((w) => !w.isDestroyed() && w.webContents.send('state:update', store));

// ---------- look ----------
const BG = { glass: '#00000000', white: '#00000000', midnight: '#0b0f1a', black: '#000000' };
function applyLook(win) {
  if (!win || win.isDestroyed()) return;
  const st = store.settings.style;
  win.setBackgroundColor(BG[st]);
  if (IS_WIN) { try { win.setBackgroundMaterial(st === 'glass' || st === 'white' ? 'acrylic' : 'none'); } catch { /* older Windows */ } }
}

function windowOptions(extra) {
  return {
    frame: false, show: false, resizable: false, maximizable: false, minimizable: false, fullscreenable: false,
    skipTaskbar: true, alwaysOnTop: true, hasShadow: true, roundedCorners: true,
    // Real acrylic blur on Windows 11; plain transparency elsewhere (dev on other platforms).
    transparent: !IS_WIN, backgroundColor: BG[store.settings.style],
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true },
    ...extra,
  };
}

// ---------- dock ----------
function layoutDock() {
  if (!dock || dock.isDestroyed()) return;
  const s = store.settings;
  const d = screen.getPrimaryDisplay();
  const top = s.position === 'top';
  const full = s.width === 'full';
  const stripH = full ? DOCK_H : DOCK_H + MARGIN * 2;

  let strip = { x: d.bounds.x, width: d.bounds.width, height: stripH, y: top ? d.bounds.y : d.bounds.y + d.bounds.height - stripH };
  let granted = null;
  if (s.reserveSpace) granted = appbar.reserve(dock, strip, top ? 'top' : 'bottom', d);
  else appbar.release();
  if (granted) strip = granted;
  else if (!s.reserveSpace || !IS_WIN) {
    // Float over the work area so we do not sit on top of a visible taskbar.
    strip.y = top ? d.workArea.y : d.workArea.y + d.workArea.height - stripH;
  }

  const w = full ? strip.width : Math.min(Math.max(contentWidth + 32, 200), strip.width - MARGIN * 2);
  const x = full ? strip.x : strip.x + Math.round((strip.width - w) / 2);
  const y = full ? strip.y : strip.y + MARGIN;
  dock.setBounds({ x: Math.round(x), y: Math.round(y), width: Math.round(w), height: DOCK_H });
}

function createDock() {
  dock = new BrowserWindow(windowOptions({ width: 640, height: DOCK_H, focusable: true }));
  dock.setAlwaysOnTop(true, 'screen-saver');
  dock.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: false });
  dock.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  dock.once('ready-to-show', () => { applyLook(dock); layoutDock(); dock.showInactive(); });
  dock.on('closed', () => { dock = null; });
}

// ---------- flyout ----------
function closeFlyout() {
  if (flyout && !flyout.isDestroyed()) flyout.close();
  flyout = null; flyoutId = null;
}

function openFlyout(id, anchorX) {
  if (!FLYOUTS[id] || !dock) return;
  if (flyout && flyoutId === id) { closeFlyout(); return; }
  closeFlyout();
  const [w, h] = FLYOUTS[id];
  const db = dock.getBounds();
  const wa = screen.getDisplayMatching(db).workArea;
  const top = store.settings.position === 'top';
  const x = Math.min(Math.max(Math.round(db.x + anchorX - w / 2), wa.x + 8), wa.x + wa.width - w - 8);
  const y = top ? db.y + db.height + 8 : db.y - h - 8;

  flyoutId = id;
  flyoutOpenedAt = Date.now();
  flyout = new BrowserWindow(windowOptions({ width: w, height: h, x, y, focusable: true }));
  flyout.setAlwaysOnTop(true, 'screen-saver');
  flyout.loadFile(path.join(__dirname, 'renderer', 'flyout.html'), { query: { id } });
  flyout.once('ready-to-show', () => { applyLook(flyout); flyout.show(); flyout.focus(); });
  // Close when the user clicks elsewhere (ignore the blur Windows fires while the window is appearing).
  flyout.on('blur', () => { if (Date.now() - flyoutOpenedAt > 400) closeFlyout(); });
  flyout.on('closed', () => { flyout = null; flyoutId = null; });
}

// ---------- tray ----------
function buildTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, 'assets', 'icon.png')).resize({ width: 16, height: 16 });
  tray = new Tray(icon);
  tray.setToolTip('lumabar');
  const set = (settings) => { applyPatch({ settings }); };
  const menu = () => Menu.buildFromTemplate([
    { label: 'Settings…', click: () => openFlyout('settings', dock ? dock.getBounds().width / 2 : 200) },
    { type: 'separator' },
    { label: 'Position', submenu: ['bottom', 'top'].map((p) => ({ label: p === 'top' ? 'Top' : 'Bottom', type: 'radio', checked: store.settings.position === p, click: () => set({ position: p }) })) },
    { label: 'Style', submenu: [['glass', 'Glass'], ['white', 'White'], ['midnight', 'Midnight'], ['black', 'Black']].map(([v, l]) => ({ label: l, type: 'radio', checked: store.settings.style === v, click: () => set({ style: v }) })) },
    { label: 'Full width', type: 'checkbox', checked: store.settings.width === 'full', click: (i) => set({ width: i.checked ? 'full' : 'pill' }) },
    { type: 'separator' },
    { label: 'Quit lumabar', click: () => app.quit() },
  ]);
  tray.on('click', () => tray.popUpContextMenu(menu()));
  tray.on('right-click', () => tray.popUpContextMenu(menu()));
}

// ---------- state ----------
function applyPatch(patch) {
  const before = store.settings;
  store = sanitize(mergeState(store, patch));
  const s = store.settings;
  if (before.position !== s.position || before.width !== s.width || before.reserveSpace !== s.reserveSpace) layoutDock();
  if (before.style !== s.style) { applyLook(dock); applyLook(flyout); }
  if (before.launchAtLogin !== s.launchAtLogin && app.isPackaged) app.setLoginItemSettings({ openAtLogin: s.launchAtLogin });
  saveSoon();
  broadcast();
}

// ---------- IPC ----------
ipcMain.handle('state:get', () => store);
ipcMain.handle('state:set', (_e, patch) => { applyPatch(patch); return store; });

ipcMain.handle('stats:get', () => {
  const next = os.cpus();
  const cpu = cpuPercent(prevCpus, next);
  prevCpus = next;
  const total = os.totalmem(), free = os.freemem();
  let disk = null;
  try {
    const st = fs.statfsSync(IS_WIN ? (process.env.SystemDrive || 'C:') + '\\' : '/');
    disk = { total: st.blocks * st.bsize, free: st.bavail * st.bsize };
  } catch { /* unsupported */ }
  return { cpu, mem: { total, used: total - free }, disk };
});

ipcMain.handle('fetch:json', async (_e, url) => {
  if (!isAllowedUrl(url)) throw new Error('Host not allowed');
  const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'lumabar' }, signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
});

ipcMain.handle('launch', async (_e, target) => {
  if (!isLaunchable(target)) return false;
  if (/^https?:\/\//i.test(target)) { await shell.openExternal(target); return true; }
  return (await shell.openPath(target)) === '';
});

ipcMain.handle('icon:get', async (_e, p) => {
  try { return (await app.getFileIcon(String(p), { size: 'large' })).toDataURL(); } catch { return null; }
});

ipcMain.handle('pick:app', async () => {
  const r = await dialog.showOpenDialog(flyout || dock, {
    title: 'Pin an app', properties: ['openFile'],
    filters: [{ name: 'Apps and shortcuts', extensions: ['exe', 'lnk', 'bat', 'cmd', 'url', 'app'] }, { name: 'All files', extensions: ['*'] }],
  });
  return r.canceled ? null : r.filePaths[0];
});

ipcMain.on('flyout:open', (_e, { id, anchorX }) => openFlyout(String(id), Number(anchorX) || 0));
ipcMain.on('flyout:close', closeFlyout);
ipcMain.on('dock:width', (_e, w) => {
  const n = Math.round(Number(w));
  if (Number.isFinite(n) && Math.abs(n - contentWidth) > 1) { contentWidth = n; layoutDock(); }
});
ipcMain.on('app:quit', () => app.quit());

// ---------- lifecycle ----------
app.whenReady().then(() => {
  loadStore();
  createDock();
  buildTray();
  screen.on('display-metrics-changed', layoutDock);
  screen.on('display-added', layoutDock);
  screen.on('display-removed', layoutDock);
});
app.on('second-instance', () => { if (dock) dock.showInactive(); });
app.on('before-quit', () => { clearTimeout(saveTimer); try { fs.mkdirSync(path.dirname(storeFile()), { recursive: true }); fs.writeFileSync(storeFile(), JSON.stringify(store, null, 2)); } catch { /* ignore */ } appbar.release(); });
app.on('window-all-closed', () => app.quit());
