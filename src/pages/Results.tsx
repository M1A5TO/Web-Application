import { useEffect, useMemo, useRef, useState } from "react";
import { fetchListings } from "../api/client";
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
  const [targetCount, setTargetCount] = useState<100 | 250 | 500 | 1000>(100);
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

  // reset when filters change
  useEffect(() => {
    setPage(1);
    setItems([]);
    setGeoById({});
    setError(null);
  }, [location, profile, priceMax, areaMin, maxDistanceKm]);

  // progressively load offers up to targetCount
  useEffect(() => {
    const myRun = ++fetchRunId.current;
    let cancelled = false;

    async function run() {
      // if we already have enough cached, nothing to do
      if (items.length >= targetCount) {
        setLoading(false);
        setIsFetchingMore(false);
        return;
      }

      setLoading(items.length === 0);
      setIsFetchingMore(true);

      try {
        const batchSize = 100; // API default, fewer roundtrips
        let loaded = items.length;

        while (!cancelled && fetchRunId.current === myRun && loaded < targetCount) {
          const skip = loaded;
          const limit = Math.min(batchSize, targetCount - loaded);

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

          // update local loaded count (use batch length as upper-bound, but rely on appended when possible)
          loaded += Math.max(appended, batch.length);

          // if API returned fewer than requested => likely end
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
  }, [targetCount, location, profile, priceMax, areaMin, maxDistanceKm]);

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
          <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 4, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            Wczytane oferty: <b style={{ color: "var(--text)" }}>{sorted.length}</b>
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
              value={targetCount}
              onChange={(e) => setTargetCount(Number(e.target.value) as any)}
              className="select"
              style={{ minWidth: 120 }}
              title="Ile ofert wczytać do sortowania i przeglądania"
            >
              <option value={100}>100</option>
              <option value={250}>250</option>
              <option value={500}>500</option>
              <option value={1000}>1000</option>
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
                <Link key={l.id} to={`/listing/${l.id}${search}`} style={{ textDecoration: "none", color: "inherit" }}>
                  <ListingCard listing={l} markerLabel={markerLabel} locationLabel={geoById[l.id]} />
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
