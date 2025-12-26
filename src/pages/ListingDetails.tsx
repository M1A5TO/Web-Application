import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { fetchListingById } from "../api/client";
import type { ListingDetails } from "../api/types";
import DetailMap from "../components/DetailMap";

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

  convenience: "Sklep (convenience)",
  supermarket: "Supermarket",
  bakery: "Piekarnia",
  pharmacy: "Apteka",
  parcel_locker: "Paczkomat",

  school: "Szkoła",
  kinder_childcare: "Przedszkole / opieka",
  university: "Uczelnia",
  library: "Biblioteka",

  clinic_hospital: "Przychodnia / szpital",
  fitness_centre: "Siłownia / fitness",

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
type PhotoApi = {
  id?: number;
  link?: string;
  photo_type?: string | null;
  room_type?: string | null;
  room_style?: string | null;
  style?: string | null;
};

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

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let idx = 0;

  const runners = Array.from({ length: Math.max(1, concurrency) }).map(async () => {
    while (true) {
      const my = idx++;
      if (my >= items.length) break;
      out[my] = await worker(items[my]);
    }
  });

  await Promise.all(runners);
  return out;
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
  "sypialnia dziecieca": "sypialnia dziecięca",
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

function prettyRoomType(x?: string | null): string | null {
  const raw = (x ?? "").trim();
  if (!raw) return null;
  const key = raw.toLowerCase();
  return ROOM_TYPE_PL[key] ?? raw;
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
  return STYLE_PL[key] ?? raw;
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

export default function ListingDetailsPage() {
  const { id = "" } = useParams();
  const { search } = useLocation();
  const navigate = useNavigate();

  const [data, setData] = useState<ListingDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [geoLabel, setGeoLabel] = useState<string | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);

  const [styleLabel, setStyleLabel] = useState<string | null>(null);
  const [galleryItems, setGalleryItems] = useState<GalleryItem[] | null>(null);

  const [hoveredPhoto, setHoveredPhoto] = useState<number | null>(null);

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

  // Dociąganie: apartament (style + photo_ids) oraz photos (link + photo_type + room_type + room_style)
  useEffect(() => {
    if (!id) return;

    const ctrl = new AbortController();

    // null = ładowanie w toku / brak próby; [] = załadowane, ale pusto
    setStyleLabel(null);
    setGalleryItems(null);

    const bases = getApiBases();
    const aptPaths = ["/apartments", "/apartaments"]; // obsłuż obie wersje
    const photoPaths = ["/photos"];

    (async () => {
      try {
        const aptUrls = bases.flatMap((b) => aptPaths.map((p) => joinUrl(b, `${p}/${encodeURIComponent(id)}`)));
        const apt = await tryFetchFirst<ApartmentApi>(aptUrls, ctrl.signal);

        const aptStyle = prettyStyle(typeof apt.style === "string" ? apt.style : null);
        setStyleLabel(aptStyle);

        const ids = Array.isArray(apt.photo_ids)
          ? apt.photo_ids.map((x) => Number(x)).filter((x) => Number.isFinite(x))
          : [];

        if (!ids.length) {
          setGalleryItems([]);
          return;
        }

        const items = await mapWithConcurrency(ids, 6, async (pid) => {
          const photoUrls = bases.flatMap((b) =>
            photoPaths.map((p) => joinUrl(b, `${p}/${encodeURIComponent(String(pid))}`))
          );

          try {
            const ph = await tryFetchFirst<PhotoApi>(photoUrls, ctrl.signal);
            const url = typeof ph.link === "string" ? ph.link : "";
            if (!url) return null;

            return {
              id: Number(ph.id ?? pid),
              url,
              photo_type: typeof ph.photo_type === "string" ? ph.photo_type : null,
              room_type: typeof ph.room_type === "string" ? ph.room_type : null,
              room_style: typeof ph.room_style === "string" ? ph.room_style : null,
              style: typeof ph.style === "string" ? ph.style : null,
            } as GalleryItem;
          } catch {
            return null;
          }
        });

        // zachowujemy kolejność photo_ids
        const clean = items.filter(Boolean) as GalleryItem[];
        setGalleryItems(clean);
      } catch (e) {
        if ((e as any)?.name === "AbortError") return;
        // finalnie: nie blokuj UI – pozwól spadać na data.photos
        setStyleLabel(null);
        setGalleryItems([]);
      }
    })();

    return () => ctrl.abort();
  }, [id]);

  /** Punkt mieszkania do mapy */
  const listingPoint = useMemo(() => {
    if (!data?.coords) return undefined;
    return { lat: data.coords.lat, lon: data.coords.lon, title: data.title };
  }, [data?.coords, data?.title]);

  /** Punkty POI do mapy (stara logika) */
  const poiPoints = useMemo(() => {
    return (data?.poi ?? [])
      .filter((p) => !!(p as any).coords)
      .map((p: any) => ({
        lat: p.coords.lat,
        lon: p.coords.lon,
        name: p.name,
        type: p.type,
      }));
  }, [data?.poi]);

  /** Galeria: preferuj photo_ids->photos, fallback do data.photos (stringi) */
  const gallery = useMemo(() => {
    // galleryItems === null => jeszcze ładujemy
    if (galleryItems !== null && galleryItems.length > 0) return galleryItems;

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

    return fallback;
  }, [galleryItems, data]);

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
          <div style={{ color: "var(--muted)", fontSize: 12 }}>{data?.address ?? ""}</div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button className="button" onClick={() => navigate(-1)}>
            ← Wróć
          </button>
          <Link className="button" to={`/results${search}`}>
            Wróć do wyników
          </Link>
        </div>
      </div>

      <div className="grid-results" style={{ gridTemplateColumns: "1fr 1fr", alignItems: "stretch" }}>
        <section className="card" style={{ display: "grid", gap: 16 }}>
          {loading && <div>Ładowanie…</div>}
          {error && <div style={{ color: "#fca5a5" }}>Błąd: {error}</div>}

          {!loading && !error && data && (
            <>
              <div>
                <div style={{ color: "var(--muted)" }}>{data.address}</div>

                <div style={{ marginTop: 6, display: "flex", gap: 14, alignItems: "baseline", flexWrap: "wrap" }}>
                  <div style={{ fontSize: 18, fontWeight: 900 }}>
                    {data.pricePln?.toLocaleString("pl-PL") ?? "—"} PLN
                  </div>
                  <div style={{ fontWeight: 700 }}>{data.areaM2 ?? "—"} m²</div>

                  {data.coords && (
                    <div style={{ color: "var(--muted)" }}>
                      <small>Lokalizacja:&nbsp;</small>
                      {geoLabel ? (
                        <span style={{ fontWeight: 600 }}>{geoLabel}</span>
                      ) : geoLoading ? (
                        <span>ustalanie…</span>
                      ) : (
                        <code>
                          {data.coords.lat.toFixed(5)}, {data.coords.lon.toFixed(5)}
                        </code>
                      )}

                      {styleLabel && (
                        <div style={{ marginTop: 4, color: "var(--muted)", fontSize: 12 }}>
                          <small>Styl:&nbsp;</small>
                          <span style={{ fontWeight: 700 }}>{styleLabel}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* ZDJĘCIA */}
              <div>
                <div className="label">Podgląd</div>

                {galleryItems === null && (
                  <div style={{ color: "var(--muted)", fontSize: 12, marginBottom: 8 }}>Ładowanie metadanych zdjęć…</div>
                )}

                {gallery.length > 0 ? (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                    {gallery.slice(0, 9).map((ph, i) => {
                      const label = buildPhotoHoverLabel(ph);

                      return (
                        <a
                          key={`${ph.id}-${ph.url}-${i}`}
                          href={ph.url}
                          target="_blank"
                          rel="noreferrer"
                          style={{ display: "block" }}
                          title={label}
                          onMouseEnter={() => setHoveredPhoto(i)}
                          onMouseLeave={() => setHoveredPhoto(null)}
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
                                border: "1px solid var(--border)",
                                background: "var(--panel-2)",
                                display: "block",
                              }}
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).style.display = "none";
                              }}
                            />

                            {/* Overlay po hover: zawsze pokazuj (widoczny nawet gdy meta nie przyszła) */}
                            {hoveredPhoto === i && (
                              <div
                                style={{
                                  pointerEvents: "none",
                                  position: "absolute",
                                  left: 8,
                                  right: 8,
                                  bottom: 8,
                                  padding: "6px 10px",
                                  borderRadius: 999,
                                  fontSize: 12,
                                  fontWeight: 800,
                                  background: "rgba(15,23,42,.78)",
                                  border: "1px solid rgba(255,255,255,.14)",
                                  color: "white",
                                  backdropFilter: "blur(6px)",
                                  WebkitBackdropFilter: "blur(6px)",
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                              >
                                {label}
                              </div>
                            )}
                          </div>
                        </a>
                      );
                    })}
                  </div>
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

              {/* ALG-ROZ */}
              <div>
                <div className="label">Info z alg-roz</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                  {["Ogólna", "Dojazdy", "Zieleń", "Usługi"].map((k, i) => (
                    <div key={k} className="card" style={{ padding: 12 }}>
                      <div style={{ color: "var(--muted)", fontSize: 12 }}>{k}</div>
                      <div style={{ fontSize: 18, fontWeight: 800 }}>
                        {Math.round(((data.scores?.overall ?? 0.7) + i * 0.03) * 100)}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* SCRAPER */}
              <div>
                <div className="card" style={{ padding: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    <div>
                      <div>Źródło: {data.source?.scraper ?? "—"}</div>
                    </div>

                    {data.source?.url && (
                      <a
                        className="button"
                        href={data.source.url}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          padding: "10px 14px",
                          borderRadius: 12,
                          fontWeight: 800,
                          textTransform: "uppercase",
                          letterSpacing: ".06em",
                          fontSize: 12,
                          whiteSpace: "nowrap",
                        }}
                      >
                        WYŚWIETL OFERTĘ
                      </a>
                    )}
                  </div>

                  <div style={{ marginTop: 10, color: "var(--muted)" }}>
                    {data.description ?? "Opis oferty pojawi się tutaj."}
                  </div>
                </div>
              </div>

              {/* POI (sekundy -> min/sec) */}
              <div>
                <div className="label">Najbliższe miejsca w okolicy</div>
                <div className="card" style={{ padding: 12 }}>
                  {(data.poi ?? []).length === 0 ? (
                    <div style={{ color: "var(--muted)" }}>Brak danych o miejscach w okolicy.</div>
                  ) : (
                    <ul style={{ margin: 0, paddingLeft: 16 }}>
                      {data.poi!.map((p, i) => (
                        <li key={i}>
                          {poiEmoji((p as any).type)} {poiLabelPl((p as any).type)} —{" "}
                          {formatSecondsAsMinSec((p as any).distanceM)}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </>
          )}
        </section>

        <aside className="card" style={{ display: "grid", gridTemplateRows: "auto 1fr", gap: 12 }}>
          <div className="label">Mapa</div>
          <div style={{ minHeight: 820 }}>
            <DetailMap listing={listingPoint} poi={poiPoints} />
          </div>
        </aside>
      </div>
    </div>
  );
}
