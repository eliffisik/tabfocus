console.log("[TabFocus] popup loaded");

window.addEventListener("DOMContentLoaded", () => {
  const btn  = document.getElementById("listTabs");
  const list = document.getElementById("tabsList");
  const toggle = document.getElementById("focusToggle");

 const siteInput   = document.getElementById("siteInput");
  const addSiteBtn  = document.getElementById("addSite");
  const blockedList = document.getElementById("blockedList");

  const renderBlocked = (sites=[]) => {
    blockedList.innerHTML = "";
    sites.forEach((host, i) => {
      const li = document.createElement("li");
      li.textContent = host;
      li.style.display = "flex";
      li.style.justifyContent = "space-between";
      li.style.alignItems = "center";

      const rm = document.createElement("button");
      rm.textContent = "Remove";
      rm.style.margin = "0";
      rm.style.padding = "4px 8px";
      rm.addEventListener("click", () => {
        const next = sites.filter((_, idx) => idx !== i);
        chrome.storage.local.set({ blockedSites: next });
        chrome.runtime.sendMessage({ type: "SET_BLOCKED_SITES", sites: next });
        renderBlocked(next);
      });

      li.appendChild(rm);
      blockedList.appendChild(li);
    });
  };

  const defaultSites = [
  "youtube.com", "twitter.com", "x.com",
  "instagram.com", "tiktok.com", "facebook.com", "netflix.com"
];

chrome.storage.local.get({ blockedSites: defaultSites }, ({ blockedSites }) => {
  // Eğer storage boşsa varsayılan listeyi kaydet
  if (!blockedSites || blockedSites.length === 0) {
    chrome.storage.local.set({ blockedSites: defaultSites });
    chrome.runtime.sendMessage({ type: "SET_BLOCKED_SITES", sites: defaultSites });
    renderBlocked(defaultSites);
  } else {
    renderBlocked(blockedSites);
  }
});

  addSiteBtn?.addEventListener("click", () => {
    const raw = (siteInput.value || "").trim();
    if (!raw) return;
    const host = raw.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
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


  chrome.storage.sync.get(["focusMode"], ({ focusMode }) => {
    toggle.checked = !!focusMode;
  });
toggle.addEventListener("change", () => {
    const enabled = toggle.checked;
    chrome.runtime.sendMessage({ type: "SET_FOCUS_MODE", enabled });
  });



  
  if (!btn || !list) {
    console.error("Popup elements not found");
    return;
  }

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
});
