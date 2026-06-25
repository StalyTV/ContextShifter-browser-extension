import { CloseTabClientRequest, OpenTabClientRequest } from "./extension-types"
import browser from "webextension-polyfill"
import { closeTabs } from "./browser-tab"

import { closeWindow, getCurrentWindow, getWindowById, getWindows } from "./browser-window"
import { sendEvent } from "./api"

let openTabsInNewWin = false

export async function handleOpenWebpages({ urls }: OpenTabClientRequest) {
  console.log('[code-context] opening tabs', urls)
  const currentWindow = await getCurrentWindow()

  if (!currentWindow || openTabsInNewWin) {
    // create a new window with the requested tabs (ungrouped)
    await browser.windows.create({ url: urls })
    return
  }

  // we have an existing window and open the tabs there
  const tabs = currentWindow!.tabs || []
  const alreadyOpenedTabs = tabs.filter(tab => urls.includes(tab.url || ''))
  const remainingUrlsToOpen = urls.filter(url => !alreadyOpenedTabs.map(tab => tab.url).includes(url))

  const tabIds = alreadyOpenedTabs.map(tab => tab.id!)

  // open remaining urls as standalone tabs
  for (const url of remainingUrlsToOpen) {
    const tab = await browser.tabs.create({ url, windowId: currentWindow!.id })
    tabIds.push(tab.id!)
  }

  // move the task's tabs to the front and focus the last one — but do NOT
  // group them, so they appear as individual tabs.
  const activeTabId = tabIds[tabIds.length - 1]
  browser.tabs.move(tabIds, { index: -1 })
  if (activeTabId != null) browser.tabs.update(activeTabId, { active: true })
}

export async function handleCloseTabs(closeRequests: CloseTabClientRequest[]) {
  // First collect every tab that should be closed (deduped by id) across all
  // requests. We then remove them batched *per tab group* rather than one at a
  // time. Closing a group's tabs in a single call lets Chrome's "Saved tab
  // groups" keep the group instead of deleting it — removing grouped tabs
  // individually empties the group tab-by-tab and Chrome drops it. Tabs that
  // aren't part of a group are closed together as before.
  const tabsById = new Map<number, any>()

  for (const req of closeRequests) {
    console.log('[code-context] closing tab', req)
    let windows = []
    if (req.windowId) {
      const window = await getWindowById(req.windowId)
      if (!window) {
        console.error(`[code-context] window with id [${req.windowId}] does not exist`)
        continue
      }
      windows = [window]
    } else {
      windows = await getWindows()
    }

    for (const window of windows) {
      const matches = (window.tabs ?? []).filter(tab =>
        req.tabId
          ? tab.id === req.tabId && tab.url === req.url
          : tab.url === req.url
      )
      for (const tab of matches) {
        if (tab.id != null) tabsById.set(tab.id, tab)
      }
    }
  }

  // Partition into ungrouped tabs and per-group buckets. `groupId` is -1 (or
  // undefined) for tabs that don't belong to a group.
  const ungrouped: number[] = []
  const byGroup = new Map<number, number[]>()
  for (const tab of tabsById.values()) {
    const groupId: number | undefined = tab.groupId
    if (typeof groupId === 'number' && groupId >= 0) {
      const ids = byGroup.get(groupId) ?? []
      ids.push(tab.id)
      byGroup.set(groupId, ids)
    } else {
      ungrouped.push(tab.id)
    }
  }

  if (ungrouped.length > 0) {
    await closeTabs(ungrouped)
  }
  // Grouped tabs: "close the group itself" by collapsing it, rather than
  // removing its tabs. Removing a group's tabs (even all in one call) deletes
  // the group — Chrome only keeps it if it's a *saved* group, which an
  // extension cannot control. Collapsing tucks the group away (its tabs are
  // closed out of view) while guaranteeing the group persists and can be
  // reopened. We collapse the group first; its tabs go with it.
  const chromeApi: any = (globalThis as any).chrome
  for (const groupId of byGroup.keys()) {
    try {
      if (chromeApi?.tabGroups?.update) {
        await chromeApi.tabGroups.update(groupId, { collapsed: true })
      } else {
        // No tabGroups API available — fall back to closing the tabs.
        await closeTabs(byGroup.get(groupId) ?? [])
      }
    } catch (e) {
      console.error('[code-context] failed to collapse group', groupId, e)
    }
  }

  // if we closed the last tab in a window, close the window
  const windows = await getWindows()
  for (const window of windows) {
    if (window.tabs!.length === 0) {
      await closeWindow(window.id!)
    }
  }

  // tab closing is done, send event to the client
  // this triggers the update in the TaskSnap UI
  return await sendEvent("window-unfocus")
}
