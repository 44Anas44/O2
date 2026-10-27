// Intentionally minimal: the app only talks to Supabase over HTTPS/WebSocket,
// so no extra Node/IPC bridge is needed. Add contextBridge.exposeInMainWorld
// calls here if you later need native OS integration (e.g. printing receipts,
// local file export) from the renderer.
