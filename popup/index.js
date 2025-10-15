document.getElementById("root").innerHTML = `
  <h1>TabFocus</h1>
  <button id="listTabs">List Open Tabs</button>
  <ul id="tabsList"></ul>
`;

document.getElementById("listTabs").addEventListener("click", async () => {
  let tabs = await chrome.tabs.query({});
  const list = document.getElementById("tabsList");
  list.innerHTML = "";
  tabs.forEach(tab => {
    let li = document.createElement("li");
    li.textContent = tab.title;
    list.appendChild(li);
  });
});
