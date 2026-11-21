import { preferences, links, save, siteURL, iconName } from "./storage.js";
import { findCities, updateWeather, stopWeather } from "./weather.js";

const $ = id => document.getElementById(id);
const engines = {
  google: "https://www.google.com/search?q=",
  yandex: "https://yandex.ru/search/?text=",
  bing: "https://www.bing.com/search?q="
};
let prefs = preferences();
let shortcuts = links();
let minuteTimer;
let editing = null;
let confirmAction;
let cityRequest;

function persist(key, value) {
  if (!save(key, value)) {
    $("notice").textContent = "Хранилище браузера недоступно. Изменения действуют до закрытия страницы.";
    $("notice").hidden = false;
  }
}

function preference(key, value) {
  prefs[key] = value;
  persist("preferences", prefs);
}
function icon(name) {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  const use = document.createElementNS(ns, "use");
  svg.setAttribute("class", "icon");
  svg.setAttribute("aria-hidden", "true");
  use.setAttribute("href", "assets/icons/ui.svg#" + name);
  svg.append(use);
  return svg;
}

const dateFormat = new Intl.DateTimeFormat("ru-RU", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const clockFormat = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
function drawTime() {
  clearTimeout(minuteTimer);
  const now = new Date();
  const hour = now.getHours();
  const phrase = hour < 5 ? "Доброй ночи" : hour < 12 ? "Доброе утро" : hour < 18 ? "Добрый день" : "Добрый вечер";
  $("greeting").textContent = phrase + (prefs.name.trim() ? ", " + prefs.name.trim() : "");
  $("greeting-row").querySelector("use").setAttribute("href", "assets/icons/ui.svg#" + (hour < 5 || hour >= 20 ? "moon" : "sun"));
  $("clock").textContent = clockFormat.format(now);
  $("clock").dateTime = $("clock").textContent;
  const date = dateFormat.format(now);
  $("date").textContent = date[0].toUpperCase() + date.slice(1);
  $("date").dateTime = [now.getFullYear(), String(now.getMonth() + 1).padStart(2,"0"), String(now.getDate()).padStart(2,"0")].join("-");
  if (!document.hidden) minuteTimer = setTimeout(drawTime, 60000 - Date.now() % 60000 + 15);
}

function direction() {
  const from = prefs.direction;
  const to = from === "en" ? "ru" : "en";
  $("from").textContent = from.toUpperCase();
  $("to").textContent = to.toUpperCase();
  $("sl").value = from;
  $("tl").value = to;
  $("swap").title = "Сменить направление перевода: " + from.toUpperCase() + " → " + to.toUpperCase();
}

function applyPreferences() {
  document.documentElement.dataset.accent = prefs.accent;
  document.documentElement.style.setProperty("--glass", prefs.glass / 100);
  $("engine").value = prefs.engine;
  $("greeting-row").hidden = !prefs.greeting;
  $("clock").hidden = !prefs.clock;
  $("weather").hidden = !prefs.weather;
  $("translator").hidden = !prefs.translator;
  $("city-name").textContent = prefs.city.name;
  if (prefs.weather && !document.hidden) updateWeather(prefs.city);
  else stopWeather();
  direction();
  drawTime();
}

function searchControls() {
  const empty = !$("query").value;
  $("clear-search").hidden = empty;
  $("search-hint").hidden = !empty;
}
$("query").addEventListener("input", searchControls);
$("clear-search").addEventListener("click", () => {
  $("query").value = "";
  searchControls();
  $("query").focus();
});
$("search").addEventListener("submit", event => {
  event.preventDefault();
  const value = $("query").value.trim();
  if (value) location.assign(siteURL(value) ?? engines[prefs.engine] + encodeURIComponent(value));
});
$("engine").addEventListener("change", () => preference("engine", $("engine").value));

function drawLinks() {
  $("links").replaceChildren();
  for (const shortcut of shortcuts) {
    const anchor = document.createElement("a");
    anchor.className = "shortcut";
    anchor.href = shortcut.url;
    anchor.title = shortcut.name + " · " + shortcut.url;
    const tile = document.createElement("span");
    tile.className = "shortcut-icon";
    const brand = iconName(shortcut.url);
    if (brand) {
      const img = document.createElement("img");
      img.src = "assets/icons/" + brand + ".svg";
      img.alt = "";
      tile.append(img);
    } else {
      tile.textContent = Array.from(shortcut.name)[0].toUpperCase();
      tile.setAttribute("aria-hidden", "true");
    }
    const label = document.createElement("span");
    label.className = "shortcut-label";
    label.textContent = shortcut.name;
    anchor.append(tile, label);
    $("links").append(anchor);
  }
  $("links-empty").hidden = shortcuts.length > 0;
}

function manageButton(action, symbol, label, disabled) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "icon-btn";
  button.dataset.action = action;
  button.disabled = disabled;
  button.title = label;
  button.setAttribute("aria-label", label);
  button.append(icon(symbol));
  return button;
}
function drawManager() {
  $("manage-list").replaceChildren();
  shortcuts.forEach(({name}, index) => {
    const row = document.createElement("li");
    row.dataset.index = index;
    const text = document.createElement("span");
    text.textContent = name;
    row.append(text,
      manageButton("up", "up", name + " выше", index === 0),
      manageButton("down", "down", name + " ниже", index === shortcuts.length - 1),
      manageButton("edit", "edit", "Изменить " + name, false),
      manageButton("delete", "trash", "Удалить " + name, false));
    $("manage-list").append(row);
  });
}
function saveLinks() {
  persist("links", shortcuts);
  drawLinks();
  drawManager();
}
function openManager() {
  drawManager();
  $("manager").showModal();
}
function openEditor(index = null) {
  editing = index;
  $("editor-title").lastChild.textContent = index === null ? "Добавить ссылку" : "Изменить ссылку";
  $("link-name").value = shortcuts[index]?.name ?? "";
  $("link-url").value = shortcuts[index]?.url ?? "";
  $("link-url").setCustomValidity("");
  $("link-name").setCustomValidity("");
  $("editor").showModal();
  $("link-name").focus();
}
function confirmChange(message, action, label) {
  confirmAction = action;
  $("confirm-message").textContent = message;
  $("confirm-yes").textContent = label;
  $("confirm").showModal();
  $("confirm").querySelector(".dialog-actions [data-close]").focus();
}
$("confirm-yes").addEventListener("click", () => {
  $("confirm").close();
  confirmAction?.();
  confirmAction = null;
});
$("links-edit").setAttribute("aria-label", "Изменить быстрые ссылки");
$("links-edit").addEventListener("click", openManager);
$("pref-links").addEventListener("click", openManager);
$("link-add").addEventListener("click", () => openEditor());
$("manager-add").addEventListener("click", () => openEditor());
$("manage-list").addEventListener("click", event => {
  const button = event.target.closest("button");
  if (!button) return;
  const index = Number(button.closest("li").dataset.index);
  const action = button.dataset.action;
  if (action === "edit") return openEditor(index);
  if (action === "delete") return confirmChange("Удалить ссылку «" + shortcuts[index].name + "»?", () => {
    shortcuts.splice(index, 1);
    saveLinks();
    ($("manage-list").children[Math.min(index, shortcuts.length - 1)]?.querySelector("[data-action=edit]") ?? $("manager-add")).focus();
  }, "Удалить");
  const next = index + (action === "up" ? -1 : 1);
  [shortcuts[index], shortcuts[next]] = [shortcuts[next], shortcuts[index]];
  saveLinks();
  const row = $("manage-list").children[next];
  const moved = row.querySelector("[data-action=" + action + "]");
  (moved.disabled ? row.querySelector("[data-action=edit]") : moved).focus();
});
for (const id of ["link-url","link-name"]) $(id).addEventListener("input", () => $(id).setCustomValidity(""));
$("link-form").addEventListener("submit", event => {
  event.preventDefault();
  const name = $("link-name").value.trim();
  const url = siteURL($("link-url").value);
  if (!name) $("link-name").setCustomValidity("Введите название ссылки.");
  if (!url) $("link-url").setCustomValidity("Введите адрес сайта с протоколом HTTP или HTTPS.");
  if (!$("link-form").reportValidity()) return;
  if (editing === null) shortcuts.push({ name, url });
  else shortcuts[editing] = { name, url };
  $("editor").close();
  saveLinks();
  if ($("manager").open && editing !== null) $("manage-list").children[editing].querySelector("[data-action=edit]").focus();
});

