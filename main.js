// Modules to control application life and create native browser window
const { app, BrowserWindow, session, BrowserView, ipcMain, net } = require('electron')
const path = require('path');
const { updateBrowserView } = require('./proxy')

const { initProxy } = require('./proxy');
let proxySession;
let browserView;
let mainWindow;
const httpPort = 12345;
async function createWindow () {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  });
  // Open the DevTools.
  // mainWindow.webContents.openDevTools()

  mainWindow.loadFile('index.html');

  await initProxy();

  proxySession = session.fromPartition('persist:beyondCorp', { cache: false });
  await proxySession.setProxy({
    mode: 'pac_script',
    pacScript: `http://127.0.0.1:${httpPort}/proxy.pac`,
  });
  browserView = new BrowserView({
    webPreferences: {
      session: proxySession,
    }
  });
  mainWindow.addBrowserView(browserView);

  browserView.webContents.on(
      'certificate-error',
      (event, url, error, cert, callback) => {
        callback(true);
      }
  );
  browserView.webContents.session.setCertificateVerifyProc(
      (request, callback) => {
        callback(0);
      }
  );
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

ipcMain.on("send_once",(_,url) => {
  const req = net.request({
    url: url,
    // credentials: 'include',
    session: proxySession,
  });
  req.on('response', response => {
    console.log(
        '[beyondCorp]' +
        `keepOktaAlive 2nd request ${response.statusCode}`
    );
    let body = [];
    response.on('data', function (chunk) {
      body.push(chunk);
    });
    response.on('end', function () {
      body = Buffer.concat(body).toString();
      console.log("res from proxied server:", body);
      mainWindow.webContents.send("send_once_callback", JSON.stringify({
        statusCode: response.statusCode,
        headers: response.headers,
        body: body
      }));
    });
  });
  req.on('error', error => {
    console.error('keepOktaAlive 2nd request error', error);
    mainWindow.webContents.send("send_once_callback", JSON.stringify(error));
  });
  req.end();
});

ipcMain.on('muti_send', async (_, url, count) => {
  let success = 0;
  let fail = 0;
  for (let i = 0; i < count; i++) {
    await new Promise( (resolve) => {
      const req = net.request({
        url: url,
        session: proxySession,
      });
      req.on('response', async response => {
        console.log(
            '[beyondCorp]' +
            `keepOktaAlive 2nd request ${response.statusCode}`
        );
        if(response.statusCode === 200) {
          await new Promise((resolve) => {
            let body = [];
            response.on('data', function (chunk) {
              body.push(chunk);
            });
            response.on('end', function () {
              body = Buffer.concat(body).toString();
              console.log("res from proxied server:", body);
              if(body.includes("https proxy error")){
                fail++;
              }else {
                success++;
              }
              resolve();
            });
          });
        }else {
          fail++;
        }
        resolve();
      });
      req.on('error', error => {
        console.error('keepOktaAlive 2nd request error', error);
        fail++;
        resolve();
      });
      req.end();
    });
  }

  mainWindow.webContents.send("mutiSend_callback", JSON.stringify({
    success,
    fail,
    rate: success/count
  }));
});