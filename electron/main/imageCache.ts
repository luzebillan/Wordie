import { app, dialog } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import https from 'node:https'
import http from 'node:http'

export function getImagesDir() {
  const imagesDir = path.join(app.getPath('userData'), 'images')
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true })
  }
  return imagesDir
}

export async function downloadImage(url: string): Promise<{ success: boolean; filename?: string; error?: string }> {
  return new Promise((resolve) => {
    try {
      const isHttps = url.startsWith('https://')
      const client = isHttps ? https : http

      client.get(url, (res) => {
        if (res.statusCode !== 200) {
          resolve({ success: false, error: `Failed to download image. Status code: ${res.statusCode}` })
          return
        }

        const contentType = res.headers['content-type'] || ''
        let ext = '.png'
        if (contentType.includes('jpeg') || contentType.includes('jpg')) ext = '.jpg'
        else if (contentType.includes('gif')) ext = '.gif'
        else if (contentType.includes('webp')) ext = '.webp'

        const uniqueFilename = `img_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`
        const filePath = path.join(getImagesDir(), uniqueFilename)
        const fileStream = fs.createWriteStream(filePath)

        res.pipe(fileStream)

        fileStream.on('finish', () => {
          fileStream.close()
          resolve({ success: true, filename: uniqueFilename })
        })

        fileStream.on('error', (err) => {
          fs.unlink(filePath, () => {})
          resolve({ success: false, error: err.message })
        })
      }).on('error', (err) => {
        resolve({ success: false, error: err.message })
      })
    } catch (err: any) {
      resolve({ success: false, error: err.message })
    }
  })
}

export async function uploadLocalImage(window: Electron.BrowserWindow): Promise<{ success: boolean; filename?: string; error?: string }> {
  try {
    const result = await dialog.showOpenDialog(window, {
      title: 'Select Image',
      properties: ['openFile'],
      filters: [
        { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] }
      ]
    })

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, error: 'User canceled file selection' }
    }

    const sourcePath = result.filePaths[0]
    const ext = path.extname(sourcePath).toLowerCase()
    const uniqueFilename = `img_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`
    const destPath = path.join(getImagesDir(), uniqueFilename)

    fs.copyFileSync(sourcePath, destPath)

    return { success: true, filename: uniqueFilename }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}
