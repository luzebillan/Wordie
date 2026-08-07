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
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
      }
    })
    
    if (!res.ok) {
      return { success: false, error: `Failed to download image. Status code: ${res.status}` }
    }
    
    const contentType = res.headers.get('content-type') || ''
    let ext = '.png'
    if (contentType.includes('jpeg') || contentType.includes('jpg')) ext = '.jpg'
    else if (contentType.includes('gif')) ext = '.gif'
    else if (contentType.includes('webp')) ext = '.webp'

    const uniqueFilename = `img_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`
    const filePath = path.join(getImagesDir(), uniqueFilename)
    
    const arrayBuffer = await res.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    fs.writeFileSync(filePath, buffer)
    
    return { success: true, filename: uniqueFilename }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
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
