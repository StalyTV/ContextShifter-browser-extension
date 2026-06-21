import browser, { Tabs } from "webextension-polyfill"
import { sendEvent } from "./api"
import { setLastAccessNow, removeTab } from "./last-tab-access"
import { closeSequence, getLastOpenTab } from "./web-navigation"

export async function onUpdated(tabId: number, changeInfo: Tabs.OnUpdatedChangeInfoType, tab: Tabs.Tab) {
  if (changeInfo.status == "loading" && tab.active) {
    sendEvent("tab-switched")
    // calling this *after* sending the tab-switched event because
    // we want to know when it was *last* accessed 
    setLastAccessNow(tabId)
  }
}

// whenever a user navigates from one tab to the other 
export async function onActivated(info: Tabs.OnActivatedActiveInfoType) {
  await sendEvent("tab-switched")
  setLastAccessNow(info.tabId) // calling this *after* sending the tab-switched event
}

export async function onRemoved(tabId: number) {
  const tab = getLastOpenTab(tabId)
  // OTODO: in firefox, no web-navigation event is fired when a blank newtab is opened,
  // so the sequence is not closed and the last tab is undefined. 
  // This leads to the removed blank "newtab" not being removed in the TaskSnap UI.
  removeTab(tabId)
  closeSequence(tabId)
  await sendEvent("tab-removed", tab)
}

export async function closeTabs(tabIds: number[]): Promise<void> {
  await browser.tabs.remove(tabIds)
}