let focusMode = false;
let blockedSites = [
  "youtube.com",
  "twitter.com",
  "x.com",
  "instagram.com",
  "tiktok.com",
  "facebook.com",
  "netflix.com"
];

chrome.storage.sync.get(["focusMode", "blockedSites"], (res) => {
  if (typeof res.focusMode === "boolean") focusMode = res.focusMode;
  if (Array.isArray(res.blockedSites) && res.blockedSites.length) {
    blockedSites = res.blockedSites;
  }
  console.log("[TabFocus] FocusMode:", focusMode, "Blocked:", blockedSites);
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "SET_FOCUS_MODE") {
    focusMode = !!msg.enabled;
    chrome.storage.sync.set({ focusMode });
    updateBadge();
    console.log("[TabFocus] focusMode =", focusMode);
    sendResponse({ ok: true });
    return true;
  }
  if (msg?.type === "SET_BLOCKED_SITES" && Array.isArray(msg.sites)) {
    blockedSites = msg.sites;
    chrome.storage.sync.set({ blockedSites });
    sendResponse({ ok: true });
    return true;
  }
});
const shouldBlock = (url = "") =>
  blockedSites.some((host) => url.includes(host));


chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!focusMode) return;
  const url = changeInfo.url || tab?.url || "";
  if (url && shouldBlock(url)) {

    chrome.tabs.update(tabId, { url: "chrome://newtab" });
  }
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  if (!focusMode) return;
  const tab = await chrome.tabs.get(tabId);
  if (tab?.url && shouldBlock(tab.url)) {
    chrome.tabs.update(tabId, { url: "chrome://newtab" });
  }
});

const updateBadge = () => {
  chrome.action.setBadgeText({ text: focusMode ? "ON" : "" });
  chrome.action.setBadgeBackgroundColor({ color: "#b45cd3" });
};

// açılışta
chrome.storage.local.get({ focusMode: false }, ({ focusMode: fm }) => {
  focusMode = !!fm; updateBadge();
});



self.addEventListener("install", () => console.log("[TabFocus] installed"));
self.addEventListener("activate", () => console.log("[TabFocus] activated"));