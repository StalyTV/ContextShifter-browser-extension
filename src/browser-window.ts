import browser from "webextension-polyfill"
import { sendEvent } from "./api"
import { setLastAccessNow } from "./last-tab-access"

export async function onFocusChanged(windowId: number) {
  if (windowId === browser.windows.WINDOW_ID_NONE) {
    return await sendEvent("window-unfocus")
  }
  await sendEvent("window-focus")

  // calling setLastAccessNow *after* sending the window-focus event because
  // we want to know when it was *last* accessed 
  const w = await getCurrentWindow()
  if (w) {
    const t = w.tabs?.find(t => t.active)
    if (t) { setLastAccessNow(t.id!) }
  }
}

export async function onBoundsChanged() {
  await sendEvent("window-resized")
}

export async function getWindows(): Promise<browser.Windows.Window[]> {
  return await browser.windows.getAll({ populate: true })
}

export async function getWindowById(windowId: number): Promise<browser.Windows.Window | undefined> {
  try {
    // populate: true will return the tabs in the window
    return await browser.windows.get(windowId, { populate: true })
  } catch (error) {
    console.warn(`[code-context] could not get window "${windowId}" browser window does not exist`, error)
    return undefined
  }
}

export async function getCurrentWindow(): Promise<browser.Windows.Window | undefined> {
  try {
    // populate: true will return the tabs in the window
    return await browser.windows.getCurrent({ populate: true })
  } catch (error) {
    console.warn("[code-context] current browser window does not exist", error)
    return undefined
  }
}

export async function closeWindow(windowId: number): Promise<void> {
  try {
    await browser.windows.remove(windowId)
  } catch (err) {
    console.warn(`[code-context] could not close window "${windowId}"`, err)
  }
}