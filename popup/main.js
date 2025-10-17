console.log("[TabFocus] popup loaded");

window.addEventListener("DOMContentLoaded", () => {
  const btn  = document.getElementById("listTabs");
  const list = document.getElementById("tabsList");
  const toggle = document.getElementById("focusToggle");

 const siteInput   = document.getElementById("siteInput");
  const addSiteBtn  = document.getElementById("addSite");
  const blockedList = document.getElementById("blockedList");
  const blockedEmpty = document.getElementById("blockedEmpty");

    const sessionNameInput = document.getElementById("sessionName");
  const saveSessionBtn   = document.getElementById("saveSession");
  const sessionsList     = document.getElementById("sessionsList");

if(!btn||!list){
    console.error("Popup elements not found (#listTabs / #tabsList).");
    return;
}

 // ---- State ----
  let isFocusOn = false;
  let tabsVisible = false;      // tab list toggle
  let currentBlocked = [];      // popup cache

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


  // === Session Saver ===
  const renderSessions = (sessions = []) => {
    sessionsList.innerHTML = "";
    sessions.forEach((s, idx) => {
      const li = document.createElement("li");
      li.innerHTML = `
        <span>${s.name} <small style="opacity:.7">(${s.urls.length} tabs)</small></span>
        <div class="btns">
          <button class="restore">Restore</button>
          <button class="delete">Delete</button>
        </div>
      `;
      li.querySelector(".restore").addEventListener("click", () => {
        chrome.windows.create({ url: s.urls });
      });
      li.querySelector(".delete").addEventListener("click", async () => {
        const { sessions: cur = [] } = await chrome.storage.local.get({ sessions: [] });
        const next = cur.filter((_, i) => i !== idx);
        await chrome.storage.local.set({ sessions: next });
        renderSessions(next);
      });
      sessionsList.appendChild(li);
    });
  };

  chrome.storage.local.get({ sessions: [] }, ({ sessions }) => renderSessions(sessions));

  saveSessionBtn?.addEventListener("click", async () => {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const urls = tabs.map(t => t.url).filter(u => u && !u.startsWith("chrome://"));
    if (urls.length === 0) return;

    const name = (sessionNameInput?.value?.trim()) || new Date().toLocaleString();
    const { sessions = [] } = await chrome.storage.local.get({ sessions: [] });
    const next = [{ name, urls }, ...sessions].slice(0, 20);
    await chrome.storage.local.set({ sessions: next });
    renderSessions(next);
    if (sessionNameInput) sessionNameInput.value = "";
  });

  // === Analytics (read-only UI) ===
  const secondsToHMS = (sec) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return (h>0? `${h}h `:"") + (m>0? `${m}m `:"") + `${s}s`;
  };

  const renderAnalytics = async () => {
    const { timeByHost = {} } = await chrome.storage.local.get({ timeByHost: {} });
    const entries = Object.entries(timeByHost).sort((a,b)=>b[1]-a[1]).slice(0,10);

    analyticsList.innerHTML = "";
    if (entries.length === 0) {
      analyticsList.innerHTML = `<div class="item" style="opacity:.7;">No data yet. Keep browsing…</div>`;
      return;
    }

    const max = Math.max(...entries.map(([,sec]) => sec)) || 1;
    entries.forEach(([host, sec]) => {
      const pct = Math.round((sec / max) * 100);
      const wrap = document.createElement("div");
      wrap.className = "item";
      wrap.innerHTML = `
        <div class="label">
          <span>${host}</span><span>${secondsToHMS(sec)}</span>
        </div>
        <div class="barwrap"><div class="bar" style="width:${pct}%"></div></div>
      `;
      analyticsList.appendChild(wrap);
    });
  };

  renderAnalytics();
  setInterval(renderAnalytics, 5000);
});