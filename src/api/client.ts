// src/api/client.ts
import type { Listing, ListingDetails, SearchParams, ProfileType } from "./types";

// Vite: typowanie env bez "any"
const API_BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "https://api.matiko.ovh";

/* ===== Typy zgodne z OpenAPI ===== */

type GeoPointApi = {
  lat: number;
  lng: number;
};

type POIOutApi = {
  id: number;
  category: string;
  geolocation?: GeoPointApi | null;
};

type ApartmentApi = {
  id: number;
  source_website?: string | null;
  source_id?: string | null;
  source_url?: string | null;

  price?: string | number | null;
  currency?: string | null;
  room_num?: number | null;
  footage?: string | number | null;
  price_per_m2?: string | number | null;
  city?: string | null;
  description?: string | null;

  geolocation?: GeoPointApi | null;

  photo_attractiveness?: number | null;
  student_attractiveness?: number | null;
  single_attractiveness?: number | null;
  dog_owner_attractiveness?: number | null;
  universal_attractiveness?: number | null;
  family_attractiveness?: number | null;

  poi_desc?: string | null;
  price_desc?: string | null;
  size_desc?: string | null;
  style?: string | null;

  photo_ids?: number[];
  pois?: POIOutApi[];
};

type PhotoOutApi = {
  apartment_id: number;
  link: string;
  style?: string | null;
  room_type?: string | null;
  room_style?: string | null;
  photo_type?: string | null;
  id: number;
};

type SortDir = "asc" | "desc";

export type ApartmentsSortKey = "price" | "footage" | "attractiveness";

type ListPaging = {
  skip?: number;
  limit?: number;
  sortKey?: ApartmentsSortKey;
  sortDir?: SortDir;
};

/* ===== Mapowania profili ===== */

const searchProfileToBackend: Record<SearchParams["profile"], string> = {
  uniwersalne: "universal",
  rodzina: "family",
  student: "student",
  singiel: "single",
  wlasciciel_psa: "dog_owner",
};

const searchProfileToLabel: Record<SearchParams["profile"], ProfileType> = {
  uniwersalne: "uniwersalny",
  rodzina: "rodzinny",
  student: "studencki",
  singiel: "singiel",
  wlasciciel_psa: "wlasciciel_psa",
};

/* ===== Pomocnicze funkcje ===== */

function buildListUrl(params: SearchParams, paging?: ListPaging): string {
  const url = new URL("/apartments", API_BASE_URL);

  if (params.location) url.searchParams.set("city", params.location);
  if (params.profile) url.searchParams.set("profile", searchProfileToBackend[params.profile]);
  if (params.priceMax != null) url.searchParams.set("max_price", String(params.priceMax));
  if (params.areaMin != null) url.searchParams.set("min_footage", String(params.areaMin));

  // Optional backend sorting (if supported). If the API ignores these params, it will fall back to its default ordering.
  if (paging?.sortKey) url.searchParams.set("sort", paging.sortKey);
  if (paging?.sortDir) url.searchParams.set("order", paging.sortDir);

  url.searchParams.set("skip", String(paging?.skip ?? 0));
  url.searchParams.set("limit", String(paging?.limit ?? 10));

  return url.toString();
}

function buildCountUrl(params: SearchParams): string {
  const url = new URL("/apartments/count", API_BASE_URL);

  if (params.location) url.searchParams.set("city", params.location);
  if (params.priceMax != null) url.searchParams.set("max_price", String(params.priceMax));
  if (params.areaMin != null) url.searchParams.set("min_footage", String(params.areaMin));

  // NOTE: endpoint mirrors GET /apartments filtering; profile is currently NOT listed in docs.
  return url.toString();
}

