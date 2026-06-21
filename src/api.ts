import { BrowserEvent, BrowserEventType, ClientEndpoints, ServerEndpoints, WebNavigationDetail, WebNavigationSequenceUpdate } from "./extension-types"
import { Tabs, Windows } from "webextension-polyfill"
import { getRuntimeInfo } from "./browser-runtime"
import { handleCloseTabs, handleOpenWebpages } from "./request-handlers"
import { getWindows } from "./browser-window"
import { getLastAccess } from "./last-tab-access"

const websockets: Map<string, WebSocket> = new Map([
  ["ws://localhost:8084/", new WebSocket("ws://localhost:8084/")],
])

const reconnectIntervals: Map<string, NodeJS.Timeout | null> = new Map();

websockets.forEach((socket) => {
  reconnectIntervals.set(socket.url, null)
  attachEventListeners(socket)
})

function attachEventListeners(websocket: WebSocket) {
  websocket.addEventListener("error", onerror)
  websocket.addEventListener("open", onopen)
  websocket.addEventListener("message", onmessage)
  websocket.addEventListener("close", onclose)
}

function clearReconnectInterval(websocket: WebSocket) {
  const handle = reconnectIntervals.get(websocket.url);
  if (handle) {
    clearInterval(handle)
  }
}

function onerror(this: WebSocket, evt: Event) {
  console.warn(`[code-context] ws error for socket "${this.url}"`, evt)
}

function onopen(this: WebSocket) {
  console.info(`[code-context] ws opened socket "${this.url}"`)
  clearReconnectInterval(this)
  sendEvent('ws-connected')
}

function onmessage(event: any) {
  const data = JSON.parse(event.data)
  if (data.endpoint === ClientEndpoints.closeTabs) {
    handleCloseTabs(data.data)
  } else if (data.endpoint === ClientEndpoints.openTabs) {
    handleOpenWebpages(data.data)
  }
}

function onclose(this: WebSocket) {
  console.info(`[code-context] ws closed socket "${this.url}"`)
  reconnect(this)
}

function reconnect(websocket: WebSocket) {
  clearReconnectInterval(websocket)

  let handle = setInterval(() => {
    console.info(`[code-context] reconnecting socket "${websocket.url}"...`)

    // make sure we don't have dangeling connection attempts
    websocket.close()

    // reconnect
    const newWebsocket = new WebSocket(websocket.url)
    websockets.set(newWebsocket.url, newWebsocket);

    // attach new event listeners, without them
    // the events will be lost
    attachEventListeners(newWebsocket)
  }, 3000)
  reconnectIntervals.set(websocket.url, handle)
}

export async function sendEvent(type: BrowserEventType, removedTab?: Tabs.Tab) {
  let windows = await getWindows()
  const runtimeInfo = await getRuntimeInfo()
  const data: BrowserEvent = { type, windows, runtimeInfo }

  if (type === 'tab-removed') {
    // after a tab is removed, it is still listed under `window.tabs`
    // when `browser.windows.getAll()` is called as part of the subsequent
    // `tab-switched` event.
    // As a hack, we filter the `removedTab` manually from all `windows` 
    cleanupRemovedTabFn = setCleanupFuncForASecond(removedTab!)
    data.removedTab = removedTab
  }

  if (cleanupRemovedTabFn) {
    windows = cleanupRemovedTabFn(windows)
  }

  for (const window of windows) {
    for (const tab of window.tabs!) {
      // Attention: overwriting Firefox default implementation
      // for the active tab, this property reflects the previous time the tab was accessed
      tab.lastAccessed = getLastAccess(tab)
    }
  }

  sendData(data, ServerEndpoints.event)
}

let cleanupRemovedTabFn: (windows: Windows.Window[]) => Windows.Window[]

function setCleanupFuncForASecond(removedTab: Tabs.Tab) {
  console.log("[code-context] setting cleanup func for 1s")
  let isWithinTimeout = true
  setTimeout(() => { isWithinTimeout = false }, 1000)

  return function (windows: Windows.Window[]): Windows.Window[] {
    if (!isWithinTimeout) { return windows }
    console.log(`[code-context] filter removed tab ${removedTab.id} in window ${removedTab.windowId} (${removedTab.url})}`)
    windows.forEach(w => {
      if (w.id === removedTab!.windowId) {
        w.tabs = w.tabs!.filter(t => t.id !== removedTab!.id)
      }
    })
    return windows
  }
}

export async function sendSequence(data: WebNavigationSequenceUpdate) {
  sendData(data, ServerEndpoints.sequence)
}

export async function sendNavigationCommit(data: WebNavigationDetail) {
  sendData(data, ServerEndpoints.navigation)
}

// The browser will throw an exception if you call send() when the
// connection is in the CONNECTING state. If you call send() when the
// connection is in the CLOSING or CLOSED states, the browser
// will silently discard the data. 
function sendData(data: unknown, endpoint: ServerEndpoints) {
  console.log(`[code-context] sending data to server for endpoint "${endpoint}"`)
  websockets.forEach((websocket) => {
    if (websocket.readyState === websocket.CLOSED || websocket.readyState === websocket.CLOSING) {
      // OTODO: how to handle this?
      return console.warn(`[code-context] tried to send data, but ws "${websocket.url}" not connected`)
    }
  
    websocket.send(JSON.stringify({ data, endpoint }))
  })
}