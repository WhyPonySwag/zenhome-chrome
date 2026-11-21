const prefix = "zenhome.v1.";
const sites = [
  ["ChatGPT", "chatgpt.com"], ["Claude", "claude.ai"], ["Gemini", "gemini.google.com"],
  ["DeepSeek", "chat.deepseek.com"], ["YouTube", "www.youtube.com"], ["SoundCloud", "soundcloud.com"],
  ["Spotify", "open.spotify.com"], ["FACEIT", "www.faceit.com"], ["CyberShoke", "cybershoke.net"],
  ["GitHub", "github.com"], ["Vercel", "vercel.com"], ["VirusTotal", "www.virustotal.com"],
  ["Figma", "www.figma.com"], ["Telegram", "web.telegram.org"], ["Twitch", "www.twitch.tv"],
  ["Pinterest", "www.pinterest.com"]
];

const defaultLinks = sites.map(([name, host]) => ({ name, url: "https://" + host + "/" }));
const icons = new Map(sites.map(([name, host]) => [host.replace(/^www\./, ""), name.toLowerCase()]));
export const defaultCity = { name: "Севастополь", latitude: 44.6167, longitude: 33.5254 };
const defaults = {
  name: "", greeting: true, clock: true, engine: "google", weather: true, translator: true,
  direction: "en", accent: "neutral", glass: 55, city: defaultCity
};

export function read(key) {
  try { return JSON.parse(localStorage.getItem(prefix + key)); }
  catch { return null; }
}

export function save(key, value) {
  try {
    localStorage.setItem(prefix + key, JSON.stringify(value));
    return true;
  } catch { return false; }
}

export function validCity(city) {
  return city && typeof city.name === "string" && city.name.trim().length > 0 &&
    city.name.length <= 120 && Number.isFinite(city.latitude) && Math.abs(city.latitude) <= 90 &&
    Number.isFinite(city.longitude) && Math.abs(city.longitude) <= 180;
}

export function preferences(raw = read("preferences")) {
  const result = structuredClone(defaults);
  if (!raw || typeof raw !== "object") return result;
  for (const key of ["greeting", "clock", "weather", "translator"]) {
    if (typeof raw[key] === "boolean") result[key] = raw[key];
  }
  if (typeof raw.name === "string") result.name = raw.name.slice(0, 48);
  if (["google", "yandex", "bing"].includes(raw.engine)) result.engine = raw.engine;
  if (["neutral", "sand", "sage", "blue", "lilac"].includes(raw.accent)) result.accent = raw.accent;
  if (["en", "ru"].includes(raw.direction)) result.direction = raw.direction;
  if (Number.isFinite(raw.glass)) result.glass = Math.min(100, Math.max(0, raw.glass));
  if (validCity(raw.city)) result.city = raw.city;
  return result;
}

// Accept HTTP(S) addresses, or an unambiguous host with an optional port and path.
export function siteURL(input) {
  if (typeof input !== "string") return null;
  const value = input.trim();
  if (!value || /[\s\\\u0000-\u001f\u007f]/u.test(value)) return null;
  const explicit = /^https?:\/\//i.test(value);
  if (!explicit && !/^(?:localhost|\[[\da-f:]+\]|[\p{L}\d-]+(?:\.[\p{L}\d-]+)+)(?::\d+)?(?:[/?#]|$)/iu.test(value)) return null;
  try {
    const url = new URL(explicit ? value : "https://" + value);
    if (url.username || url.password || !url.hostname || value.startsWith("/")) return null;
    return url.href;
  } catch { return null; }
}

export function links(raw = read("links")) {
  if (!Array.isArray(raw)) return structuredClone(defaultLinks);
  return raw.flatMap(item => {
    const url = siteURL(item?.url);
    if (!url || typeof item.name !== "string" || !item.name.trim()) return [];
    return [{ name: item.name.trim().slice(0, 60), url }];
  });
}

export function iconName(url) {
  return icons.get(new URL(url).hostname.replace(/^www\./, ""));
}
