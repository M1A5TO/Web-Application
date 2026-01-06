import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { fetchListingById } from "../api/client";
import type { ListingDetails } from "../api/types";
import DetailMap from "../components/DetailMap";
import { FiDollarSign, FiHome, FiMapPin } from "react-icons/fi";

/** Normalizuje typ POI z bazy (obsługuje m.in. "tram_stop: tram_stop") */
function normalizePoiType(raw?: string): string {
  if (!raw) return "";
  const s = String(raw).trim();
  if (!s) return "";
  return s.split(":")[0].trim().toLowerCase();
}

/** Emoji POI */
const POI_EMOJI: Record<string, string> = {
  bus_stop: "🚌",
  tram_stop: "🚋",
  rail_station: "🚆",

  playground: "🛝",
  park: "🌳",

  convenience: "🛒",
  supermarket: "🛒",
  bakery: "🥐",
  pharmacy: "💊",
  parcel_locker: "📦",

  school: "📚",
  kinder_childcare: "🧸",
  university: "🎓",
  library: "📖",

  clinic_hospital: "🏥",
  fitness_centre: "🏋️",

  veterinary: "🐾",
  pet_shop: "🐾",

  pub: "🍺",
  nightclub: "🎉",
};

function poiEmoji(rawType?: string): string {
  const key = normalizePoiType(rawType);
  return POI_EMOJI[key] ?? "📍";
}

/** Polskie etykiety POI (UI) */
const POI_LABEL_PL: Record<string, string> = {
  bus_stop: "Przystanek autobusowy",
  tram_stop: "Przystanek tramwajowy",
  rail_station: "Stacja kolejowa",

  playground: "Plac zabaw",
  park: "Park",

  convenience: "Sklep",
  supermarket: "Supermarket",
  bakery: "Piekarnia",
  pharmacy: "Apteka",
  parcel_locker: "Paczkomat",

  school: "Szkoła",
  kinder_childcare: "Przedszkole",
  university: "Uczelnia",
  library: "Biblioteka",

  clinic_hospital: "Obiekt medyczny",
  fitness_centre: "Siłownia",

  veterinary: "Weterynarz",
  pet_shop: "Sklep zoologiczny",

  pub: "Pub",
  nightclub: "Klub",
};

function poiLabelPl(rawType?: string): string {
  const key = normalizePoiType(rawType);
  return POI_LABEL_PL[key] ?? "Punkt w okolicy";
}

/** Format czasu w sekundach -> "1m 25s" (modulo 60) */
function formatSecondsAsMinSec(seconds?: number): string {
  const s = typeof seconds === "number" && Number.isFinite(seconds) ? Math.round(seconds) : 0;
  if (s <= 0) return "—";
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m <= 0) return `${r}s`;
  if (r === 0) return `${m}m`;
  return `${m}m ${r}s`;
}

/** Reverse geocoding w przeglądarce (Nominatim) – bez zmian w backendzie */
type NominatimResponse = {
  address?: {
    road?: string;
    house_number?: string;
    pedestrian?: string;
    footway?: string;
    path?: string;
    cycleway?: string;
    residential?: string;
    neighbourhood?: string;
    suburb?: string;
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    county?: string;
  };
  display_name?: string;
};

function buildStreetLabelFromNominatim(j: NominatimResponse | null): string | null {
  if (!j) return null;
  const a = j.address ?? {};

  const road =
    a.road ||
    a.pedestrian ||
    a.footway ||
    a.path ||
    a.cycleway ||
    a.residential ||
    a.neighbourhood ||
    a.suburb;

  const house = a.house_number ? ` ${a.house_number}` : "";
  const city = a.city || a.town || a.village || a.municipality || a.county;

  if (road && city) return `${road}${house} • ${city}`;
  if (road) return `${road}${house}`;
  if (city) return city;

  if (j.display_name) {
    const short = String(j.display_name).split(",").slice(0, 2).join(", ").trim();
    return short || null;
  }

  return null;
}

/** ===== Zdjęcia: dociąganie meta po photo_ids (bez dopasowania po URL) ===== */
type ApartmentApi = { style?: string | null; photo_ids?: number[] };

type GalleryItem = {
  id: number;
  url: string;
  photo_type: string | null;
  room_type: string | null;
  room_style: string | null;
  style: string | null;
};

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

