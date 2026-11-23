const { app, BrowserWindow, Menu, ipcMain, screen, shell } = require('electron');
const path = require('path');

// 알람·타이머 소리가 클릭 없이도 울리도록
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

let win = null;
let normal = null;          // 작은 창으로 바꾸기 전 크기·위치
const MINI = { w: 440, h: 250 };

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 640,
    minHeight: 480,
    frame: false,             // 제목 표시줄 대신 앱 안의 버튼 사용
    title: '우리반 도구함',
    backgroundColor: '#0b1026',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });
  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname, '..', 'www', 'index.html'));
  win.webContents.on('did-finish-load', () => { win.focus(); win.webContents.focus(); });
  // 바깥 주소는 기본 브라우저로
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });

  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11') { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
    if (input.key === 'Escape' && win.isFullScreen()) win.setFullScreen(false);
  });
}

ipcMain.handle('win', (e, cmd) => {
  if (!win) return;
  switch (cmd) {
    case 'min': win.minimize(); break;
    case 'max': win.isMaximized() ? win.unmaximize() : win.maximize(); break;
    case 'close': win.close(); break;

    case 'mini-on': {
      if (win.isFullScreen()) win.setFullScreen(false);
      normal = { bounds: win.getNormalBounds(), max: win.isMaximized() };
      if (normal.max) win.unmaximize();
      const wa = screen.getDisplayMatching(win.getBounds()).workArea;
      win.setMinimumSize(260, 150);
      win.setBounds({ x: wa.x + wa.width - MINI.w - 16, y: wa.y + wa.height - MINI.h - 16, width: MINI.w, height: MINI.h });
      win.setAlwaysOnTop(true, 'screen-saver');   // PPT 슬라이드쇼 위에도 보이게
      break;
    }
    case 'mini-off': {
      win.setAlwaysOnTop(false);
      win.setMinimumSize(640, 480);
      if (normal) {
        win.setBounds(normal.bounds);
        if (normal.max) win.maximize();
      }
      break;
    }
  }
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
