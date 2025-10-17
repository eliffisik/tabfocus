// TabFocus - popup (clean v3)
console.log("[TabFocus] popup loaded");

window.addEventListener("DOMContentLoaded", () => {
  // ---- DOM ----
  const btn          = document.getElementById("listTabs");
  const list         = document.getElementById("tabsList");
  const toggle       = document.getElementById("focusToggle");
  const siteInput    = document.getElementById("siteInput");
  const addSiteBtn   = document.getElementById("addSite");
  const blockedList  = document.getElementById("blockedList");
  const blockedEmpty = document.getElementById("blockedEmpty");

  const sessionNameInput = document.getElementById("sessionName");
  const saveSessionBtn   = document.getElementById("saveSession");
  const sessionsList     = document.getElementById("sessionsList");

  const analyticsList    = document.getElementById("analyticsList");
  const themeToggle      = document.getElementById("themeToggle");

  // Guard
  if (!btn || !list) {
    console.error("Popup elements not found (#listTabs / #tabsList).");
    return;
  }

  // ---- State ----
  let isFocusOn = false;
  let tabsVisible = false;      // tab list toggle
  let currentBlocked = [];      // popup cache

  // ---- Defaults ----
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

  const normalizeHost = (raw) => (raw || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");

  // ---- Blocked list render (focus durumuna göre davranış) ----
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

      // Focus OFF iken tıklanabilir, ON iken disabled
      if (!isFocusOn) {
        li.classList.add("clickable");
        li.title = `Open ${host}`;
        li.addEventListener("click", (e) => {
          const target = e.target;
          if (target && target.classList && target.classList.contains("remove")) return;
          chrome.tabs.create({ url: `https://${host}` });
        });
      } else {
        li.classList.add("disabled");
        li.title = "Disabled in Focus Mode";
      }

      const rm = document.createElement("button");
      rm.className = "remove";
      rm.title = "Remove";
      rm.setAttribute("aria-label", `Remove ${host}`);
      rm.textContent = "×";
      rm.addEventListener("click", (e) => {
        e.stopPropagation();
        const next = sites.filter((_, idx) => idx !== i);
        currentBlocked = next; // cache güncelle
        chrome.storage.local.set({ blockedSites: next });
        chrome.runtime.sendMessage({ type: "SET_BLOCKED_SITES", sites: next });
        renderBlocked(next);
      });

      li.append(icon, text, rm);
      blockedList.appendChild(li);
    });
  };

  // ---- Focus Mode (kalıcı) ----
  chrome.storage.local.get({ focusMode: false }, ({ focusMode }) => {
    isFocusOn = !!focusMode;
    if (toggle) toggle.checked = isFocusOn;
    // sadece görünümü güncelle
    renderBlocked(currentBlocked);
  });

  toggle?.addEventListener("change", () => {
    isFocusOn = !!toggle.checked;
    chrome.storage.local.set({ focusMode: isFocusOn });
    chrome.runtime.sendMessage({ type: "SET_FOCUS_MODE", enabled: isFocusOn }, () => {
      void chrome.runtime.lastError;
    });
    // sadece görünümü güncelle (listeyi boşaltma)
    renderBlocked(currentBlocked);
  });

  // Storage değişimleri (başka taraftan gelirse) senkronize et
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;

    if (changes.focusMode) {
      isFocusOn = !!changes.focusMode.newValue;
      if (toggle) toggle.checked = isFocusOn;
      renderBlocked(currentBlocked);
    }
    if (changes.blockedSites) {
      currentBlocked = changes.blockedSites.newValue || [];
      renderBlocked(currentBlocked);
    }
  });

  // ---- Sekmeleri listele (toggle'lı) ----
 // ---- Sekmeleri listele (toggle'lı & kart görünümü) ----


btn.addEventListener("click", async () => {
  if (tabsVisible) {
    list.innerHTML = "";
    tabsVisible = false;
    btn.textContent = "List Open Tabs";
    return;
  }

  try {
    const tabs = await chrome.tabs.query({});
    list.innerHTML = "";

    tabs.forEach((tab, idx) => {
      // domain çıkar
      const url = tab.url || "";
      let domain = "";
      try { domain = new URL(url).hostname.replace(/^www\./,""); } catch {}

      const li = document.createElement("li");
      li.className = "tab-item";
      li.title = url;

      // favicon
      const fav = document.createElement("img");
      fav.className = "fav";
      fav.src = tab.favIconUrl || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20'><rect width='20' height='20' rx='4' fill='%23ddd'/></svg>";
      fav.referrerPolicy = "no-referrer";

      // başlık + domain
      const title = document.createElement("div");
      title.className = "title";
      title.textContent = tab.title || "(no title)";

      const meta = document.createElement("div");
      meta.className = "domain";
      meta.textContent = domain || "—";

      // aktif sekmeye mini rozet
      const badge = document.createElement("div");
      if (tab.active) {
        badge.className = "badge";
        badge.textContent = "ACTIVE";
      }

      // tıklayınca sekmeye geç
      li.addEventListener("click", () => chrome.tabs.update(tab.id, { active: true }));

      // DOM'a yerleştir
      li.append(fav, title, badge, meta);
      list.appendChild(li);
    });

    tabsVisible = true;
    btn.textContent = "Hide Tabs";
  } catch (e) {
    console.error("tabs.query failed:", e);
  }
});


  // ---- Blocked sites: initial load (defaults if empty) ----
  chrome.storage.local.get({ blockedSites: defaultSites }, ({ blockedSites }) => {
    currentBlocked = (blockedSites && blockedSites.length)
      ? blockedSites
      : defaultSites.slice();

    if (!blockedSites || blockedSites.length === 0) {
      chrome.storage.local.set({ blockedSites: currentBlocked });
      chrome.runtime.sendMessage({ type: "SET_BLOCKED_SITES", sites: currentBlocked });
    }
    renderBlocked(currentBlocked);
  });

  // ---- Blocked sites: add ----
  addSiteBtn?.addEventListener("click", () => {
    const host = normalizeHost(siteInput.value);
    if (!host) return;
    if (currentBlocked.includes(host)) { siteInput.value = ""; return; }

    const next = [...currentBlocked, host];
    currentBlocked = next; // cache
    chrome.storage.local.set({ blockedSites: next });
    chrome.runtime.sendMessage({ type: "SET_BLOCKED_SITES", sites: next });
    renderBlocked(next);
    siteInput.value = "";
  });

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

  // === Theme Toggle ===
  const applyTheme = (dark) => {
    document.body.classList.toggle("dark", !!dark);
  };

  chrome.storage.local.get({ themeDark: false }, ({ themeDark }) => {
    applyTheme(themeDark);
    if (themeToggle) themeToggle.checked = !!themeDark;
  });

  themeToggle?.addEventListener("change", () => {
    const dark = !!themeToggle.checked;
    chrome.storage.local.set({ themeDark: dark });
    applyTheme(dark);
  });
});
