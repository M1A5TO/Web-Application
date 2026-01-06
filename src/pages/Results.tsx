import { useEffect, useMemo, useRef, useState } from "react";
import { useContext } from "react";
import { fetchListings, fetchApartmentsCount } from "../api/client";
import type { Listing } from "../api/types";
import ListingCard from "../components/ListingCard";
import ResultsMap from "../components/ResultsMap";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { ResultsCacheContext } from "../App";
import type { ResultsSnapshot } from "../App";

type SortKey = "relevance" | "priceAsc" | "priceDesc" | "areaDesc" | "areaAsc";

function isSortKey(x: string | null): x is SortKey {
  return x === "relevance" || x === "priceAsc" || x === "priceDesc" || x === "areaDesc" || x === "areaAsc";
}

function sortKeyToApiSortBy(sort: SortKey): "profile" | "price_desc" | "price_asc" | "footage_desc" | "footage_asc" {
  switch (sort) {
    case "relevance":
      return "profile";
    case "priceAsc":
      return "price_asc";
    case "priceDesc":
      return "price_desc";
    case "areaAsc":
      return "footage_asc";
    case "areaDesc":
      return "footage_desc";
    default:
      return "profile";
  }
}

/** Reverse geocoding (Nominatim) – bez zmian backendu */
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

  if (road && city) return `ul. ${road}${house} • ${city}`;
  if (road) return `ul. ${road}${house}`;
  if (city) return city;

  if (j.display_name) {
    const short = String(j.display_name).split(",").slice(0, 2).join(", ").trim();
    return short || null;
  }

  return null;
}

function buildFallbackLabel(j: NominatimResponse | null, lat: number, lon: number): string {
  const city = j?.address?.city || j?.address?.town || j?.address?.village || j?.address?.municipality || j?.address?.county;
  if (city) return city;
  return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
}

// (cache key helper removed; Results no longer uses sessionStorage caching)

type ResultsNavState = {
  fromResults?: {
    search: string;
    items: Listing[];
    page: number;
    scrollY: number;
    ts: number;
  };
};

type ResultsRestore = {
  key: string;
  items: Listing[];
  page: number;
  scrollY: number;
  ts: number;
  geoById?: Record<string, string>;
};

type ResultsSnapshotsMap = Record<string, ResultsSnapshot>;

function getNavSnapshot(locationState: unknown, search: string) {
  const navState = (locationState ?? null) as ResultsNavState | null;
  const snap = navState?.fromResults;
  if (!snap) return null;
  if (snap.search !== search) return null;
  // TTL 10 min
  if (snap.ts && Date.now() - snap.ts > 10 * 60 * 1000) return null;
  return snap;
}

