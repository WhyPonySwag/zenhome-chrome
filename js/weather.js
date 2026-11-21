import { read, save, validCity } from "./storage.js";

const cacheLife = 30 * 60 * 1000;
const $ = id => document.getElementById(id);
const descriptions = new Map([
  [0,"Ясно"], [1,"Преимущественно ясно"], [2,"Переменная облачность"], [3,"Пасмурно"],
  [45,"Туман"], [48,"Изморозь и туман"], [51,"Слабая морось"], [53,"Морось"], [55,"Сильная морось"],
  [56,"Ледяная морось"], [57,"Сильная ледяная морось"], [61,"Небольшой дождь"], [63,"Дождь"],
  [65,"Сильный дождь"], [66,"Ледяной дождь"], [67,"Сильный ледяной дождь"], [71,"Небольшой снег"],
  [73,"Снег"], [75,"Сильный снег"], [77,"Снежные зёрна"], [80,"Небольшой ливень"],
  [81,"Ливень"], [82,"Сильный ливень"], [85,"Снежный заряд"], [86,"Сильный снежный заряд"],
  [95,"Гроза"], [96,"Гроза с градом"], [99,"Гроза с сильным градом"]
]);

async function request(url, signal) {
  const response = await fetch(url, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]),
    credentials: "omit", referrerPolicy: "no-referrer"
  });
  if (!response.ok) throw new Error("Weather service unavailable");
  return response.json();
}

export async function findCities(name, signal) {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.search = new URLSearchParams({ name, count: 6, language: "ru", format: "json" });
  const data = await request(url, signal);
  return (data.results ?? []).filter(validCity).map(city => ({
    name: city.name, latitude: city.latitude, longitude: city.longitude,
    description: [...new Set([city.name, city.admin1, city.country].filter(Boolean))].join(", ")
  }));
}

function validReport(report, city) {
  return report && report.latitude === city.latitude && report.longitude === city.longitude &&
    ["temp", "code", "wind", "low", "high", "updated"].every(key => Number.isFinite(report[key])) &&
    report.updated > 0 && report.updated <= Date.now();
}

function show(report, status) {
  $("temp").textContent = report ? Math.round(report.temp) + "°" : "—";
  $("conditions").textContent = report ? descriptions.get(report.code) ?? "Условия не определены" : status;
  $("weather-stats").hidden = !report;
  let icon = "cloud";
  if (report) {
    if (report.code <= 1) icon = report.day === 0 ? "moon" : "sun";
    else if ([71,73,75,77,85,86].includes(report.code)) icon = "snow";
    else if (report.code >= 51) icon = "rain";
    $("range").textContent = "↓ " + Math.round(report.low) + "°　↑ " + Math.round(report.high) + "°";
    $("wind").textContent = report.wind.toLocaleString("ru-RU", { maximumFractionDigits: 1 }) + " м/с";
  }
  document.querySelector(".weather-art use").setAttribute("href", "assets/icons/ui.svg#" + icon);
  $("weather-status").textContent = report ? status : status === "Загрузка погоды…" ? "Получение данных" : "Попробуйте обновить позже";
}

function stamp(time) {
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(time);
}

let active, timer, cityKey;
export function stopWeather() {
  active?.abort();
  active = null;
  clearTimeout(timer);
  cityKey = null;
}

export async function updateWeather(city, force = false) {
  const key = [city.latitude, city.longitude].join(",");
  if (cityKey === key && active && !force) return;
  stopWeather();
  cityKey = key;
  const controller = new AbortController();
  active = controller;
  $("city-name").textContent = city.name;
  const cached = read("weather");
  const previous = validReport(cached, city) ? cached : null;
  const fresh = previous && Date.now() - previous.updated < cacheLife;
  if (fresh && !force) {
    show(previous, "Обновлено " + stamp(previous.updated));
    $("weather-retry").disabled = false;
    timer = setTimeout(() => updateWeather(city, true), cacheLife - (Date.now() - previous.updated) + 100);
    return;
  }
  $("weather-retry").disabled = true;
  show(previous, previous ? "Обновляем · " + stamp(previous.updated) : "Загрузка погоды…");
  try {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.search = new URLSearchParams({
      latitude: city.latitude, longitude: city.longitude, current: "temperature_2m,weather_code,wind_speed_10m,is_day",
      daily: "temperature_2m_min,temperature_2m_max", wind_speed_unit: "ms", timezone: "auto", forecast_days: 1
    });
    const data = await request(url, controller.signal);
    const report = {
      latitude: city.latitude, longitude: city.longitude, updated: Date.now(),
      temp: data.current?.temperature_2m, code: data.current?.weather_code,
      day: data.current?.is_day, wind: data.current?.wind_speed_10m,
      low: data.daily?.temperature_2m_min?.[0], high: data.daily?.temperature_2m_max?.[0]
    };
    if (!validReport(report, city)) throw new Error("Invalid forecast");
    if (controller.signal.aborted) return;
    save("weather", report);
    show(report, "Обновлено " + stamp(report.updated));
  } catch {
    if (controller.signal.aborted) return;
    show(previous, previous ? "Из кэша · " + stamp(previous.updated) : "Погода недоступна");
  } finally {
    if (!controller.signal.aborted) {
      $("weather-retry").disabled = false;
      timer = setTimeout(() => updateWeather(city, true), cacheLife);
    }
  }
}