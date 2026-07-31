# 07 — Image Caching System

**What to build:** Extend the Daily Words image linking feature. When a URL is pasted, a background IPC process downloads the image to the local `userData` folder. The card saves this local path instead of the URL. Also, provide a fallback "Upload File" button using Electron's File Dialog to pick a local file and copy it to the cache directory.

**Blocked by:** 06-new-cards-others

**Status:** ready-for-agent

- [ ] Implement `downloadImage` IPC handler in main process.
- [ ] Implement `openFileDialog` IPC handler for manual uploads.
- [ ] Update Daily Words UI to handle loading states and render the cached image.
- [ ] Store local image path in the database.
