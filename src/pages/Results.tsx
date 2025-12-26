import { useEffect, useMemo, useState } from "react";
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

  if (road && city) return `${road}${house} • ${city}`;
  if (road) return `${road}${house}`;
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

  const priceMax = q.get("priceMax") ? Number(q.get("priceMax")) : undefined;
  const areaMin = q.get("areaMin") ? Number(q.get("areaMin")) : undefined;
  const maxDistanceKm = q.get("maxDistanceKm") ? Number(q.get("maxDistanceKm")) : undefined;

  const [sort, setSort] = useState<SortKey>("relevance");
  const [items, setItems] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // cache adresów po ID ogłoszenia
  const [geoById, setGeoById] = useState<Record<string, string>>({});

  // paginacja
  const [page, setPage] = useState(1);
  const pageSize = 5;

  useEffect(() => {
    setLoading(true);
    setError(null);

    fetchListings({
      location,
      profile: profile as any,
      priceMax,
      areaMin,
      maxDistanceKm,
    })
      .then((r) => {
        setItems(r);
        setPage(1);
      })
      .catch((e) => setError(e?.message ?? "Błąd nieznany"))
      .finally(() => setLoading(false));
  }, [location, profile, priceMax, areaMin, maxDistanceKm]);

  const sorted = useMemo(() => {
    const copy = [...items];
    if (sort === "priceAsc") copy.sort((a, b) => a.pricePln - b.pricePln);
    if (sort === "priceDesc") copy.sort((a, b) => b.pricePln - a.pricePln);
    if (sort === "areaDesc") copy.sort((a, b) => b.areaM2 - a.areaM2);
    if (sort === "areaAsc") copy.sort((a, b) => a.areaM2 - b.areaM2);
    if (sort === "relevance") copy.sort((a, b) => (b.attractivenessScore ?? 0) - (a.attractivenessScore ?? 0));
    return copy;
  }, [items, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const pageItems = sorted.slice(start, end);

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
            Lokalizacja: {location || "—"} • Profil: {profile}
            {priceMax ? ` • Cena ≤ ${Number(priceMax).toLocaleString("pl-PL")} PLN` : ""}
            {areaMin ? ` • Metraż ≥ ${areaMin} m²` : ""}
            {maxDistanceKm ? ` • Max odległość: ${maxDistanceKm} km` : ""}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>Sortowanie:</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="select"
            style={{ minWidth: 210 }}
          >
            <option value="relevance">Trafność (domyślnie)</option>
            <option value="priceAsc">Cena rosnąco</option>
            <option value="priceDesc">Cena malejąco</option>
            <option value="areaDesc">Powierzchnia malejąco</option>
            <option value="areaAsc">Powierzchnia rosnąco</option>
          </select>
        </div>
      </div>

      {loading && <small>Ładowanie listy…</small>}
      {!loading && error && <div style={{ color: "#b91c1c" }}>Błąd: {error}</div>}
      {!loading && !error && sorted.length === 0 && <small>Brak wyników.</small>}

      {/* Główny układ: równe kolumny + większa mapa */}
      <div
        className="grid-results"
        style={{
          gridTemplateColumns: "1fr 1fr",
          alignItems: "stretch",
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
                {/* przekazujemy adres do karty */}
                <ListingCard listing={l} markerLabel={markerLabel} locationLabel={geoById[l.id]} />
              </Link>
            );
          })}

          {totalPages > 1 && (
            <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
              {Array.from({ length: totalPages }).map((_, idx) => {
                const pageNumber = idx + 1;
                const from = (pageNumber - 1) * pageSize + 1;
                const to = Math.min(pageNumber * pageSize, sorted.length);
                const active = pageNumber === page;
                return (
                  <button
                    key={pageNumber}
                    onClick={() => setPage(pageNumber)}
                    style={{
                      background: active ? "rgba(139,92,246,0.9)" : "rgba(15,23,42,0.4)",
                      border: "1px solid rgba(139,92,246,0.45)",
                      color: "white",
                      borderRadius: 999,
                      padding: "4px 12px",
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    {from} – {to}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* prawa kolumna – większa mapa (bez podpisu "Docelowo...") */}
        <div className="card" style={{ display: "grid", gridTemplateRows: "auto 1fr", gap: 12 }}>
          <div className="label" style={{ marginBottom: 0 }}>
            Mapa
          </div>

          <div style={{ minHeight: 760 }}>
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
      </div>
    </div>
  );
}
