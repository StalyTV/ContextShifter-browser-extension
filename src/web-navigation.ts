import { TabId, WebNavigationDetail } from "./extension-types"
import browser, { Tabs, WebNavigation } from "webextension-polyfill"
import { sendNavigationCommit, sendSequence } from "./api"
import { getRuntimeInfo } from "./browser-runtime"

// This module is responsible for listening to webNavigation events and sending them to the server
// It also keeps track of navigation sequences. A sequence is a list of consecutively visited web pages 
// that the user visits using "links" or "reload" events. The sequence is terminated when the user
// closes the associated tab or types in a new web address in the browser address bar.

const sequenceMap = new Map<TabId, WebNavigationDetail[]>()

browser.webNavigation.onCommitted.addListener(handleWebNavigationEvent)
browser.webNavigation.onHistoryStateUpdated.addListener(handleWebNavigationEvent)

async function handleWebNavigationEvent(details: WebNavigation.OnHistoryStateUpdatedDetailsType | WebNavigation.OnCommittedDetailsType) {
  // ignore subframes (e.g. iframes)
  if (details.frameId !== 0) { return }

  const tabSequence = sequenceMap.get(details.tabId)
  const doesTabExist = tabSequence !== undefined && tabSequence.length > 0
  const currentTab = await browser.tabs.get(details.tabId)

  const currentItem: WebNavigationDetail = {
    tab: currentTab,
    // @ts-ignore -- transitionType and transitionQualifiers are not defined in the types for some reason
    transitionQualifiers: details.transitionQualifiers,
    // @ts-ignore
    transitionType: details.transitionType,
    ts: new Date(details.timeStamp)
  }

  sendNavigationCommit(currentItem)

  if (isSequenceContinued(currentItem.transitionType)) {
    // CASE 1: new web page is opened in the existing tab by clicking a link
    if (doesTabExist) {
      sequenceMap.set(details.tabId, [...tabSequence, currentItem])
      sendSequenceUpdate(details.tabId)
    }
    // CASE 2: new web page in a new tab is opened by clicking a link of an open web page
    else {
      if (!sequenceMap.has(currentTab.openerTabId || -1)) {
        console.warn(`[code-context] no openerTabId found in new tab ${currentTab.id} (${currentTab.url})`)
        // so far, I have detected 2 cases when this happens:
        // 1. when a new tab is opened by clicking a suggested web page on the firefox default browser newtab window
        // 2. when the extension apis first started and existing web pages are not part of the sequenceMap yet
        console.warn("[code-context] defaulting to create new seq in new tab")
        sequenceMap.set(details.tabId, [currentItem])
        return
      }
      const tabBranchingSequence = sequenceMap.get(currentTab.openerTabId || -1)!
      sequenceMap.set(details.tabId, [...tabBranchingSequence, currentItem])
      sendSequenceUpdate(details.tabId)
    }
  }
  // new sequence
  else {
    // CASE 3: new web page is opened in the existing tab by typing it manually
    // CASE 4: new web page in a new tab is opened by typing the URL into the browser address bar
    sequenceMap.set(details.tabId, [currentItem])
    sendSequenceUpdate(details.tabId)
  }
}

export function closeSequence(tabId: number) {
  if (!sequenceMap.has(tabId)) {
    throw new Error("[code-context] tab is not in navigation sequence")
  }

  sendSequenceUpdate(tabId, true)
  sequenceMap.delete(tabId)
}

export function getLastOpenTab(tabId: number): Tabs.Tab | undefined {
  const seq = sequenceMap.get(tabId)
  if (seq === undefined) {
    return undefined
  }

  return seq[seq.length - 1].tab
}

export function initializeWithOpenTabs() {
  browser.tabs.query({}).then(tabs => {
    tabs.forEach(tab => {
      if (tab.url) {
        sequenceMap.set(tab.id!, [{ tab, transitionQualifiers: [], transitionType: "typed", ts: new Date() }])
      }
    })
  })
}

async function sendSequenceUpdate(tabId: number, isTerminated = false) {
  const sequence = sequenceMap.get(tabId)!
  const runtimeInfo = await getRuntimeInfo()
  sendSequence({ sequence, isTerminated, runtimeInfo })
}

function isSequenceContinued(transitionType: WebNavigation.TransitionType): boolean {
  if (transitionType === "reload" || transitionType === "link") {
    return true
  }

  // "generated" = search in the browser bar
  if (transitionType === "typed" || transitionType === "generated") {
    return false
  }

  console.warn(`[code-context] unmapped transitionType: ${transitionType}`)
  return false
}