function toNumberOrZero(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function toNumberOrUndefined(v: string | number | null | undefined): number | undefined {
  if (v === null || v === undefined) return undefined;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}

function buildTitle(a: ApartmentApi): string {
  // Tytuł bez dopisku miasta (miasto pokazujemy osobno jako address)
  if (a.room_num && a.room_num > 0) return `Mieszkanie ${a.room_num}-pokojowe`;
  return "Mieszkanie";
}

function pickProfileLabel(profile?: SearchParams["profile"]): ProfileType | undefined {
  return profile ? searchProfileToLabel[profile] : undefined;
}

function pickAttractivenessScore(a: ApartmentApi, profile?: SearchParams["profile"]): number | undefined {
  if (!profile) return a.universal_attractiveness ?? undefined;

  switch (profile) {
    case "student":
      return a.student_attractiveness ?? undefined;
    case "singiel":
      return a.single_attractiveness ?? undefined;
    case "rodzina":
      return a.family_attractiveness ?? undefined;
    case "wlasciciel_psa":
      return a.dog_owner_attractiveness ?? undefined;
    case "uniwersalne":
      return a.universal_attractiveness ?? undefined;
    default:
      return undefined;
  }
}

// Haversine – odległość w metrach
function distanceMeters(a: GeoPointApi, b: GeoPointApi): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const φ1 = toRad(a.lat);
  const φ2 = toRad(b.lat);
  const Δφ = toRad(b.lat - a.lat);
  const Δλ = toRad(b.lng - a.lng);

  const sinΔφ = Math.sin(Δφ / 2);
  const sinΔλ = Math.sin(Δλ / 2);

  const x = sinΔφ * sinΔφ + Math.cos(φ1) * Math.cos(φ2) * sinΔλ * sinΔλ;
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return R * c;
}

function toPercent0to100(v: number | null | undefined): number | undefined {
  if (v === null || v === undefined) return undefined;
  if (!Number.isFinite(v)) return undefined;
  // Backend might return either 0..1 or 0..100. Normalize to 0..100.
  const scaled = v <= 1 ? v * 100 : v;
  return Math.round(scaled);
}

/* ===== Zdjęcia: cache + fetch ===== */

const photoLinkCache = new Map<number, string | null>();

