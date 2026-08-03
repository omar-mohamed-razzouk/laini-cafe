const { app, BrowserWindow, shell, Menu } = require("electron");
const path = require("path");

const APP_URL = "https://ziyad-deskcafe.com";

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#1a120b",
    icon: path.join(__dirname, "build", "icon.ico"),
    title: "BrewDesk",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  Menu.setApplicationMenu(null);

  mainWindow.once("ready-to-show", () => {
    mainWindow.maximize();
    mainWindow.show();
  });

  // Always load the live site so the app is permanently up to date.
  mainWindow.loadURL(APP_URL);

  // Open external links (other origins / target=_blank) in the system browser.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  // When the live site can't be reached (offline), fall back to a local page
  // that auto-reconnects as soon as the internet returns.
  mainWindow.webContents.on(
    "did-fail-load",
    (_event, errorCode, _desc, _url, isMainFrame) => {
      // -3 == ERR_ABORTED (normal during redirects); ignore it.
      if (isMainFrame && errorCode !== -3) {
        mainWindow.loadFile(path.join(__dirname, "offline.html"));
      }
    },
  );

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
