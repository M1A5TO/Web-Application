import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { fetchListings, fetchApartmentsCount } from "../api/client";
import type { Listing } from "../api/types";
import ListingCard from "../components/ListingCard";
import ResultsMap from "../components/ResultsMap";
import { useLocation, useNavigate, Link } from "react-router-dom";

type SortKey = "relevance" | "priceAsc" | "priceDesc" | "areaDesc" | "areaAsc";

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

function buildCanonicalResultsKey(search: string): string {
  const q = new URLSearchParams(search);

  // normalize known params
  const get = (k: string) => (q.get(k) ?? "").trim();
  const normNum = (k: string) => {
    const v = get(k);
    if (!v) return "";
    const n = Number(v);
    return Number.isFinite(n) ? String(n) : v;
  };

  const parts: Array<[string, string]> = [
    ["location", get("location")],
    ["profile", get("profile")],
    ["priceMax", normNum("priceMax")],
    ["areaMin", normNum("areaMin")],
    ["maxDistanceKm", normNum("maxDistanceKm")],
  ];

  // stable order + omit empties
  const encoded = parts
    .filter(([, v]) => v !== "")
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&");

  return `resultsState:v1:${encoded}`;
}

export default function Results() {
  const { search } = useLocation();
  const q = new URLSearchParams(search);

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

  const [sort, setSort] = useState<SortKey>("relevance");

  // how many offers we want cached client-side
  const [targetCount, setTargetCount] = useState<number>(100);
  const [lastLoadedTarget, setLastLoadedTarget] = useState<number>(0);
  const [availableCount, setAvailableCount] = useState<number | null>(null);
  const [countError, setCountError] = useState<string | null>(null);
  const [isFetchingMore, setIsFetchingMore] = useState(false);

  const [items, setItems] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // cache adresów po ID ogłoszenia
  const [geoById, setGeoById] = useState<Record<string, string>>({});

  // paginacja (client-side over cached items)
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // cancel/background run guard
  const fetchRunId = useRef(0);

  // persist/restore key per filters (canonicalized)
  const stateKey = useMemo(() => buildCanonicalResultsKey(search), [search]);
  const legacyKey = useMemo(() => `resultsState:${search}`, [search]);
  // NOTE: avoid a global fallback cache; it can restore unrelated queries and "poison" the UI.

  // whether we have attempted restoring state for this query (gates effects)
  const [hydrated, setHydrated] = useState(false);

  // remember if we restored from cache (skip initial fetch)
  const restoredRef = useRef(false);

  // If we have a cached state for this query (even if items are empty), don't immediately kick off a new run.
  // This prevents "restore skipped (no items)" -> refetch loop when an earlier empty save exists.
  const restoredAnyRef = useRef(false);

  // Keep track if we've ever saved a non-empty items cache for this key.
  const hasNonEmptyCacheRef = useRef(false);

  const DEBUG = (import.meta as any).env?.DEV === true;

  // restore cached state on first mount for this query (before paint)
  useLayoutEffect(() => {
    restoredRef.current = false;
    restoredAnyRef.current = false;
    setHydrated(false);

    try {
      const raw = sessionStorage.getItem(stateKey) || sessionStorage.getItem(legacyKey);

      if (DEBUG) {
        console.log("[Results] restore", {
          search,
          stateKey,
          legacyKey,
          hasStateKey: !!sessionStorage.getItem(stateKey),
          hasLegacyKey: !!sessionStorage.getItem(legacyKey),
          rawBytes: raw ? raw.length : 0,
        });
      }

      if (!raw) {
        // No cached state for this query -> show loading and allow fetch effect to run.
        setLoading(true);
        setHydrated(true);
        return;
      }

      const parsed = JSON.parse(raw) as any;
      restoredAnyRef.current = true;

      if (DEBUG) {
        console.log("[Results] parsed", {
          itemsLen: Array.isArray(parsed?.items) ? parsed.items.length : null,
          page: parsed?.page,
          sort: parsed?.sort,
          targetCount: parsed?.targetCount,
          availableCount: parsed?.availableCount,
          ts: parsed?.ts,
        });
      }

      if (Array.isArray(parsed?.items) && parsed.items.length > 0) {
        hasNonEmptyCacheRef.current = true;
      }

      // TTL: 10 minutes (avoid very stale cache)
      const ts = typeof parsed.ts === "number" ? parsed.ts : 0;
      if (ts && Date.now() - ts > 10 * 60 * 1000) {
        sessionStorage.removeItem(stateKey);
        sessionStorage.removeItem(legacyKey);
        setLoading(true);
        setHydrated(true);
        return;
      }

      // Restore even if items array is empty (it's still useful for paging/sort/targetCount/scroll).
      if (Array.isArray(parsed.items)) {
        setItems(parsed.items);
        setLastLoadedTarget(Array.isArray(parsed.items) ? parsed.items.length : 0);
        setPage(typeof parsed.page === "number" ? parsed.page : 1);
        setSort((parsed.sort as SortKey) ?? "relevance");
        setTargetCount(typeof parsed.targetCount === "number" ? parsed.targetCount : 100);
        // allow 0 too
        setAvailableCount(
          typeof parsed.availableCount === "number" ? parsed.availableCount : null
        );
        setGeoById(parsed.geoById ?? {});
        setError(null);
        setCountError(null);

        if (parsed.items.length > 0) {
          setLoading(false);
          setIsFetchingMore(false);
          restoredRef.current = true;
        } else {
          // Empty cache -> treat as no cache (fetch will run)
          setLoading(true);
        }

        if (DEBUG) {
          console.log("[Results] restored state (any)", {
            itemsLen: parsed.items.length,
            restored: restoredRef.current,
          });
        }

        const y = typeof parsed.scrollY === "number" ? parsed.scrollY : 0;
        // restore scroll synchronously as we are in layout effect
        window.scrollTo({ top: y, behavior: "auto" });
      } else {
        if (DEBUG) {
          console.log("[Results] restore skipped (items missing)");
        }
        setLoading(true);
      }
    } catch (e) {
      if (DEBUG) console.warn("[Results] restore error", e);
      setLoading(true);
    } finally {
      setHydrated(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateKey, legacyKey]);

  // save state helper (debounced-ish)
  const saveTimer = useRef<number | null>(null);
  function saveState(scrollY?: number, opts?: { forceStateKey?: boolean }) {
    try {
      const payload = {
        items,
        page,
        sort,
        targetCount,
        availableCount,
        geoById,
        scrollY: typeof scrollY === "number" ? scrollY : window.scrollY,
        ts: Date.now(),
      };
      const raw = JSON.stringify(payload);

      const itemsLen = items.length;

      // Never overwrite a good (non-empty) cache with an empty one.
      const shouldWriteStateKey =
        opts?.forceStateKey === true || itemsLen > 0;

      if (shouldWriteStateKey) {
        sessionStorage.setItem(stateKey, raw);
        if (itemsLen > 0) hasNonEmptyCacheRef.current = true;
      }

      if (DEBUG) {
        console.log("[Results] saved", {
          stateKey,
          wroteStateKey: shouldWriteStateKey,
          itemsLen,
          page,
          sort,
          targetCount,
          availableCount,
          scrollY: typeof scrollY === "number" ? scrollY : window.scrollY,
        });
      }
    } catch (e) {
      if (DEBUG) console.warn("[Results] save error", e);
    }
  }

  // save periodically when state changes (avoid hammering storage)
  useEffect(() => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => saveState(), 250);
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, page, sort, targetCount, availableCount, geoById, stateKey]);

  // save on unmount / pagehide (back navigation)
  useEffect(() => {
    const onPageHide = () => saveState();
    window.addEventListener("pagehide", onPageHide);
    return () => {
      saveState();
      window.removeEventListener("pagehide", onPageHide);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateKey]);

  // reset when filters change (after hydration)
  useEffect(() => {
    if (!hydrated) return;
    // If we restored from cache for the same query, don't wipe state.
    if (restoredRef.current) return;

    setPage(1);
    setItems([]);
    setLastLoadedTarget(0);
    setGeoById({});
    setError(null);
    setAvailableCount(null);
    setCountError(null);
  }, [hydrated, location, profile, priceMax, areaMin, maxDistanceKm]);

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

    // If we restored, only skip fetching when we already have enough items for the current target.
    // Otherwise allow loading more when the user increases targetCount.
    if (restoredRef.current && items.length > 0) {
      const effectiveTarget =
        availableCount != null ? Math.min(targetCount, availableCount) : targetCount;
      if (items.length >= effectiveTarget) {
        if (DEBUG) console.log("[Results] skip fetch (restored, enough items)", { itemsLen: items.length, effectiveTarget });
        setLoading(false);
        setIsFetchingMore(false);
        return;
      }
    }

    const myRun = ++fetchRunId.current;
    let cancelled = false;

    async function run() {
      const effectiveTarget =
        availableCount != null ? Math.min(targetCount, availableCount) : targetCount;

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
            { skip, limit }
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

  const sorted = useMemo(() => {
    if (sort === "relevance") return items; // preserve API order

    const copy = [...items];
    if (sort === "priceAsc") copy.sort((a, b) => a.pricePln - b.pricePln);
    if (sort === "priceDesc") copy.sort((a, b) => b.pricePln - a.pricePln);
    if (sort === "areaDesc") copy.sort((a, b) => b.areaM2 - a.areaM2);
    if (sort === "areaAsc") copy.sort((a, b) => a.areaM2 - b.areaM2);
    return copy;
  }, [items, sort]);

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
  useEffect(() => {
    const ctrl = new AbortController();

    (async () => {
      for (const l of pageItems) {
        if (!l.coords) continue;
        if (geoById[l.id]) continue; // już mamy

        try {
          const url =
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(l.coords.lat)}&lon=${encodeURIComponent(
              l.coords.lon
            )}&zoom=18&addressdetails=1`;

          const res = await fetch(url, {
            signal: ctrl.signal,
            headers: { Accept: "application/json" },
          });

          if (!res.ok) continue;

          const json = (await res.json()) as NominatimResponse;
          const label = buildStreetLabelFromNominatim(json);

          if (label) {
            setGeoById((prev) => (prev[l.id] ? prev : { ...prev, [l.id]: label }));
          }
        } catch (e) {
          if ((e as any)?.name === "AbortError") return;
          // ignorujemy błędy – fallback pozostaje w karcie
        }

        // delikatne „oddechy” dla Nominatim (żeby nie walić requestami hurtem)
        await new Promise((r) => setTimeout(r, 150));
      }
    })();

    return () => ctrl.abort();
    // geoById celowo nie w deps – to cache, nie trigger
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageItems]);

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
                  to={`/listing/${l.id}${search}`}
                  style={{ textDecoration: "none", color: "inherit" }}
                  onClickCapture={() => {
                    // Ensure we persist a snapshot before navigating away.
                    // Force writing to the canonical key so back navigation can restore.
                    saveState(undefined, { forceStateKey: true });
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
                navigate(`/listing/${id}${search}`);
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
