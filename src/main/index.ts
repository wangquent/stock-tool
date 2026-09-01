import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import {
  getDailyKline,
  getIntraday,
  getQuote,
  getQuotes,
  searchStocks
} from './services/eastmoney'
import { addToWatchlist, getWatchlist, removeFromWatchlist } from './services/watchlist'
import type { StockIdentity } from '../shared/types'

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0f1419',
    title: '行情工具',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function registerIpc(): void {
  ipcMain.handle('search-stocks', async (_event, keyword: string) => {
    return searchStocks(String(keyword ?? ''))
  })
  ipcMain.handle('get-quote', async (_event, secid: string) => {
    return getQuote(secid)
  })
  ipcMain.handle('get-quotes', async (_event, secids: string[]) => {
    return getQuotes(secids)
  })
  ipcMain.handle('get-daily-kline', async (_event, secid: string) => {
    return getDailyKline(secid)
  })
  ipcMain.handle('get-intraday', async (_event, secid: string) => {
    return getIntraday(secid)
  })
  ipcMain.handle('watchlist-get', async () => {
    return getWatchlist()
  })
  ipcMain.handle('watchlist-add', async (_event, stock: StockIdentity) => {
    return addToWatchlist(stock)
  })
  ipcMain.handle('watchlist-remove', async (_event, secid: string) => {
    return removeFromWatchlist(secid)
  })
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.stocktool.app')
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })
  registerIpc()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
