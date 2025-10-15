console.log("[TabFocus] popup loaded");

window.addEventListener("DOMContentLoaded", () => {
  const btn  = document.getElementById("listTabs");
  const list = document.getElementById("tabsList");

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
