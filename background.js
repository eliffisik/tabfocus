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

// --- Helpers ---
const shouldBlock = (url = "") =>
  blockedSites.some((host) => url.includes(host));


const updateBadge = () => {
  chrome.action.setBadgeText({ text: focusMode ? "ON" : "" });
  chrome.action.setBadgeBackgroundColor({ color: "#b45cd3" });
};

chrome.storage.local.get({ focusMode: false, blockedSites }, (res) => {
  focusMode = !!res.focusMode;
  blockedSites = Array.isArray(res.blockedSites) ? res.blockedSites : blockedSites;
  updateBadge();
  console.log("[TabFocus] init → focusMode:", focusMode, "blocked:", blockedSites);
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {

  if (msg?.type === "SET_FOCUS_MODE") {
    focusMode = !!msg.enabled;
    chrome.storage.local.set({ focusMode });
    updateBadge();

    if (focusMode) {
         chrome.tabs.query({}, (tabs) => {
        tabs.forEach((tab) => {
          if (tab.url && shouldBlock(tab.url)) {
            chrome.tabs.update(tab.id, { url: "chrome://newtab" });
          }
        });
      });
    }
    sendResponse({ ok: true });
    return true;
  }
   if (msg?.type === "SET_BLOCKED_SITES" && Array.isArray(msg.sites)) {
    blockedSites = msg.sites;
    chrome.storage.local.set({ blockedSites });
    sendResponse({ ok: true });
    return true;
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.focusMode) {
    focusMode = !!changes.focusMode.newValue;
    updateBadge();
    console.log("[TabFocus] storage change → focusMode:", focusMode);
  }
  if (changes.blockedSites) {
    blockedSites = changes.blockedSites.newValue || blockedSites;
    console.log("[TabFocus] storage change → blockedSites:", blockedSites);
  }
});

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

self.addEventListener("install",  () => console.log("[TabFocus] installed"));
self.addEventListener("activate", () => console.log("[TabFocus] activated"));

let lastActiveTabId = null;
let lastActiveStart = null;
let lastActiveHost  = null;

const getHost = (url="") => {
  try { return new URL(url).hostname.replace(/^www\./,""); } catch { return ""; }
};

const commitTime = async () => {
  if (!lastActiveHost || lastActiveStart === null) return;
  const deltaSec = Math.floor((Date.now() - lastActiveStart) / 1000);
  if (deltaSec <= 0) return;

  const { timeByHost = {} } = await chrome.storage.local.get({ timeByHost: {} });
  timeByHost[lastActiveHost] = (timeByHost[lastActiveHost] || 0) + deltaSec;
  await chrome.storage.local.set({ timeByHost });

   lastActiveStart = Date.now(); // akışı sürdür
};

const setActiveTab = async (tabId) => {
  try {
    const tab = await chrome.tabs.get(tabId);
    const newHost = getHost(tab?.url || "");

    await commitTime();
    lastActiveTabId = tabId;
    lastActiveHost  = newHost;
    lastActiveStart = Date.now();
  } catch {}
};

chrome.tabs.onActivated.addListener(({ tabId }) => setActiveTab(tabId));

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tabId !== lastActiveTabId) return; // sadece aktif sekme
  if (changeInfo.status === "complete" || changeInfo.url) {

      commitTime().then(() => {
      lastActiveHost  = getHost(changeInfo.url || tab?.url || "");
      lastActiveStart = Date.now();
    });
  }
});


chrome.windows.onFocusChanged.addListener(async (winId) => {
  if (winId === chrome.windows.WINDOW_ID_NONE) {
    await commitTime();
    lastActiveTabId = null;
    lastActiveHost  = null;
    lastActiveStart = null;
  } else {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      if (tabs[0]) setActiveTab(tabs[0].id);
    });
  }
});

self.addEventListener("beforeunload", () => { commitTime(); });