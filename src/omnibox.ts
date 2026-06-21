// import browser from "webextension-polyfill"
// import { getSuggestions } from "./api"

// let latestInputText = ""
// let suggestionsMap = new Map<string, string[]>()

// export default function initOmnibox() {

//   // This event is fired each time the user updates the text in the omnibox,
//   // as long as the extension's keyword mode is still active.
//   browser.omnibox.onInputChanged.addListener(async function (text, suggest) {
//     latestInputText = text
//     // only show suggestions if the text is long enough
//     if (text.length < 3) return
//     // fetch from the backend
//     const res = await getSuggestions(text)

//     // maybe the user has already typed something else while the suggestions were loading
//     if (res && latestInputText === res.query) {
//       const suggestions = res.suggestions.map(s => {
//         const content = `${s.title} - ${getNaiveLeftPaddedDate(new Date(s.ts))}`
//         suggestionsMap.set(content, s.urls)
//         return {
//           content,
//           description: ""
//         }
//       })
//       suggest(suggestions)
//     }
//   })

//   // This event is fired with the user accepts the input in the omnibox.
//   browser.omnibox.onInputEntered.addListener(
//     async function (text) {
//       for (const [key, urls] of suggestionsMap.entries()) {
//         if (key === text) {
//           urls.map(url => browser.tabs.create({ url }))
//           return
//         }
//       }
//       // If the user didn't select one of the suggestions, forward to search
//       browser.search.search({ query: text })
//     })
// }

// function getNaiveLeftPaddedDate(date: Date) {
//   date = new Date(date)
//   const year = date.getFullYear()
//   const month = date.getMonth()
//   const monthsAbbr = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

//   return `${monthsAbbr[month]} ${year}`
// }