async function fetchPhotoLink(photoId: number): Promise<string | null> {
  if (!Number.isFinite(photoId)) return null;

  if (photoLinkCache.has(photoId)) {
    return photoLinkCache.get(photoId) ?? null;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/photos/${photoId}`, { method: "GET" });
    if (!res.ok) {
      photoLinkCache.set(photoId, null);
      return null;
    }

    const p: PhotoOutApi = await res.json();
    const link = typeof p.link === "string" && p.link.length > 0 ? p.link : null;
    photoLinkCache.set(photoId, link);
    return link;
  } catch {
    photoLinkCache.set(photoId, null);
    return null;
  }
}

// Prosty limiter równoległości (żeby nie odpalić np. 50 requestów naraz)
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T, idx: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length) as R[];
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const current = nextIndex++;
      results[current] = await mapper(items[current], current);
    }
  }

  const workers = Array.from({ length: Math.max(1, limit) }, () => worker());
  await Promise.all(workers);
  return results;
}

/* ===== Funkcje eksportowane ===== */

export async function fetchListings(params: SearchParams, paging?: ListPaging): Promise<Listing[]> {
  const res = await fetch(buildListUrl(params, paging));
  if (!res.ok) throw new Error(`Błąd API (lista mieszkań) – HTTP ${res.status}`);

  const data: ApartmentApi[] = await res.json();
  const profileLabel = pickProfileLabel(params.profile);

  // miniatury: bierzemy 1. photo_id (jeśli jest) i dociągamy link
  // limit równoległych requestów: 6 (bezpieczne i wystarczająco szybkie)
  return mapWithConcurrency(data, 6, async (a) => {
    const coords =
      a.geolocation && a.geolocation.lat != null && a.geolocation.lng != null
        ? { lat: a.geolocation.lat, lon: a.geolocation.lng }
        : undefined;

    const firstPhotoId =
      Array.isArray(a.photo_ids) && a.photo_ids.length > 0 ? a.photo_ids[0] : undefined;

    const thumb = firstPhotoId != null ? await fetchPhotoLink(firstPhotoId) : null;

    return {
      id: String(a.id),
      title: buildTitle(a),
      pricePln: toNumberOrZero(a.price),
      areaM2: toNumberOrZero(a.footage),
      address: a.city ?? "",
      coords,
      profileType: profileLabel,
      attractivenessScore: pickAttractivenessScore(a, params.profile),
      thumbnailUrl: thumb ?? undefined,
    };
  });
}

export async function fetchApartmentsCount(params: SearchParams): Promise<number> {
  const res = await fetch(buildCountUrl(params));
  if (!res.ok) throw new Error(`Błąd API (count mieszkań) – HTTP ${res.status}`);

  const json = await res.json();
  // backend may return {count: number} or a raw number
  if (typeof json === "number") return json;
  if (json && typeof json.count === "number") return json.count;

  throw new Error("Błędny format odpowiedzi /apartments/count");
}

export async function fetchListingById(id: string): Promise<ListingDetails> {
  const aptRes = await fetch(`${API_BASE_URL}/apartments/${id}`);
  if (!aptRes.ok) throw new Error(`Błąd API (szczegóły mieszkania) – HTTP ${aptRes.status}`);

  const a: ApartmentApi = await aptRes.json();

  const coords =
    a.geolocation && a.geolocation.lat != null && a.geolocation.lng != null
      ? { lat: a.geolocation.lat, lon: a.geolocation.lng }
      : undefined;

  // ===== POI: bierzemy bezpośrednio z /apartments/{id} -> pois =====
  const poi =
    (a.pois ?? [])
      .filter((p) => p.geolocation && p.geolocation.lat != null && p.geolocation.lng != null)
      .map((p) => {
        const poiGeo = p.geolocation!;
        const distanceM =
          coords
            ? distanceMeters(
                { lat: coords.lat, lng: coords.lon },
                { lat: poiGeo.lat, lng: poiGeo.lng }
              )
            : 0;

        return {
          type: p.category,
          name: p.category,
          distanceM,
          coords: { lat: poiGeo.lat, lon: poiGeo.lng },
        };
      }) ?? [];

  // ===== Zdjęcia: photo_ids -> /photos/{id} -> link (+ meta) =====
  const photoIds = Array.isArray(a.photo_ids) ? a.photo_ids : [];

  const photoOut = await mapWithConcurrency(photoIds, 6, async (pid) => {
    if (!Number.isFinite(pid)) return null;

    try {
      const res = await fetch(`${API_BASE_URL}/photos/${pid}`, { method: "GET" });
      if (!res.ok) return null;
      const p: PhotoOutApi = await res.json();
      const url = typeof p.link === "string" && p.link.length > 0 ? p.link : null;
      if (!url) return null;

      return {
        id: Number(p.id ?? pid),
        url,
        photo_type: typeof p.photo_type === "string" ? p.photo_type : null,
        room_type: typeof p.room_type === "string" ? p.room_type : null,
        room_style: typeof p.room_style === "string" ? p.room_style : null,
        style: typeof p.style === "string" ? p.style : null,
      };
    } catch {
      return null;
    }
  });

  const photoItems = photoOut.filter(Boolean) as NonNullable<ListingDetails["photoItems"]>;
  const photoLinks = photoItems.map((x) => x.url);

  const scores = {
    overall: toPercent0to100(a.universal_attractiveness),
    family: toPercent0to100(a.family_attractiveness),
    commute: toPercent0to100(a.student_attractiveness),
    services: toPercent0to100(a.single_attractiveness),
    green: toPercent0to100(a.dog_owner_attractiveness),
  };

  return {
    id: String(a.id ?? id),
    title: buildTitle(a),
    pricePln: toNumberOrZero(a.price),
    areaM2: toNumberOrZero(a.footage),
    address: a.city ?? "—",
    coords,

    profileType: undefined,
    attractivenessScore: a.universal_attractiveness ?? undefined,

    thumbnailUrl: photoLinks[0] ?? undefined,
    photos: photoLinks,
    photoItems,

    description: a.description ?? undefined,
    scores,
    source: {
      scraper: a.source_website ?? undefined,
      url: a.source_url ?? undefined,
    },
    poi,

    // dodatkowe pola z backendu
    poiDesc: a.poi_desc ?? undefined,
    priceDesc: a.price_desc ?? undefined,
    sizeDesc: a.size_desc ?? undefined,
    pricePerM2Pln: toNumberOrUndefined(a.price_per_m2),
    apartmentStyle: a.style ?? undefined,
  };
}
