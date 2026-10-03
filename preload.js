/**
 * preload.js — Secure IPC bridge between renderer and main process.
 *
 * Exposes a minimal `window.sudarshan` API to the renderer using
 * contextBridge so the renderer never touches Node APIs directly.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('sudarshan', {
  // ── One-time setup ─────────────────────────────────────────────────────────
  getApiBase: () => ipcRenderer.invoke('get-api-base'),

  // ── Native dialogs ─────────────────────────────────────────────────────────
  pickFolder: () => ipcRenderer.invoke('pick-folder'),
  pickFile:   () => ipcRenderer.invoke('pick-file'),

  // ── Report actions ─────────────────────────────────────────────────────────
  saveReport: (opts) => ipcRenderer.invoke('save-report', opts),
  revealInExplorer: (filePath) => ipcRenderer.invoke('reveal-in-explorer', filePath),

  // ── Backend lifecycle events from main process ─────────────────────────────
  onBackendReady: (cb) => ipcRenderer.on('backend-ready', (_e, data) => cb(data)),
  onBackendError: (cb) => ipcRenderer.on('backend-error', (_e, data) => cb(data)),
});
