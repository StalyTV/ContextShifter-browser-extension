import browser from "webextension-polyfill"
import { onBoundsChanged, onFocusChanged } from "./browser-window"
import { onActivated, onRemoved, onUpdated } from "./browser-tab"
import { onInstalled } from "./browser-runtime"

browser.runtime.onInstalled.addListener(onInstalled)
browser.tabs.onRemoved.addListener(onRemoved)
browser.tabs.onActivated.addListener(onActivated)
browser.tabs.onUpdated.addListener(onUpdated)
browser.windows.onFocusChanged.addListener(onFocusChanged)

// @ts-ignore - this is a chrome-only API
if (typeof browser.windows.onBoundsChanged === 'function') {
  console.log("[code-context] browser.windows.onBoundsChanged exists")
  // @ts-ignore
  browser.windows.onBoundsChanged.addListener(onBoundsChanged)
}