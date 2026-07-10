const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const { spawn, exec } = require('child_process');
const net = require('net');

let mainWindow;
let backendProcess = null;
let pythonProcess = null;

// Helper to check if a port is already bound (service is running)
function isPortInUse(port, callback) {
  const server = net.createServer();
  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      callback(true);
    } else {
      callback(false);
    }
  });
  server.once('listening', () => {
    server.close();
    callback(false);
  });
  server.listen(port);
}

// Start Node.js backend
function startBackend() {
  isPortInUse(3001, (inUse) => {
    if (inUse) {
      console.log('Node Backend port 3001 is already in use. Skipping automatic spawn.');
      return;
    }

    const backendDir = app.isPackaged
      ? path.join(process.resourcesPath, 'backend')
      : path.resolve(__dirname, '../backend');

    const startScript = path.join(backendDir, 'src/index.js');

    console.log(`Starting Node backend at: ${startScript}`);

    backendProcess = spawn('node', [startScript], {
      cwd: backendDir,
      env: { ...process.env, PORT: 3001 },
      shell: true
    });

    backendProcess.stdout.on('data', (data) => {
      console.log(`[Backend]: ${data}`);
    });

    backendProcess.stderr.on('data', (data) => {
      console.error(`[Backend Error]: ${data}`);
    });

    backendProcess.on('close', (code) => {
      console.log(`Backend process exited with code ${code}`);
    });
  });
}

// Start Python FastAPI service
function startPythonService() {
  isPortInUse(8000, (inUse) => {
    if (inUse) {
      console.log('Python Service port 8000 is already in use. Skipping automatic spawn.');
      return;
    }

    const pyDir = app.isPackaged
      ? path.join(process.resourcesPath, 'py-service')
      : path.resolve(__dirname, '../py-service');

    const startScript = path.join(pyDir, 'main.py');

    console.log(`Starting Python service at: ${startScript}`);

    let pyCmd = 'python';
    if (process.platform === 'win32') {
      pyCmd = 'py';
    }

    pythonProcess = spawn(pyCmd, [startScript], {
      cwd: pyDir,
      shell: true
    });

    pythonProcess.stdout.on('data', (data) => {
      console.log(`[Python]: ${data}`);
    });

    pythonProcess.stderr.on('data', (data) => {
      console.error(`[Python Error]: ${data}`);
    });

    pythonProcess.on('close', (code) => {
      console.log(`Python process exited with code ${code}`);
    });
  });
}

// Forcefully clean up child processes on Windows/Linux/macOS
function killProcess(proc, name) {
  if (!proc) return;
  console.log(`Cleaning up ${name} process (PID: ${proc.pid})...`);
  if (process.platform === 'win32') {
    exec(`taskkill /pid ${proc.pid} /T /F`, (err) => {
      if (err) {
        console.warn(`Fallback: taskkill failed, using proc.kill(). Error: ${err.message}`);
        proc.kill();
      }
    });
  } else {
    proc.kill();
  }
}

function killBackgroundProcesses() {
  killProcess(backendProcess, 'Node Backend');
  backendProcess = null;
  killProcess(pythonProcess, 'Python Service');
  pythonProcess = null;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    backgroundColor: '#0a0a0f',
    title: 'QuantDesk Terminal',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: path.join(__dirname, 'public/favicon.ico')
  });

  if (app.isPackaged) {
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
  } else {
    mainWindow.loadURL('http://localhost:5173');
  }

  const menuTemplate = [
    {
      label: 'Terminal',
      submenu: [
        { label: 'Reload', role: 'reload' },
        { label: 'Force Reload', role: 'forceReload' },
        { type: 'separator' },
        { label: 'Toggle Developer Tools', role: 'toggleDevTools' },
        { type: 'separator' },
        { label: 'Quit', role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // Start backend services
  startBackend();
  startPythonService();

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  killBackgroundProcesses();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  killBackgroundProcesses();
});
