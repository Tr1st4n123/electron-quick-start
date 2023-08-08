/**
 * The preload script runs before. It has access to web APIs
 * as well as Electron's renderer process modules and some
 * polyfilled Node.js functions.
 *
 * https://www.electronjs.org/docs/latest/tutorial/sandbox
 */
window.addEventListener('DOMContentLoaded', () => {
  const replaceText = (selector, text) => {
    const element = document.getElementById(selector)
    if (element) element.innerText = text
  }

  for (const type of ['chrome', 'node', 'electron']) {
    replaceText(`${type}-version`, process.versions[type])
  }
});

const dispatcher = (event, detail) => {
  if (!event) {
    return;
  }
  window.dispatchEvent(new CustomEvent(event, { detail }));
};

const electron = require('electron');
const { ipcRenderer, contextBridge } = electron;
contextBridge.exposeInMainWorld('API', {
  // API register
  sendOnce: (url) => ipcRenderer.send("send_once",url),
  mutiSend: (url, count) => ipcRenderer.send("muti_send",url, count),
});

ipcRenderer.on('send_once_callback', (event, data) => {
  dispatcher('send_once_callback', data);
});

ipcRenderer.on("mutiSend_callback", (event, data) => {
  dispatcher('mutiSend_callback', data);
});
