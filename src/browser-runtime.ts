import { RuntimeInfo } from "./extension-types"
import browser, { Runtime } from "webextension-polyfill"
import { initializeLastAccess } from "./last-tab-access"
import { initializeWithOpenTabs } from "./web-navigation"

let installationId = ''

export async function onInstalled(reason: Runtime.OnInstalledDetailsType) {
  console.log('[code-context] initializing extension...')
  // when debugging chrome using `npm run chrome`, the extension is reloaded on every change
  // but this callback is not exectuted, so the following initialization steps are not executed
  // which is fine for debugging (and should not be a problem in production)... but just so we know...
  // for Firefox, this callback is executed on every reload
  initializeWithOpenTabs()
  initializeLastAccess()
  installationId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
}

/** pretty dumb fallback response for all browser other than Firefox  */
async function getBrowserInfo(): Promise<Runtime.BrowserInfo> {
  // Firefox is the only browser that exposes runtime.getBrowserInfo.
  // In MV3 Chrome service workers, chrome.app is undefined, so we can't
  // rely on that as a Firefox/Chromium discriminator anymore.
  // @ts-ignore
  if (typeof browser.runtime.getBrowserInfo === 'function') {
    return await browser.runtime.getBrowserInfo()
  }
  // OTODO: distinguish Edge / Safari / Chrome properly if needed
  return { name: 'Chrome', vendor: 'Google', version: '0.0.0', buildID: '0' }
}

export async function getRuntimeInfo(): Promise<RuntimeInfo> {
  const extensionId = browser.runtime.id
  const browserInfo = await getBrowserInfo()
  return { browserInfo, extensionId, installationId }
}