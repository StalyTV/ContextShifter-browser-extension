# Code Context - Browser Extension

A browser extension for *Code Context*. Runs with Chromium browsers and Firefox. 

## Development 
1. `npm run watch` to continuously update & build the extension.
2. `npm run firefox` or `npm run chrome` to spin up a (sandboxed) browser.

## Beta Testing
Run `npm install` (first time) and then `npm run build` to build the `dist` folder.

### Chrome
1. Visit [chrome:extensions](chrome:extensions), toggled *Developer mode* (top left), and click `Load Unpacked`. Open the 'dist' folder to install the extension.

### Firefox
Run `npm run package` to create a .zip. The console states where the .zip was created.
In Firefox, you can temporarily install the packaged .zip using [about:debugging#/runtime/this-firefox](about:debugging#/runtime/this-firefox).

## Publishing

### Firefox (outside the addon store)
1. `npm run build`.
2. [Sign](https://extensionworkshop.com/documentation/develop/web-ext-command-reference/#web-ext-sign) the addon. First, set the env variables `$WEB_EXT_API_KEY` and `$WEB_EXT_API_SECRET`, then run `npm run sign`.
3. Locate the `.xpi` archive under `./web-ext-artifacts`. 
4. In Firefox, go to `about:addons` and install the `.xpi` archive.