export default function Results() {
  const locationObj = useLocation();
  const { search } = locationObj;
  const q = new URLSearchParams(search);

  const resultsCache = useContext(ResultsCacheContext);
  // Support multiple snapshots per session keyed by `search` (sort/targetCount included).
  const snapshotsMap = (resultsCache?.snapshot as unknown as ResultsSnapshotsMap | null) ?? null;
  const [sort, setSort] = useState<SortKey>(isSortKey(q.get("sort")) ? (q.get("sort") as SortKey) : "relevance");
  const targetFromUrlRaw = q.get("targetCount");
  const targetFromUrl = targetFromUrlRaw === "ALL" ? Number.MAX_SAFE_INTEGER : Number(targetFromUrlRaw);
  const [targetCount, setTargetCount] = useState<number>(
    Number.isFinite(targetFromUrl) && targetFromUrl > 0 ? targetFromUrl : 100
  );

  // Build the effective search string from current state (used for Link URLs and caching).
  const linkSearch = useMemo(() => {
    const next = new URLSearchParams(search);
    next.set("sort", sort);
    next.set("targetCount", targetCount === Number.MAX_SAFE_INTEGER ? "ALL" : String(targetCount));
    return `?${next.toString()}`;
  }, [search, sort, targetCount]);

  const cachedSnap = snapshotsMap && snapshotsMap[linkSearch] ? (snapshotsMap[linkSearch] as unknown as ResultsRestore) : null;

  // NOTE: We intentionally do NOT invalidate the snapshot on every search change here.
  // The snapshot is keyed by `search` and consumed only when it matches exactly.
  // Clearing it aggressively could race with URL updates and leave the UI empty.

  // Snapshot source (session-only cache preferred; history state as fallback)
  // NOTE: must be synchronous for initial render.
  const navSnap = useMemo(
    () => cachedSnap ?? getNavSnapshot(locationObj.state, linkSearch),
    [cachedSnap, locationObj.state, linkSearch]
  );

  // UI state that must survive history navigation should live in the URL
  const location = q.get("location") ?? "";
  const profile = q.get("profile") ?? "uniwersalne";
  const navigate = useNavigate();

  const profileLabel: Record<string, string> = {
    uniwersalne: "uniwersalny",
    student: "student",
    singiel: "singiel",
    wlasciciel_psa: "właściciel psa",
    rodzina: "rodzinny",
  };

  const priceMax = q.get("priceMax") ? Number(q.get("priceMax")) : undefined;
  const areaMin = q.get("areaMin") ? Number(q.get("areaMin")) : undefined;
  const maxDistanceKm = q.get("maxDistanceKm") ? Number(q.get("maxDistanceKm")) : undefined;

  // Backend sort_by value used for fetching
  const sortBy = useMemo(() => sortKeyToApiSortBy(sort), [sort]);

  // how many offers we want cached client-side
  const [lastLoadedTarget, setLastLoadedTarget] = useState<number>(
    Array.isArray(navSnap?.items) ? navSnap!.items.length : 0
  );
  const [availableCount, setAvailableCount] = useState<number | null>(null);
  const [countError, setCountError] = useState<string | null>(null);
  const [isFetchingMore, setIsFetchingMore] = useState(false);

  const [items, setItems] = useState<Listing[]>(() => (Array.isArray(navSnap?.items) ? (navSnap!.items as Listing[]) : []));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // cache adresów po ID ogłoszenia
  const [geoById, setGeoById] = useState<Record<string, string>>(() => (cachedSnap?.geoById ?? {}));

  // paginacja (client-side over cached items)
  const [page, setPage] = useState(() => (typeof navSnap?.page === "number" ? navSnap!.page : 1));
  const pageSize = 10;

  // cancel/background run guard
  const fetchRunId = useRef(0);

  // one-time hydration from navigation state (back from details)
  const hydratedFromNavRef = useRef(false);
  const skipInitialResetRef = useRef(false);

  // Mark that we came from navigation snapshot as early as possible.
  if (!hydratedFromNavRef.current && navSnap) {
    hydratedFromNavRef.current = true;
    skipInitialResetRef.current = true;
  }

  // NOTE: Results no longer uses sessionStorage caching.
  // We rely on URL-driven state + deterministic backend sorting, and always refetch on changes.
  // This avoids cross-sort/limit cache poisoning. Back navigation is handled by the browser history.

  const hydrated = true;

  // Restore scroll after paint when coming back from details.
  useEffect(() => {
    if (!navSnap) return;
    setLoading(false);
    setError(null);
    // Also restore cached address labels if present.
    if (cachedSnap?.geoById) setGeoById(cachedSnap.geoById);
    requestAnimationFrame(() => {
      window.scrollTo({ top: typeof navSnap.scrollY === "number" ? navSnap.scrollY : 0, behavior: "auto" });
    });
  }, [navSnap, cachedSnap]);

  // reset when filters change (after hydration)
  useEffect(() => {
    if (!hydrated) return;

    // If we just hydrated from navigation state, don't immediately wipe the list on mount.
    if (skipInitialResetRef.current) {
      skipInitialResetRef.current = false;
      return;
    }

    setPage(1);
    setItems([]);
    setLastLoadedTarget(0);
    setGeoById({});
    setError(null);
    setAvailableCount(null);
    setCountError(null);
  }, [hydrated, location, profile, priceMax, areaMin, maxDistanceKm]);

  // When sort changes, we must refetch from scratch (skip/limit depends on order).
  const didMountRef = useRef(false);
  useEffect(() => {
    if (!hydrated) return;

    // On initial mount, `sort` is initialized from the URL; don't treat that as a user change.
    // Also, if we restored a snapshot (cache/history), keep it and don't wipe it here.
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }

    fetchRunId.current++;
    setPage(1);
    setItems([]);
    setLastLoadedTarget(0);
    setGeoById({});
    setError(null);
    setLoading(true);
    setIsFetchingMore(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort]);

  // When targetCount decreases, we should NOT clear items (it would flash "Brak wyników").
  // When targetCount increases beyond what we have, fetching effect will load more.
  useEffect(() => {
    if (!hydrated) return;
    setPage(1);

    // If the user lowered the limit, we can keep the already loaded cache.
    // If they increased it, the fetch effect will kick in naturally.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetCount]);

  // fetch total count for current filters (after hydration)
  useEffect(() => {
    if (!hydrated) return;

    let cancelled = false;

    (async () => {
      try {
        setCountError(null);
        const n = await fetchApartmentsCount({
          location,
          profile: profile as any,
          priceMax,
          areaMin,
          maxDistanceKm,
        });
        if (!cancelled) setAvailableCount(n);
      } catch (e) {
        if (!cancelled) setCountError((e as any)?.message ?? "Błąd pobierania liczby ofert");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hydrated, location, profile, priceMax, areaMin, maxDistanceKm]);

  // progressively load offers up to targetCount (after hydration)
  useEffect(() => {
    if (!hydrated) return;

    const effectiveTarget =
      availableCount != null ? Math.min(targetCount, availableCount) : targetCount;

    // If we restored from navigation state and already have enough, do not refetch.
    if (hydratedFromNavRef.current && items.length > 0 && items.length >= effectiveTarget) {
      setLoading(false);
      setIsFetchingMore(false);
      return;
    }

    // If we have a nav snapshot and already have some items, allow UI immediately.
    // Fetch effect will still run if user targetCount is higher than what we have.

    // Always fetch based on current filters/sort/targetCount. If we already have enough, no-op.

    const myRun = ++fetchRunId.current;
    let cancelled = false;

    async function run() {
      // if we already have enough cached, nothing to do
      if (items.length >= effectiveTarget) {
        setLoading(false);
        setIsFetchingMore(false);
        setLastLoadedTarget(Math.max(lastLoadedTarget, items.length));
        return;
      }

      setLoading(items.length === 0);
      setIsFetchingMore(true);

      try {
        const batchSize = 100; // API default, fewer roundtrips
        let loaded = items.length;

        while (!cancelled && fetchRunId.current === myRun && loaded < effectiveTarget) {
          const skip = loaded;
          const limit = Math.min(batchSize, effectiveTarget - loaded);

          const batch = await fetchListings(
            {
              location,
              profile: profile as any,
              priceMax,
              areaMin,
              maxDistanceKm,
            },
            { skip, limit, sortBy }
          );

          if (cancelled || fetchRunId.current !== myRun) return;

          if (batch.length === 0) {
            // no more records available
            break;
          }

          // append unique-by-id (defensive)
          let appended = 0;
          setItems((prev) => {
            const seen = new Set(prev.map((x) => x.id));
            const merged = [...prev];
            for (const b of batch) {
              if (!seen.has(b.id)) {
                merged.push(b);
                appended++;
              }
            }
            return merged;
          });

          loaded += Math.max(appended, batch.length);
          setLastLoadedTarget((prev) => Math.max(prev, loaded));

          if (batch.length < limit) break;

          await new Promise((r) => setTimeout(r, 0));
        }
      } catch (e) {
        if (!cancelled && fetchRunId.current === myRun) {
          setError((e as any)?.message ?? "Błąd nieznany");
        }
      } finally {
        if (!cancelled && fetchRunId.current === myRun) {
          setLoading(false);
          setIsFetchingMore(false);
        }
      }
    }

    run();

    return () => {
      cancelled = true;
    };
    // re-run when targetCount or filters change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, targetCount, availableCount, location, profile, priceMax, areaMin, maxDistanceKm, lastLoadedTarget]);

  // Keep URL in sync with UI state (so browser Back/Forward restores correctly)
  useEffect(() => {
    if (!hydrated) return;

    // Keep the URL in sync immediately so Links use the correct query string.
    if (linkSearch !== search) {
      navigate({ pathname: "/results", search: linkSearch }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, linkSearch, search]);

  // Sorting is done by backend (sort_by). Keep item order as provided by API.
  // When user selects a lower targetCount, just limit the visible list.
  const effectiveTargetForDisplay =
    availableCount != null ? Math.min(targetCount, availableCount) : targetCount;
  const sorted = items.slice(0, Math.max(0, effectiveTargetForDisplay));

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const pageItems = sorted.slice(start, end);

  function goToPage(p: number) {
    const next = Math.max(1, Math.min(totalPages, p));
    setPage(next);
    // UX: po zmianie strony wracamy do góry listy
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  type PagerToken = number | "ellipsis";

  function buildPagerTokens(current: number, total: number): PagerToken[] {
    if (total <= 1) return [1];

    // For small totals show everything
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

    const tokens: PagerToken[] = [];
    const push = (t: PagerToken) => {
      if (tokens.length === 0 || tokens[tokens.length - 1] !== t) tokens.push(t);
    };

    const addRange = (a: number, b: number) => {
      for (let i = a; i <= b; i++) push(i);
    };

    // Always show first
    push(1);

    // Window around current
    const left = Math.max(2, current - 1);
    const right = Math.min(total - 1, current + 1);

    if (left > 2) push("ellipsis");
    addRange(left, right);
    if (right < total - 1) push("ellipsis");

    // Always show last
    push(total);

    return tokens;
  }

  const pagerTokens = useMemo(() => buildPagerTokens(page, totalPages), [page, totalPages]);

  // Reverse geocoding dla bieżącej strony (tylko brakujące ID, z cache)
  // - retry (czasem Nominatim zwraca pusto / throttling)
  // - fallback: miasto z response albo same koordynaty
  useEffect(() => {
    const ctrl = new AbortController();

    const missing = pageItems.filter((l) => l.coords && !geoById[l.id]);
    if (missing.length === 0) return () => ctrl.abort();

    let cancelled = false;

    async function reverseOne(l: Listing) {
      if (!l.coords) return;
      const { lat, lon } = l.coords;

      const zoom = 16; // slightly lower zoom => more stable city/road results
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
        lat
      )}&lon=${encodeURIComponent(lon)}&zoom=${zoom}&addressdetails=1`;

      for (let attempt = 0; attempt < 3; attempt++) {
        if (cancelled) return;
        try {
          const res = await fetch(url, {
            signal: ctrl.signal,
            headers: {
              Accept: "application/json",
              "Accept-Language": "pl",
            },
          });

          if (res.status === 429) {
            await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
            continue;
          }

          if (!res.ok) {
            await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
            continue;
          }

          const json = (await res.json()) as NominatimResponse;
          const label = buildStreetLabelFromNominatim(json) ?? buildFallbackLabel(json, lat, lon);
          setGeoById((prev) => (prev[l.id] ? prev : { ...prev, [l.id]: label }));
          return;
        } catch (e) {
          if ((e as any)?.name === "AbortError") return;
          await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
        }
      }

      // last resort: coords
      setGeoById((prev) => (prev[l.id] ? prev : { ...prev, [l.id]: `${lat.toFixed(5)}, ${lon.toFixed(5)}` }));
    }

    (async () => {
      // simple concurrency limit = 2
      const queue = [...missing];
      const workers = Array.from({ length: Math.min(2, queue.length) }, async () => {
        while (!cancelled && queue.length > 0) {
          const l = queue.shift()!;
          await reverseOne(l);
          await new Promise((r) => setTimeout(r, 180));
        }
      });

      await Promise.all(workers);
    })();

    return () => {
      cancelled = true;
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageItems, geoById]);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {/* Górny pasek wyników */}
      <div className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 900 }}>Wyniki</div>
          <div style={{ color: "var(--muted)", fontSize: 12, lineHeight: 1.35 }}>
            Lokalizacja: {location || "—"} • Profil: {profileLabel[profile] ?? profile}
            {priceMax ? ` • Cena ≤ ${Number(priceMax).toLocaleString("pl-PL")} PLN` : ""}
            {areaMin ? ` • Metraż ≥ ${areaMin} m²` : ""}
            {/* maxDistanceKm removed from UI but kept for backward compatibility */}
          </div>
          <div
            style={{
              color: "var(--muted)",
              fontSize: 12,
              marginTop: 4,
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <span>
              Wczytane oferty:&nbsp;<b style={{ color: "var(--text)" }}>{sorted.length}</b>
            </span>

            {availableCount != null ? (
              <span>
                Dostępne oferty:&nbsp;<b style={{ color: "var(--text)" }}>{availableCount}</b>
              </span>
            ) : null}

            {countError ? <span style={{ color: "#fca5a5" }}>• {countError}</span> : null}
            {isFetchingMore ? (
              <>
                <span>• wczytywanie ofert…</span>
                <img
                  src="/M1A5TO.png"
                  alt="Wczytywanie"
                  style={{ width: 14, height: 14, animation: "spin 1.2s linear infinite" }}
                />
              </>
            ) : null}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 14, color: "var(--muted)", fontWeight: 600 }}>Oferty:</span>
            <select
              value={String(targetCount)}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "ALL") setTargetCount(Number.MAX_SAFE_INTEGER);
                else setTargetCount(Number(v));
              }}
              className="select"
              style={{ minWidth: 160 }}
              title="Ile ofert wczytać do sortowania i przeglądania"
            >
              <option value={100}>100</option>
              <option value={250}>250</option>
              <option value={500}>500</option>
              <option value={1000}>1000</option>
              <option value="ALL">Wszystkie</option>
            </select>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 14, color: "var(--muted)", fontWeight: 600 }}>Sortowanie:</span>
            <select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value as SortKey);
                setPage(1);
              }}
              className="select"
              style={{ minWidth: 210 }}
            >
              <option value="relevance">Atrakcyjność (wybrany profil)</option>
              <option value="priceAsc">Cena rosnąco</option>
              <option value="priceDesc">Cena malejąco</option>
              <option value="areaDesc">Powierzchnia malejąco</option>
              <option value="areaAsc">Powierzchnia rosnąco</option>
            </select>
          </div>
        </div>

        <style>
          {`@keyframes spin { to { transform: rotate(360deg); } }`}
        </style>
      </div>

      {loading && (
        <div
          className="card"
          style={{
            display: "grid",
            placeItems: "center",
            textAlign: "center",
            gap: 12,
            padding: 28,
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)" }}>Wczytywanie ofert…</div>
          <img
            src="/M1A5TO.png"
            alt="Wczytywanie"
            style={{
              width: 56,
              height: 56,
              animation: "spin 1.2s linear infinite",
              filter: "drop-shadow(0 6px 16px rgba(0,0,0,.35))",
            }}
          />
        </div>
      )}
      {!loading && error && <div style={{ color: "#b91c1c" }}>Błąd: {error}</div>}
      {!loading && !error && sorted.length === 0 && <small>Brak wyników.</small>}

      {/* Główny układ: lista + mapa (pokazujemy dopiero po wczytaniu) */}
      {!loading && sorted.length > 0 ? (
        <div
          className="grid-results"
          style={{
            gridTemplateColumns: "1fr 1fr",
            alignItems: "start",
            gap: 12,
          }}
        >
          {/* lewa kolumna – lista */}
          <div style={{ display: "grid", gap: 12 }}>
            {pageItems.map((l, idx) => {
              const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
              const markerLabel = idx < letters.length ? letters[idx] : `#${idx + 1}`;

              return (
                <Link
                  key={l.id}
                  to={`/listing/${l.id}${linkSearch}`}
                  style={{ textDecoration: "none", color: "inherit" }}
                  state={{
                    fromResults: {
                      search: linkSearch,
                      items,
                      page,
                      scrollY: window.scrollY,
                      ts: Date.now(),
                    },
                  }}
                  onClickCapture={() => {
                    // Persist snapshot for *this* exact results URL (search includes sort/targetCount).
                    const snap: ResultsSnapshot = {
                      key: linkSearch,
                      items,
                      page,
                      scrollY: window.scrollY,
                      ts: Date.now(),
                      geoById,
                    };

                    if (!resultsCache) return;
                    const current = (resultsCache.snapshot as unknown as ResultsSnapshotsMap | null) ?? {};
                    resultsCache.setSnapshot({
                      ...current,
                      [linkSearch]: snap,
                    } as unknown as any);
                  }}
                >
                  {/* Prevent nested anchors: ListingCard can render an <a> to Google Maps. */}
                  <ListingCard
                    listing={l}
                    markerLabel={markerLabel}
                    locationLabel={geoById[l.id]}
                    disableInternalLinks
                  />
                </Link>
              );
            })}

            {totalPages > 1 && (
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  marginTop: 4,
                  flexWrap: "wrap",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                aria-label="Paginacja"
              >
                {/* prev */}
                <button
                  type="button"
                  onClick={() => goToPage(page - 1)}
                  disabled={page === 1}
                  title="Poprzednia strona"
                  aria-label="Poprzednia strona"
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 999,
                    display: "grid",
                    placeItems: "center",
                    background: page === 1 ? "rgba(15,23,42,0.25)" : "rgba(15,23,42,0.35)",
                    border: "1px solid rgba(139,92,246,0.35)",
                    color: page === 1 ? "rgba(154,164,178,0.55)" : "rgba(229,231,235,0.85)",
                    cursor: page === 1 ? "not-allowed" : "pointer",
                    opacity: page === 1 ? 0.75 : 1,
                    fontWeight: 700,
                    fontSize: 16,
                    lineHeight: 1,
                  }}
                >
                  ‹
                </button>

                {/* numbers */}
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {pagerTokens.map((t, i) => {
                    if (t === "ellipsis") {
                      return (
                        <span key={`e-${i}`} style={{ color: "var(--muted)", padding: "0 4px" }}>
                          …
                        </span>
                      );
                    }

                    const isActive = t === page;

                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => goToPage(t)}
                        aria-current={isActive ? "page" : undefined}
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 999,
                          display: "grid",
                          placeItems: "center",
                          fontSize: 12,
                          fontWeight: 800,
                          color: "white",
                          cursor: isActive ? "default" : "pointer",
                          background: isActive
                            ? "linear-gradient(135deg, rgba(109,40,217,.9) 0%, rgba(139,92,246,.85) 100%)"
                            : "rgba(15,23,42,0.4)",
                          border: isActive
                            ? "1px solid rgba(139,92,246,0.85)"
                            : "1px solid rgba(139,92,246,0.45)",
                          boxShadow: isActive ? "0 8px 24px rgba(109,40,217,.35)" : "none",
                          opacity: isActive ? 1 : 0.95,
                        }}
                        disabled={isActive}
                        title={`Strona ${t}`}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>

                {/* next */}
                <button
                  type="button"
                  onClick={() => goToPage(page + 1)}
                  disabled={page >= totalPages}
                  title="Następna strona"
                  aria-label="Następna strona"
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 999,
                    display: "grid",
                    placeItems: "center",
                    background: page >= totalPages ? "rgba(15,23,42,0.25)" : "rgba(15,23,42,0.35)",
                    border: "1px solid rgba(139,92,246,0.35)",
                    color: page >= totalPages ? "rgba(154,164,178,0.55)" : "rgba(229,231,235,0.85)",
                    cursor: page >= totalPages ? "not-allowed" : "pointer",
                    opacity: page >= totalPages ? 0.75 : 1,
                    fontWeight: 700,
                    fontSize: 16,
                    lineHeight: 1,
                  }}
                >
                  ›
                </button>
              </div>
            )}
          </div>

          {/* prawa kolumna – mapa */}
          <div
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
              maxHeight: 700,
            }}
          >
            <div className="label" style={{ marginBottom: 0 }}>
              Mapa
            </div>

            <ResultsMap
              markers={pageItems
                .filter((x) => x.coords)
                .map((x, idx) => {
                  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
                  const label = idx < letters.length ? letters[idx] : `#${idx + 1}`;

                  return {
                    id: x.id,
                    lat: x.coords!.lat,
                    lon: x.coords!.lon,
                    title: x.title,
                    label,
                  };
                })}
              onMarkerClick={(id) => {
                navigate(`/listing/${id}${linkSearch}`);
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
