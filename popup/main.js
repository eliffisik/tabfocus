console.log("[TabFocus] popup loaded");

window.addEventListener("DOMContentLoaded", () => {
  const btn  = document.getElementById("listTabs");
  const list = document.getElementById("tabsList");
  const toggle = document.getElementById("focusToggle");

 const siteInput   = document.getElementById("siteInput");
  const addSiteBtn  = document.getElementById("addSite");
  const blockedList = document.getElementById("blockedList");
  const blockedEmpty = document.getElementById("blockedEmpty");

if(!btn||!list){
    console.error("Popup elements not found (#listTabs / #tabsList).");
    return;
}

 const defaultSites = [
  "youtube.com", "twitter.com", "x.com",
  "instagram.com", "tiktok.com", "facebook.com", "netflix.com"
];

 // ---- Helpers ----
  const faviconEmoji = (host) => {
    if (/youtube|netflix/.test(host)) return "📺";
    if (/twitter|x\.com/.test(host))  return "🐦";
    if (/instagram|tiktok|facebook/.test(host)) return "📱";
    return "🌐";
  };

  const setEmptyState = (hasItems) => {
    if (!blockedEmpty) return;
    blockedEmpty.textContent = hasItems ? "" : "Henüz engelli site yok. Bir domain ekleyin (örn: reddit.com)";
  };

  const renderBlocked = (sites = []) => {
    blockedList.innerHTML = "";
    setEmptyState(sites.length > 0);

    sites.forEach((host, i) => {
      const li = document.createElement("li");
      li.className = "block-chip";

      const icon = document.createElement("span");
      icon.textContent = faviconEmoji(host);

      const text = document.createElement("span");
      text.className = "host";
      text.textContent = host;

      const rm = document.createElement("button");
      rm.className = "remove";
      rm.title = "Remove";
      rm.setAttribute("aria-label", `Remove ${host}`);
      rm.textContent = "×";
      rm.addEventListener("click", () => {
        const next = sites.filter((_, idx) => idx !== i);
        chrome.storage.local.set({ blockedSites: next });
        chrome.runtime.sendMessage({ type: "SET_BLOCKED_SITES", sites: next });
        renderBlocked(next);
      });

      li.append(icon, text, rm);
      blockedList.appendChild(li);
    });
  };

  const normalizeHost = (raw) => (raw || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");

  // ---- Focus Mode (kalıcı) ----
  if (toggle) {
    // Açılışta storage'dan yükle
    chrome.storage.local.get({ focusMode: false }, ({ focusMode }) => {
      toggle.checked = !!focusMode;
    });

    // Değişim → storage'a yaz + background'a bildir
    toggle.addEventListener("change", () => {
      const enabled = !!toggle.checked;
      chrome.storage.local.set({ focusMode: enabled });
      chrome.runtime.sendMessage({ type: "SET_FOCUS_MODE", enabled }, () => {
        void chrome.runtime.lastError; // callback hata yutma
      });
    });
  }

  // ---- Sekmeleri listele ----
  btn.addEventListener("click", async () => {
    try {
      const tabs = await chrome.tabs.query({});
      list.innerHTML = "";
      tabs.forEach((tab) => {
        const li = document.createElement("li");
        li.textContent = tab.title || "(no title)";
        li.title = tab.url || "";
        li.addEventListener("click", () => chrome.tabs.update(tab.id, { active: true }));
        list.appendChild(li);
      });
    } catch (e) {
      console.error("tabs.query failed:", e);
    }
  });

  // ---- Blocked sites: initial load (defaults if empty) ----
  chrome.storage.local.get({ blockedSites: defaultSites }, ({ blockedSites }) => {
    if (!blockedSites || blockedSites.length === 0) {
      chrome.storage.local.set({ blockedSites: defaultSites });
      chrome.runtime.sendMessage({ type: "SET_BLOCKED_SITES", sites: defaultSites });
      renderBlocked(defaultSites);
    } else {
      renderBlocked(blockedSites);
    }
  });

  // ---- Blocked sites: add ----
  addSiteBtn?.addEventListener("click", () => {
    const host = normalizeHost(siteInput.value);
    if (!host) return;

    chrome.storage.local.get({ blockedSites: [] }, ({ blockedSites }) => {
      if (!blockedSites.includes(host)) {
        const next = [...blockedSites, host];
        chrome.storage.local.set({ blockedSites: next });
        chrome.runtime.sendMessage({ type: "SET_BLOCKED_SITES", sites: next });
        renderBlocked(next);
        siteInput.value = "";
      }
    });
  });

  // Enter ile ekleme
  siteInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") addSiteBtn?.click();
  });
});