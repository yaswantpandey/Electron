/**
 * main.js — Electron main process for Sudarshan AI
 *
 * Responsibilities:
 *  1. Spawn the Flask API server (api_server.py) as a child process
 *  2. Wait until Flask is ready (poll /api/health)
 *  3. Create the BrowserWindow and load renderer/index.html
 *  4. Handle IPC messages from the renderer (open file dialogs, etc.)
 *  5. Clean up the Flask process on quit
 */

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path   = require('path');
const { spawn, execFile } = require('child_process');
const http   = require('http');
const fs     = require('fs');

// ── Config ────────────────────────────────────────────────────────────────────
const API_PORT    = 5174;
const API_BASE    = `http://127.0.0.1:${API_PORT}`;
const HEALTH_URL  = `${API_BASE}/api/health`;
const PROJECT_DIR = __dirname;

// ── State ─────────────────────────────────────────────────────────────────────
let flaskProcess = null;
let mainWindow   = null;
let flaskReady   = false;

// ── Find the right Python executable ─────────────────────────────────────────
function findPython() {
  // Prefer the project venv, then system python3 / python
  const venvCandidates = [
    path.join(PROJECT_DIR, 'venvv', 'bin', 'python'),
    path.join(PROJECT_DIR, 'venv', 'bin', 'python'),
    path.join(PROJECT_DIR, 'venvv', 'Scripts', 'python.exe'),
    path.join(PROJECT_DIR, 'venv', 'Scripts', 'python.exe'),
  ];
  for (const p of venvCandidates) {
    if (fs.existsSync(p)) return p;
  }
  // Fall back to system python
  return process.platform === 'win32' ? 'python' : 'python3';
}

// ── Launch Flask ──────────────────────────────────────────────────────────────
function startFlask() {
  const python    = findPython();
  const serverScript = path.join(PROJECT_DIR, 'api_server.py');

  console.log(`[main] Spawning Flask: ${python} ${serverScript}`);

  flaskProcess = spawn(python, [serverScript], {
    cwd: PROJECT_DIR,
    env: { ...process.env, SUDARSHAN_PORT: String(API_PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  flaskProcess.stdout.on('data', d => console.log('[flask]', d.toString().trim()));
  flaskProcess.stderr.on('data', d => console.error('[flask:err]', d.toString().trim()));

  flaskProcess.on('exit', (code, signal) => {
    console.log(`[main] Flask exited  code=${code}  signal=${signal}`);
    flaskReady = false;
  });

  flaskProcess.on('error', err => {
    console.error('[main] Failed to spawn Flask:', err.message);
    dialog.showErrorBox(
      'Python not found',
      `Could not start the backend server.\n\nMake sure Python is installed and api_server.py dependencies are installed.\n\nError: ${err.message}`
    );
  });
}

// ── Poll until Flask responds on /api/health ──────────────────────────────────
function waitForFlask(retries = 30, intervalMs = 500) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const check = () => {
      http.get(HEALTH_URL, res => {
        if (res.statusCode === 200) {
          flaskReady = true;
          console.log('[main] Flask is ready');
          resolve();
        } else {
          retry();
        }
      }).on('error', () => retry());
    };
    const retry = () => {
      attempts++;
      if (attempts >= retries) {
        reject(new Error(`Flask did not start after ${retries} attempts`));
      } else {
        setTimeout(check, intervalMs);
      }
    };
    check();
  });
}

// ── Create the browser window ─────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width:           1280,
    height:          820,
    minWidth:        800,
    minHeight:       600,
    backgroundColor: '#14171A',
    titleBarStyle:   'hiddenInset',   // macOS; ignored on Windows/Linux
    frame:           true,
    webPreferences: {
      preload:            path.join(PROJECT_DIR, 'preload.js'),
      contextIsolation:   true,
      nodeIntegration:    false,
      sandbox:            false,        // preload needs fs access
      webSecurity:        true,
    },
    icon: path.join(PROJECT_DIR, 'renderer', 'icon.png'),
    title: 'Sudarshan AI',
  });

  mainWindow.loadFile(path.join(PROJECT_DIR, 'renderer', 'index.html'));

  // Open DevTools in dev mode
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ── IPC handlers (called from renderer via preload) ───────────────────────────

// Pass the API base URL to the renderer so it always knows the right port
ipcMain.handle('get-api-base', () => API_BASE);

// Open a native folder-picker dialog (for codebase mode)
ipcMain.handle('pick-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select project folder to scan',
  });
  return result.canceled ? null : result.filePaths[0];
});

// Open a file-picker for custom wordlists
ipcMain.handle('pick-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    title: 'Select wordlist file',
    filters: [{ name: 'Text files', extensions: ['txt', 'lst'] }, { name: 'All files', extensions: ['*'] }],
  });
  return result.canceled ? null : result.filePaths[0];
});

// Save the Markdown report to a chosen location
ipcMain.handle('save-report', async (_event, { defaultName, content }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title:       'Save report',
    defaultPath: defaultName || 'sudarshan_report.md',
    filters:     [{ name: 'Markdown', extensions: ['md'] }, { name: 'All files', extensions: ['*'] }],
  });
  if (result.canceled || !result.filePath) return { ok: false };
  try {
    fs.writeFileSync(result.filePath, content, 'utf8');
    return { ok: true, path: result.filePath };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// Open a file path in the OS file manager
ipcMain.handle('reveal-in-explorer', (_event, filePath) => {
  shell.showItemInFolder(filePath);
});

// ── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  // Start Flask first
  startFlask();

  // Show the window immediately with a loading state — renderer will poll
  createWindow();

  // Keep trying to contact Flask; renderer receives events via polling
  try {
    await waitForFlask(40, 500);
    // Notify renderer that backend is ready
    if (mainWindow) {
      mainWindow.webContents.send('backend-ready', { apiBase: API_BASE });
    }
  } catch (err) {
    console.error('[main] Flask never became ready:', err.message);
    if (mainWindow) {
      mainWindow.webContents.send('backend-error', { message: err.message });
    }
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});

app.on('before-quit', () => {
  if (flaskProcess) {
    console.log('[main] Killing Flask process …');
    flaskProcess.kill();
  }
});