function normalizeBase(b: string): string {
  const s = (b ?? "").trim();
  if (!s) return "";
  return s.replace(/\/+$/, "");
}

function joinUrl(base: string, path: string): string {
  const b = normalizeBase(base);
  const p = path.startsWith("/") ? path : `/${path}`;
  if (!b) return p;
  return `${b}${p}`;
}

function getApiBases(): string[] {
  const envBaseRaw = (import.meta as any)?.env?.VITE_API_BASE_URL as string | undefined;
  const envBase = normalizeBase(envBaseRaw ?? "");

  const bases: string[] = [];

  if (envBase) {
    bases.push(envBase);

    // Jeśli env jest np. https://api.xxx/api albo /api — dodaj wariant bez /api
    if (envBase.endsWith("/api")) bases.push(envBase.slice(0, -4));
  }

  // Proxy dev /api + same-origin
  bases.push("/api");
  bases.push("");

  return uniq(bases.map(normalizeBase));
}

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, {
    signal,
    headers: { Accept: "application/json" },
    credentials: "include",
  });

  // Jeżeli backend zwróci HTML (np. 404 z reverse-proxy), to r.json() wywali się.
  // Dajemy czytelniejszy błąd.
  const ct = res.headers.get("content-type") ?? "";
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} for ${url}${text ? `: ${text.slice(0, 120)}` : ""}`);
  }
  if (!ct.includes("application/json")) {
    const text = await res.text().catch(() => "");
    throw new Error(`Non-JSON response for ${url}${text ? `: ${text.slice(0, 120)}` : ""}`);
  }

  return (await res.json()) as T;
}

async function tryFetchFirst<T>(candidates: string[], signal?: AbortSignal): Promise<T> {
  let lastErr: unknown = null;
  for (const url of candidates) {
    try {
      return await fetchJson<T>(url, signal);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error("Fetch failed");
}

/** Labelki dla photo_type / room_type / style */
function prettyPhotoType(x?: string | null): string | null {
  const v = (x ?? "").trim().toLowerCase();
  if (!v) return null;
  if (v === "interior") return "wnętrze";
  if (v === "non-interior" || v === "exterior") return "zewnętrze";
  return v;
}

const ROOM_TYPE_PL: Record<string, string> = {
  kuchnia: "kuchnia",
  "aneks kuchenny": "aneks kuchenny",
  "pokój dziecięcy": "pokój dziecięcy",
  "pokoj dziecięcy": "pokój dziecięcy",
  "pokoj dzieciecy": "pokój dziecięcy",
  sypialnia: "sypialnia",
  "sypialnia dziecięca": "sypialnia dziecięca",
  "sypialnia dziececa": "sypialnia dziecięca",
  salon: "salon",
  jadalnia: "jadalnia",
  lazienka: "łazienka",
  "łazienka": "łazienka",
  "klatka schodowa": "klatka schodowa",
  "schody wewnętrzne": "schody wewnętrzne",
  "schody wewnetrzne": "schody wewnętrzne",
  "pokój biurowy": "pokój biurowy",
  "pokoj biurowy": "pokój biurowy",
  "pokój gier": "pokój gier",
  "pokoj gier": "pokój gier",
};

function withPolishDiacritics(s: string): string {
  // Minimalne mapowanie najczęstszych braków polskich znaków.
  // Cel: ładne etykiety w UI (nie lingwistyczna perfekcja).
  return s
    .replace(/\bpokoj\b/gi, "pokój")
    .replace(/\bdzieciecy\b/gi, "dziecięcy")
    .replace(/\bdziecieca\b/gi, "dziecięca")
    .replace(/\blazienka\b/gi, "łazienka")
    .replace(/\bwlasciciel\b/gi, "właściciel")
    .replace(/\bsilownia\b/gi, "siłownia")
    .replace(/\bprzedszkole\b/gi, "przedszkole")
    .replace(/\bstyl\b/gi, "styl");
}

function prettyRoomType(x?: string | null): string | null {
  const raw = (x ?? "").trim();
  if (!raw) return null;
  const key = raw.toLowerCase();

  // znane mapowania
  const known = ROOM_TYPE_PL[key];
  if (known) return known;

  // fallback: klatka_schodowa / schody-wewnetrzne -> "klatka schodowa" / "schody wewnetrzne"
  const normalized = raw
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return withPolishDiacritics(normalized);
}

const STYLE_PL: Record<string, string> = {
  nowoczesny: "nowoczesny",
  modern: "nowoczesny",
  contemporary: "współczesny",
  "współczesny": "współczesny",
  rustic: "rustykalny",
  rustykalny: "rustykalny",
  traditional: "tradycyjny",
  tradycyjny: "tradycyjny",
  farmhouse: "farmhouse",
  indian: "indyjski",
  indyjski: "indyjski",
  coastal: "nadmorski",
  nadmorski: "nadmorski",
  feminine: "kobiecy",
  kobiecy: "kobiecy",
  minimalist: "minimalistyczny",
  minimal: "minimalistyczny",
  minimalistyczny: "minimalistyczny",
  tropical: "tropikalny",
  tropikalny: "tropikalny",
  boho: "boho chic",
  "boho chic": "boho chic",
  "mid-century modern": "mid-century modern",
  "śródziemnomorski": "śródziemnomorski",
  "azjatycki": "azjatycki",
  "eklektyczny": "eklektyczny",
  "południowo-zachodni": "południowo-zachodni",
  "tradycyjne klasyczne wnętrze": "tradycyjne klasyczne wnętrze",
  "tematyczny - pojazdy": "tematyczny - pojazdy",
  "wielobarwny": "wielobarwny",
  "klasyczny rustykalny": "klasyczny rustykalny",
};

function prettyStyle(x?: string | null): string | null {
  const raw = (x ?? "").trim();
  if (!raw) return null;

  const key = raw.toLowerCase();

  // specjalne kategorie
  if (key === "others" || key === "other" || key === "inny" || key === "inne") return "inny";

  const mapped = STYLE_PL[key];
  if (mapped) return mapped;

  // fallback: np. "mid_century_modern" -> "mid century modern"
  return raw
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildPhotoHoverLabel(ph: GalleryItem): string {
  // Ma być widoczny photo_type; reszta pomocniczo.
  const t = prettyPhotoType(ph.photo_type) ?? "brak typu";
  const rt = prettyRoomType(ph.room_type);
  const rs = (ph.room_style ?? "").trim() || null;

  const parts = [t];
  if (rt) parts.push(rt);
  if (rs) parts.push(rs);

  return parts.join(" • ");
}

function shouldPrefixUl(label: string): boolean {
  // Heurystyka: prefix "ul." tylko jeśli wygląda na ulicę.
  // buildStreetLabelFromNominatim zwraca np. "Kwiatowa 12 • Reda" albo "Reda".
  const s = String(label).trim();
  if (!s) return false;
  // jeśli jest separator "•" to część przed nim zwykle jest drogą
  const left = s.split("•")[0]?.trim() ?? "";
  // musi być jakaś nazwa drogi (litery) i nie może wyglądać jak samo miasto
  // (dla samego miasta left==s, a często bez cyfr/skrótów drogowych)
  const hasLetters = /[A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż]/.test(left);
  const hasStreetHint = /\d|\b(Al\.|Aleja|Aleje|Plac|Os\.|Osiedle|Rynek|Bulwar|Skwer)\b/i.test(left);

  // Najprościej: jeśli jest "•" i lewa część nie jest pusta => traktuj jako ulica.
  if (s.includes("•") && hasLetters) return true;

  // Bez "•": prefixuj tylko jeśli widać numer lub typowe słowa ulic/placów.
  return hasLetters && hasStreetHint;
}

function formatLocationLabel(label: string | null): string | null {
  if (!label) return null;
  const s = label.trim();
  if (!s) return null;
  return shouldPrefixUl(s) ? `ul. ${s}` : s;
}

function normalizeTokenLabel(x?: string | null): string {
  return (x ?? "").trim();
}

function mapPoiDesc(x?: string | null): string | null {
  const v = normalizeTokenLabel(x).toUpperCase();
  if (!v) return null;
  if (v === "HIGH") return "Wysoka dostępność usług";
  if (v === "MEDIUM") return "Średnia dostępność usług";
  if (v === "LOW") return "Niska dostępność usług";
  return null;
}

function mapPriceDesc(x?: string | null): string | null {
  const v = normalizeTokenLabel(x).toUpperCase();
  if (!v) return null;
  if (v === "CHEAP") return "Tanie mieszkanie";
  if (v === "AVERAGE") return "Mieszkanie w średnim przedziale cenowym";
  if (v === "EXPENSIVE") return "Drogie mieszkanie";
  return null;
}

function mapSizeDesc(x?: string | null): string | null {
  const v = normalizeTokenLabel(x).toUpperCase();
  if (!v) return null;
  if (v === "SMALL") return "Małe mieszkanie";
  if (v === "MEDIUM") return "Średnie mieszkanie";
  if (v === "LARGE") return "Duże mieszkanie";
  return null;
}

function mapApartmentStyle(x?: string | null): string | null {
  const v = normalizeTokenLabel(x).toUpperCase();
  if (!v) return null;
  // ALLOWED_STYLES: modern, classic, industrial, scandinavian, minimalist, vintage, other
  if (v === "OTHER" || v === "OTHERS") return "inny";
  if (v === "MODERN") return "nowoczesny";
  if (v === "CLASSIC") return "tradycyjny";
  if (v === "INDUSTRIAL") return "industrialny";
  if (v === "SCANDINAVIAN") return "skandynawski";
  if (v === "MINIMALIST") return "minimalistyczny";
  if (v === "VINTAGE") return "vintage";
  // fallback: pokaż surową wartość
  return x?.trim() || null;
}

export default function ListingDetailsPage() {
  const { id = "" } = useParams();
  const { search } = useLocation();
  const navigate = useNavigate();

  const selectedProfile = useMemo(() => {
    const q = new URLSearchParams(search);
    return (q.get("profile") ?? "uniwersalne") as any;
  }, [search]);

  const [data, setData] = useState<ListingDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [geoLabel, setGeoLabel] = useState<string | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);

  const [styleLabel, setStyleLabel] = useState<string | null>(null);
  const [galleryItems, setGalleryItems] = useState<GalleryItem[] | null>(null);

  const [hoveredPhoto, setHoveredPhoto] = useState<number | null>(null); // kept only for UI highlight; not used for info panel
  const [activePhotoId, setActivePhotoId] = useState<number | null>(null);
  const [showAllPhotos, setShowAllPhotos] = useState(false);

  useEffect(() => {
    if (!id) {
      setError("Brak ID oferty.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    fetchListingById(id)
      .then((res) => setData(res))
      .catch((e) => setError(e?.message ?? "Błąd nieznany"))
      .finally(() => setLoading(false));
  }, [id]);

  // Reverse geocoding po stronie klienta (bez zmian backendu)
  useEffect(() => {
    const lat = data?.coords?.lat;
    const lon = data?.coords?.lon;

    if (typeof lat !== "number" || typeof lon !== "number") {
      setGeoLabel(null);
      return;
    }

    const ctrl = new AbortController();
    setGeoLoading(true);
    setGeoLabel(null);

    (async () => {
      try {
        const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
          lat
        )}&lon=${encodeURIComponent(lon)}&zoom=18&addressdetails=1`;

        const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: "application/json" } });
        if (!res.ok) throw new Error(`Reverse geocoding failed: ${res.status}`);

        const json = (await res.json()) as NominatimResponse;
        setGeoLabel(buildStreetLabelFromNominatim(json));
      } catch (e) {
        if ((e as any)?.name === "AbortError") return;
        setGeoLabel(null);
      } finally {
        setGeoLoading(false);
      }
    })();

    return () => ctrl.abort();
  }, [data?.coords?.lat, data?.coords?.lon]);

  // Dociąganie: apartament (style) – zdjęcia bierzemy z fetchListingById (photoItems)
  useEffect(() => {
    if (!id) return;

    const ctrl = new AbortController();

    // null = ładowanie w toku / brak próby; [] = załadowane, ale pusto
    setStyleLabel(null);

    const bases = getApiBases();
    const aptPaths = ["/apartments", "/apartaments"]; // obsłuż obie wersje

    (async () => {
      try {
        const aptUrls = bases.flatMap((b) => aptPaths.map((p) => joinUrl(b, `${p}/${encodeURIComponent(id)}`)));
        const apt = await tryFetchFirst<ApartmentApi>(aptUrls, ctrl.signal);

        const aptStyle = prettyStyle(typeof apt.style === "string" ? apt.style : null);
        setStyleLabel(aptStyle);
      } catch (e) {
        if ((e as any)?.name === "AbortError") return;
        setStyleLabel(null);
      }
    })();

    return () => ctrl.abort();
  }, [id]);

  // Galeria: preferuj data.photoItems (z meta), fallback do data.photos (stringi)
  useEffect(() => {
    if (!data) {
      setGalleryItems(null);
      return;
    }

    const itemsFromMeta = Array.isArray((data as any).photoItems) ? ((data as any).photoItems as any[]) : [];

    if (itemsFromMeta.length > 0) {
      const mapped = itemsFromMeta
        .map((x) => {
          const url = typeof x?.url === "string" ? x.url : "";
          if (!url) return null;
          return {
            id: Number(x?.id ?? 0),
            url,
            photo_type: typeof x?.photo_type === "string" ? x.photo_type : null,
            room_type: typeof x?.room_type === "string" ? x.room_type : null,
            room_style: typeof x?.room_style === "string" ? x.room_style : null,
            style: typeof x?.style === "string" ? x.style : null,
          } as GalleryItem;
        })
        .filter(Boolean) as GalleryItem[];

      setGalleryItems(mapped);
      return;
    }

    const urls = Array.isArray((data as any)?.photos) ? ((data as any).photos as any[]) : [];
    const fallback = urls
      .map((x, i) => {
        const url = typeof x === "string" ? x : "";
        if (!url) return null;
        return {
          id: i,
          url,
          photo_type: null,
          room_type: null,
          room_style: null,
          style: null,
        } as GalleryItem;
      })
      .filter(Boolean) as GalleryItem[];

    setGalleryItems(fallback);
  }, [data]);

  /** Punkt mieszkania do mapy */
  const listingPoint = useMemo(() => {
    if (!data?.coords) return undefined;
    return { lat: data.coords.lat, lon: data.coords.lon, title: data.title };
  }, [data?.coords, data?.title]);

  /** Punkty POI do mapy (stara logika) */
  const poiPoints = useMemo(() => {
    return (data?.poi ?? [])
      .filter((p: any) => !!p?.coords)
      .map((p: any) => ({
        lat: p.coords.lat,
        lon: p.coords.lon,
        name: p.name,
        type: p.type,
        distanceM: p.distanceM,
      }));
  }, [data?.poi]);

  /** Galeria: preferuj photo_ids->photos, fallback do data.photos (stringi) */
  const gallery = useMemo(() => {
    if (galleryItems && galleryItems.length > 0) return galleryItems;
    return [] as GalleryItem[];
  }, [galleryItems]);

  const visibleGallery = useMemo(() => {
    const list = showAllPhotos ? gallery : gallery.slice(0, 9);
    return list;
  }, [gallery, showAllPhotos]);

  const activeIndex = useMemo(() => {
    if (activePhotoId == null) return null;
    const idx = visibleGallery.findIndex((p) => p.id === activePhotoId);
    return idx >= 0 ? idx : null;
  }, [activePhotoId, visibleGallery]);

  const infoPhoto = useMemo(() => {
    const idx = typeof activeIndex === "number" ? activeIndex : null;
    if (typeof idx !== "number" || idx < 0) return null;
    return visibleGallery[idx] ?? null;
  }, [activeIndex, visibleGallery]);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 18,
              fontWeight: 900,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {data?.title ?? "Szczegóły oferty"}
          </div>
          <div style={{ color: "var(--muted)", fontSize: 13, fontWeight: 600 }}>
            {data?.address ?? ""}
            {data?.id ? (
              <>
                {" "}
                <span style={{ opacity: 0.9 }}>•</span>{" "}
                <span title="ID mieszkania" style={{ fontWeight: 800 }}>
                  ID: {data.id}
                </span>
              </>
            ) : null}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="button button--outline"
            onClick={() => {
              // Prefer history back to preserve Results state (page/scroll/cached items).
              // If user opened details directly (no history), fallback to results + query.
              if (window.history.length > 1) navigate(-1);
              else navigate(`/results${search}`);
            }}
          >
            Wróć do wyników
          </button>
        </div>
      </div>

      <div className="grid-results" style={{ gridTemplateColumns: "1fr 1fr", alignItems: "stretch" }}>
        <section className="card" style={{ display: "grid", gap: 16 }}>
          {loading && <div>Ładowanie…</div>}
          {error && <div style={{ color: "#fca5a5" }}>Błąd: {error}</div>}

          {!loading && !error && data && (
            <>
              <div>
                <div style={{ marginTop: 6, display: "grid", gap: 8 }}>
                  {/* Cena */}
                  <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
                    <div
                      style={{
                        fontSize: 20,
                        fontWeight: 900,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <span aria-hidden="true" style={{ opacity: 0.85, display: "grid", placeItems: "center" }}>
                        <FiDollarSign size={20} />
                      </span>
                      <span>{data.pricePln?.toLocaleString("pl-PL") ?? "—"} PLN</span>
                    </div>
                  </div>

                  {/* Metraż */}
                  <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
                    <div
                      style={{
                        fontWeight: 800,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <span aria-hidden="true" style={{ opacity: 0.85, display: "grid", placeItems: "center" }}>
                        <FiHome size={20} />
                      </span>
                      <span>{data.areaM2 ?? "—"} m²</span>
                    </div>
                  </div>

                  {/* Lokalizacja (pod metrażem) */}
                  {data.coords && (
                    <div style={{ color: "var(--muted)", display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                      <span aria-hidden="true" style={{ opacity: 0.85, display: "grid", placeItems: "center" }}>
                        <FiMapPin size={18} />
                      </span>

                      {geoLabel ? (
                        <span style={{ fontWeight: 700 }}>{formatLocationLabel(geoLabel)}</span>
                      ) : geoLoading ? (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 8,
                            fontWeight: 700,
                            color: "var(--muted)",
                          }}
                          aria-label="Ustalanie adresu"
                          title="Ustalanie adresu (OSM)"
                        >
                          <span
                            aria-hidden="true"
                            style={{
                              width: 10,
                              height: 10,
                              borderRadius: 999,
                              border: "2px solid rgba(139,92,246,0.35)",
                              borderTopColor: "rgba(139,92,246,0.95)",
                              animation: "spin 0.9s linear infinite",
                            }}
                          />
                          ustalanie adresu…
                        </span>
                      ) : (
                        <code>
                          {data.coords.lat.toFixed(5)}, {data.coords.lon.toFixed(5)}
                        </code>
                      )}

                      {styleLabel && (
                        <div style={{ width: "100%", marginTop: 2, color: "var(--muted)", fontSize: 12 }}>
                          <small>Styl:&nbsp;</small>
                          <span style={{ fontWeight: 700 }}>{styleLabel}</span>
                        </div>
                      )}

                      <style>
                        {`@keyframes spin { to { transform: rotate(360deg); } }`}
                      </style>
                    </div>
                  )}
                </div>
              </div>

              {/* ZDJĘCIA */}
              <div>
                <div className="label">Podgląd i analiza zdjęć</div>

                {galleryItems === null && (
                  <div style={{ color: "var(--muted)", fontSize: 12, marginBottom: 8 }}>Ładowanie zdjęć…</div>
                )}

                {gallery.length > 0 ? (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                      {visibleGallery.map((ph, i) => {
                        const label = buildPhotoHoverLabel(ph);
                        const isActive = (activeIndex ?? hoveredPhoto) === i;

                        return (
                          <button
                            key={`${ph.id}-${ph.url}-${i}`}
                            type="button"
                            title={label}
                            aria-label={`Zdjęcie ${i + 1}. ${label}`}
                            onMouseEnter={() => setHoveredPhoto(i)}
                            onMouseLeave={() => setHoveredPhoto(null)}
                            onFocus={() => setHoveredPhoto(i)}
                            onBlur={() => setHoveredPhoto(null)}
                            onClick={() => setActivePhotoId(ph.id)}
                            style={{
                              display: "block",
                              padding: 0,
                              border: 0,
                              background: "transparent",
                              cursor: "pointer",
                              textAlign: "left",
                            }}
                          >
                            <div style={{ position: "relative" }}>
                              <img
                                src={ph.url}
                                alt={`Zdjęcie ${i + 1}`}
                                loading="lazy"
                                referrerPolicy="no-referrer"
                                style={{
                                  width: "100%",
                                  height: 120,
                                  objectFit: "cover",
                                  borderRadius: 12,
                                  border: isActive
                                    ? "1px solid rgba(139,92,246,0.85)"
                                    : "1px solid var(--border)",
                                  boxShadow: isActive ? "0 0 0 4px var(--ring)" : "none",
                                  background: "var(--panel-2)",
                                  display: "block",
                                }}
                                onError={(e) => {
                                  (e.currentTarget as HTMLImageElement).style.display = "none";
                                }}
                              />
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Panel z informacjami: stała wysokość (bez "skakania") */}
                    <div
                      className="card"
                      style={{
                        marginTop: 10,
                        padding: 12,
                        background: "rgba(17,24,39,0.35)",
                        border: "1px solid rgba(139,92,246,0.25)",
                        minHeight: 92,
                      }}
                      aria-live="polite"
                    >
                      {infoPhoto ? (
                        (() => {
                          const ph = infoPhoto;
                          const typeLabel = prettyPhotoType(ph.photo_type) ?? "brak typu";
                          const roomLabel = prettyRoomType(ph.room_type);
                          const roomStyle = (ph.room_style ?? "").trim() || null;

                          const rawType = (ph.photo_type ?? "").trim().toLowerCase();
                          const isExterior = rawType === "exterior" || rawType === "non-interior";

                          return (
                            <div style={{ display: "grid", gap: 6, fontSize: 13 }}>
                              <div>
                                <span style={{ color: "var(--muted)", fontWeight: 700 }}>Typ:&nbsp;</span>
                                <span style={{ fontWeight: 800 }}>{typeLabel}</span>
                              </div>

                              <div>
                                <span style={{ color: "var(--muted)", fontWeight: 700 }}>Pomieszczenie:&nbsp;</span>
                                <span style={{ fontWeight: 800 }}>{roomLabel ?? "—"}</span>
                              </div>

                              <div>
                                <span style={{ color: "var(--muted)", fontWeight: 700 }}>Styl pomieszczenia:&nbsp;</span>
                                <span style={{ fontWeight: 800 }}>{roomStyle ?? "—"}</span>
                              </div>

                              {isExterior && (
                                <div>
                                  <span style={{ color: "var(--muted)", fontWeight: 700 }}>Dodatkowy opis:&nbsp;</span>
                                  <span style={{ fontWeight: 700 }}>Zdjęcie nie podlega dokładnej analizie.</span>
                                </div>
                              )}
                            </div>
                          );
                        })()
                      ) : (
                        <div style={{ color: "var(--muted)", fontWeight: 700, fontSize: 13 }}>
                          Kliknij zdjęcie, aby zobaczyć jego opis.
                        </div>
                      )}
                    </div>

                    {gallery.length > 9 && (
                      <div style={{ marginTop: 10, display: "flex", justifyContent: "center" }}>
                        <button
                          type="button"
                          className="button button--outline"
                          onClick={() => {
                            setShowAllPhotos((v) => !v);
                            setHoveredPhoto(null);
                            // keep activePhotoId; if it becomes invisible it will fall back to hover
                          }}
                          style={{ padding: "10px 14px" }}
                        >
                          {showAllPhotos ? "Pokaż mniej" : `Pokaż wszystkie (${gallery.length})`}
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <div
                    style={{
                      height: 120,
                      borderRadius: 12,
                      background: "var(--panel-2)",
                      border: "1px solid var(--border)",
                      display: "grid",
                      placeItems: "center",
                      color: "var(--muted)",
                    }}
                  >
                    Brak zdjęć dla tej oferty.
                  </div>
                )}
              </div>

              {/* ATRAKCYJNOŚĆ */}
              <div>
                <div className="label">Atrakcyjność mieszkania</div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                    gap: 8,
                  }}
                >
                  {(
                    [
                      { key: "uniwersalne", value: data.scores?.overall, label: "Uniwersalny" },
                      { key: "rodzina", value: data.scores?.family, label: "Rodzinny" },
                      { key: "student", value: data.scores?.commute, label: "Student" },
                      { key: "singiel", value: data.scores?.services, label: "Singiel" },
                      { key: "wlasciciel_psa", value: data.scores?.green, label: "Właściciel psa" },
                    ] as const
                  ).map((x) => {
                    const isSelected = selectedProfile === x.key;

                    return (
                      <div
                        key={x.key}
                        className="card"
                        style={{
                          padding: 12,
                          borderColor: isSelected ? "rgba(139,92,246,0.95)" : undefined,
                          boxShadow: isSelected ? "0 0 0 4px var(--ring)" : undefined,
                        }}
                        title={isSelected ? "Wybrany profil wyszukiwania" : undefined}
                      >
                        <div
                          style={{
                            color: "var(--muted)",
                            fontSize: 12,
                            whiteSpace: "normal",
                            lineHeight: 1.15,
                          }}
                        >
                          {x.label}
                        </div>
                        <div style={{ fontSize: 18, fontWeight: 900 }}>
                          {x.value != null ? `${x.value}%` : "—"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* SCRAPER + DODATKOWE INFO */}
              <div>
                <div className="label">Dodatkowe informacje o mieszkaniu</div>

                <div className="card" style={{ padding: 12 }}>
                  {/* Źródło + link (w tym samym stylu co reszta informacji) */}
                  <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "160px 1fr",
                        gap: 12,
                        alignItems: "start",
                      }}
                    >
                      <div style={{ color: "var(--muted)", fontWeight: 700, fontSize: 12, paddingTop: 2 }}>
                        Źródło
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <div style={{ fontWeight: 700, lineHeight: 1 }}>{data.source?.scraper ?? "—"}</div>
                        {data.source?.url && (
                          <a
                            className="button button--outline"
                            href={data.source.url}
                            target="_blank"
                            rel="noreferrer"
                            style={{ padding: "6px 10px", borderRadius: 10, fontWeight: 800, fontSize: 12, lineHeight: 1 }}
                          >
                            Strona oferty
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* deskryptory */}
                  {(() => {
                    const poiText = mapPoiDesc(data.poiDesc ?? null);
                    const priceText = mapPriceDesc(data.priceDesc ?? null);
                    const sizeText = mapSizeDesc(data.sizeDesc ?? null);
                    const aptStyle = mapApartmentStyle(data.apartmentStyle ?? null);
                    const ppm2 = typeof data.pricePerM2Pln === "number" ? data.pricePerM2Pln : null;

                    const rows: Array<{ label: string; value: string } | null> = [
                      poiText ? { label: "Usługi", value: poiText } : null,
                      priceText ? { label: "Cena", value: priceText } : null,
                      sizeText ? { label: "Metraż", value: sizeText } : null,
                      aptStyle ? { label: "Styl mieszkania", value: aptStyle } : null,
                      ppm2 != null
                        ? {
                            label: "Cena za m²",
                            value: `${Math.round(ppm2).toLocaleString("pl-PL")} zł/m²`,
                          }
                        : null,
                    ];

                    const visible = rows.filter(Boolean) as Array<{ label: string; value: string }>;
                    if (visible.length === 0) {
                      return <div style={{ color: "var(--muted)" }}>Brak dodatkowych informacji.</div>;
                    }

                    return (
                      <div style={{ display: "grid", gap: 8 }}>
                        {visible.map((r) => (
                          <div
                            key={r.label}
                            style={{
                              display: "grid",
                              gridTemplateColumns: "160px 1fr",
                              gap: 12,
                              alignItems: "start",
                            }}
                          >
                            <div style={{ color: "var(--muted)", fontWeight: 700, fontSize: 12, paddingTop: 2 }}>
                              {r.label}
                            </div>
                            <div style={{ fontWeight: 700, lineHeight: 1.25 }}>{r.value}</div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}

                  <div style={{ marginTop: 12, color: "var(--muted)" }}>
                    {data.description ?? "Opis oferty pojawi się tutaj."}
                  </div>
                </div>
              </div>

              {/* POI (sekundy -> min/sec) */}
              <div>
                <div className="label">Najbliższe usługi w okolicy</div>
                <div style={{ color: "var(--muted)", fontSize: 12, fontWeight: 600, marginTop: -6 }}>
                  oraz czasy dojścia pieszo
                </div>
                <div className="card" style={{ padding: 12, marginTop: 10 }}>
                  {(data.poi ?? []).length === 0 ? (
                    <div style={{ color: "var(--muted)" }}>Brak danych o miejscach w okolicy.</div>
                  ) : (
                    <ul style={{ margin: 0, paddingLeft: 16 }}>
                      {data.poi!.map((p, i) => (
                        <li key={i}>
                          {poiEmoji((p as any).type)} {poiLabelPl((p as any).type)} — {formatSecondsAsMinSec((p as any).distanceM)}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </>
          )}
        </section>

        <aside
          className="card"
          style={{
            display: "grid",
            gridTemplateRows: "auto 1fr",
            gap: 12,
            alignSelf: "start",
            position: "sticky",
            top: 40,
            height: "calc(100vh - 200px)",
            minHeight: 480,
            maxHeight: 900,
          }}
        >
          <div className="label">Mapa</div>
          <div style={{ minHeight: 0 }}>
            <DetailMap listing={listingPoint} poi={poiPoints} />
          </div>
        </aside>
      </div>
    </div>
  );
}
