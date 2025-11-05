import { useEffect, useMemo, useState } from "react";
import { fetchListings } from "../api/client";
import type { Listing } from "../api/types";
import ListingCard from "../components/ListingCard";
import ResultsMap from "../components/ResultsMap";
import { useLocation, useNavigate, Link } from "react-router-dom";

type SortKey = "relevance" | "priceAsc" | "priceDesc" | "areaDesc" | "areaAsc";

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

  // paginacja
  const [page, setPage] = useState(1);
  const pageSize = 5;

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchListings({ location, profile: profile as any, priceMax, areaMin, maxDistanceKm })
      .then((r) => {
        setItems(r);
        setPage(1); // przy nowym wyszukaniu wracamy na 1 stronę
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
    return copy;
  }, [items, sort]);

  const totalPages = Math.ceil(sorted.length / pageSize);
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const pageItems = sorted.slice(start, end);

  return (
    <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr", alignItems: "start" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <b>Wyniki</b>
          <br />
          <small>
            Lokalizacja: {location || "—"} • Profil: {profile}
            {priceMax ? ` • Cena ≤ ${Number(priceMax).toLocaleString("pl-PL")} PLN` : ""}
            {areaMin ? ` • Metraż ≥ ${areaMin} m²` : ""}
            {maxDistanceKm ? ` • Odległość ≤ ${maxDistanceKm} km` : ""} •{" "}
            <em>Widoczne: dokładne współrzędne mieszkań</em>
          </small>
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          style={{
            background: "rgba(15,23,42,.45)",
            border: "1px solid rgba(139,92,246,.35)",
            color: "white",
            borderRadius: 12,
            padding: "6px 10px",
            outline: "none",
            cursor: "pointer",
            minWidth: 190,
          }}
        >
          <option value="relevance">Trafność (domyślnie)</option>
          <option value="priceAsc">Cena rosnąco</option>
          <option value="priceDesc">Cena malejąco</option>
          <option value="areaDesc">Powierzchnia malejąco</option>
          <option value="areaAsc">Powierzchnia rosnąco</option>
        </select>
      </div>

      {loading && <small>Ładowanie listy…</small>}
      {!loading && error && <div style={{ color: "#b91c1c" }}>Błąd: {error}</div>}
      {!loading && !error && sorted.length === 0 && <small>Brak wyników.</small>}

      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
        {/* lewa kolumna – tylko bieżąca strona */}
        <div style={{ display: "grid", gap: 12 }}>
          {pageItems.map((l, idx) => {
            const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
            const markerLabel = idx < letters.length ? letters[idx] : `#${idx + 1}`;

            return (
              <Link
                key={l.id}
                to={`/listing/${l.id}${search}`}
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <ListingCard listing={l} markerLabel={markerLabel} />
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
                        background: active ? "rgba(139,92,246,.9)" : "rgba(15,23,42,.4)",
                        border: "1px solid rgba(139,92,246,.45)",
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

        {/* prawa kolumna – mapa pokazuje tylko bieżącą stronę */}
        <div>
          <ResultsMap
            markers={pageItems
              .filter((x) => x.coords)
              .map((x) => ({
                id: x.id,
                lat: x.coords!.lat,
                lon: x.coords!.lon,
                title: x.title,
              }))}
            onMarkerClick={(id) => {
              navigate(`/listing/${id}${search}`);
            }}
          />
          <small>Docelowo: prawdziwa mapa i POI.</small>
        </div>
      </div>
    </div>
  );
}
