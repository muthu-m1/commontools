'use strict';
/**
 * Registers the dock as a Windows "AppBar" so maximised windows stop above it,
 * exactly like the taskbar does. Uses koffi to call SHAppBarMessage.
 *
 * Everything here is best-effort: on any failure (not Windows, koffi missing,
 * API error) reserve() returns null and the dock simply floats over the work area.
 */
const { screen } = require('electron');

const ABM_NEW = 0, ABM_REMOVE = 1, ABM_QUERYPOS = 2, ABM_SETPOS = 3;
const ABE = { left: 0, top: 1, right: 2, bottom: 3 };

let api = null;
let registeredHwnd = null;

function load() {
  if (api !== null) return api;
  api = false;
  if (process.platform !== 'win32') return api;
  try {
    const koffi = require('koffi');
    const RECT = koffi.struct('RECT', { left: 'int32', top: 'int32', right: 'int32', bottom: 'int32' });
    const APPBARDATA = koffi.struct('APPBARDATA', {
      cbSize: 'uint32',
      hWnd: 'uintptr_t',
      uCallbackMessage: 'uint32',
      uEdge: 'uint32',
      rc: RECT,
      lParam: 'intptr_t',
    });
    const shell32 = koffi.load('shell32.dll');
    const call = shell32.func('uintptr_t __stdcall SHAppBarMessage(uint32 dwMessage, _Inout_ APPBARDATA *pData)');
    api = { call, size: koffi.sizeof(APPBARDATA) };
  } catch (err) {
    console.warn('[lumabar] appbar unavailable:', err.message);
  }
  return api;
}

function hwndOf(win) {
  const buf = win.getNativeWindowHandle();
  return buf.length >= 8 ? buf.readBigUInt64LE(0) : BigInt(buf.readUInt32LE(0));
}

function msg(message, data) {
  const a = load();
  data.cbSize = a.size;
  return a.call(message, data);
}

/**
 * Reserve `strip` (a DIP rectangle on the given display) along `edge`.
 * Returns the rectangle Windows actually granted (DIP), or null if unsupported.
 */
function reserve(win, strip, edge, display) {
  if (!load()) return null;
  try {
    const hWnd = hwndOf(win);
    if (registeredHwnd !== hWnd) {
      if (registeredHwnd !== null) msg(ABM_REMOVE, { hWnd: registeredHwnd, uCallbackMessage: 0, uEdge: 0, rc: { left: 0, top: 0, right: 0, bottom: 0 }, lParam: 0 });
      msg(ABM_NEW, { hWnd, uCallbackMessage: 0, uEdge: ABE[edge], rc: { left: 0, top: 0, right: 0, bottom: 0 }, lParam: 0 });
      registeredHwnd = hWnd;
    }
    // SHAppBarMessage works in physical pixels.
    const px = screen.dipToScreenRect(null, {
      x: Math.round(strip.x), y: Math.round(strip.y),
      width: Math.round(strip.width), height: Math.round(strip.height),
    });
    const data = {
      hWnd, uCallbackMessage: 0, uEdge: ABE[edge], lParam: 0,
      rc: { left: px.x, top: px.y, right: px.x + px.width, bottom: px.y + px.height },
    };
    msg(ABM_QUERYPOS, data);
    // QUERYPOS may have moved the edge to avoid other appbars (e.g. a visible taskbar).
    // Re-assert our thickness against the edge it settled on.
    const thickness = px.height;
    if (edge === 'top') data.rc.bottom = data.rc.top + thickness;
    else data.rc.top = data.rc.bottom - thickness;
    msg(ABM_SETPOS, data);
    const dip = screen.screenToDipRect(null, {
      x: data.rc.left, y: data.rc.top,
      width: data.rc.right - data.rc.left, height: data.rc.bottom - data.rc.top,
    });
    return dip;
  } catch (err) {
    console.warn('[lumabar] appbar reserve failed:', err.message);
    return null;
  }
}

function release() {
  if (!api || registeredHwnd === null) return;
  try {
    msg(ABM_REMOVE, { hWnd: registeredHwnd, uCallbackMessage: 0, uEdge: 0, rc: { left: 0, top: 0, right: 0, bottom: 0 }, lParam: 0 });
  } catch { /* ignore */ }
  registeredHwnd = null;
}

module.exports = { reserve, release };