function fillSettings() {
  for (const key of ["name","engine","accent","glass"]) $("pref-" + key).value = prefs[key];
  for (const key of ["clock","greeting","weather","translator"]) $("pref-" + key).checked = prefs[key];
  $("glass-value").textContent = prefs.glass + "%";
}
function openSettings() {
  fillSettings();
  $("settings").showModal();
}
$("settings-open").addEventListener("click", openSettings);
for (const key of ["clock","greeting","weather","translator"]) {
  $("pref-" + key).addEventListener("change", event => {
    preference(key, event.target.checked);
    applyPreferences();
  });
}
for (const key of ["name","engine","accent","glass"]) {
  $("pref-" + key).addEventListener("input", event => {
    preference(key, key === "glass" ? Number(event.target.value) : event.target.value);
    $("glass-value").textContent = prefs.glass + "%";
    applyPreferences();
  });
}
$("reset-open").addEventListener("click", () => confirmChange(
  "Восстановить исходные настройки, город и все 16 быстрых ссылок? Ваши изменения будут удалены.",
  () => {
    prefs = preferences(null);
    shortcuts = links(null);
    persist("preferences", prefs);
    saveLinks();
    fillSettings();
    applyPreferences();
  }, "Восстановить"
));
$("swap").addEventListener("click", () => {
  preference("direction", prefs.direction === "en" ? "ru" : "en");
  direction();
});
$("translation").addEventListener("input", () => $("translation").setCustomValidity(""));
$("translate-form").addEventListener("submit", event => {
  if (!$("translation").value.trim()) {
    event.preventDefault();
    $("translation").setCustomValidity("Введите текст для перевода.");
    $("translation").reportValidity();
  }
});
$("weather-retry").addEventListener("click", () => updateWeather(prefs.city, true));
$("city-open").addEventListener("click", () => {
  $("city-query").value = "";
  $("city-results").replaceChildren();
  $("city-status").textContent = "";
  $("city-dialog").showModal();
  $("city-query").focus();
});
$("city-dialog").addEventListener("close", () => cityRequest?.abort());
$("city-form").addEventListener("submit", async event => {
  event.preventDefault();
  cityRequest?.abort();
  const controller = new AbortController();
  cityRequest = controller;
  $("city-results").replaceChildren();
  const name = $("city-query").value.trim();
  if (name.length < 2) {
    $("city-status").textContent = "Введите хотя бы два символа.";
    return;
  }
  $("city-status").textContent = "Ищем город…";
  try {
    const results = await findCities(name, controller.signal);
    if (controller.signal.aborted) return;
    $("city-status").textContent = results.length ? "Выберите город" : "Совпадений нет. Уточните название.";
    for (const {description, ...city} of results) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = description;
      button.addEventListener("click", () => {
        preference("city", city);
        $("city-dialog").close();
        applyPreferences();
      });
      const item = document.createElement("li");
      item.append(button);
      $("city-results").append(item);
    }
  } catch {
    if (!controller.signal.aborted) $("city-status").textContent = "Поиск городов недоступен. Попробуйте позже.";
  }
});

document.querySelectorAll("[data-close]").forEach(button => {
  button.addEventListener("click", () => button.closest("dialog").close());
});
document.addEventListener("keydown", event => {
  if (event.ctrlKey || event.altKey || event.metaKey || event.isComposing || document.querySelector("dialog[open]")) return;
  if (event.target.matches("input,textarea,select,[contenteditable=true]")) {
    if (event.key === "Escape" && event.target === $("query")) $("clear-search").click();
    return;
  }
  if (event.key === "/" || event.code === "Comma" && !event.shiftKey) {
    event.preventDefault();
    if (event.key === "/") $("query").focus();
    else openSettings();
  }
});
document.addEventListener("visibilitychange", applyPreferences);
window.addEventListener("storage", event => {
  if (event.key === "zenhome.v1.preferences" || event.key === null) {
    prefs = preferences();
    fillSettings();
    applyPreferences();
  }
  if (event.key === "zenhome.v1.links" || event.key === null) {
    // A different tab may have removed or reordered the link being edited.
    for (const id of ["confirm","editor"]) if ($(id).open) $(id).close();
    shortcuts = links();
    drawLinks();
    drawManager();
  }
});

applyPreferences();
drawLinks();
searchControls();