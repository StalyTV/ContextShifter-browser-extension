import { Tabs } from "webextension-polyfill"
import { getWindows } from "./browser-window"

type tabId = number
type lastAccess = number // timestamp in ms

const lastAccessMap = new Map<tabId, lastAccess>()

export async function initializeLastAccess() {
  for (const window of await getWindows()) {
    for (const tab of window.tabs!) {
      lastAccessMap.set(tab.id!, tab.lastAccessed || new Date().getTime())
    }
  }
}

export function getLastAccess(tab: Tabs.Tab): lastAccess {
  if (!lastAccessMap.has(tab.id!)) {
    if (tab.lastAccessed) {
      // this property is only available in Firefox
      lastAccessMap.set(tab.id!, tab.lastAccessed)
    } else {
      console.warn(`[code-context] last access date not available for tab id ${tab.id}, initializing with current time...`)
    }
    return new Date().getTime()
  }

  return lastAccessMap.get(tab.id!)!
}

export function setLastAccessNow(tabId: tabId) {
  console.log(`[code-context] setting last access for tab ${tabId} to ${new Date().getTime()}`)
  lastAccessMap.set(tabId, new Date().getTime())
}

export function removeTab(tabId: tabId) {
  lastAccessMap.delete(tabId)
}