import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom"; // ważne
import { fetchListings } from "../api/client";
import type { Listing } from "../api/types";
import ListingCard from "../components/ListingCard";
import MapPlaceholder from "../components/MapPlaceholder";

type SortKey = "relevance" | "priceAsc" | "priceDesc" | "areaDesc";

export default function Results() {
  const { search } = useLocation();
  const q = new URLSearchParams(search);

  const location = q.get("location") ?? "";
  const profile  = q.get("profile")  ?? "uniwersalne";

  // ⬇️ NOWE: parsowanie opcjonalnych filtrów z URL
  const priceMax = q.get("priceMax") ? Number(q.get("priceMax")) : undefined;
  const areaMin  = q.get("areaMin")  ? Number(q.get("areaMin"))  : undefined;
  const maxDistanceKm = q.get("maxDistanceKm") ? Number(q.get("maxDistanceKm")) : undefined;

  const [sort, setSort] = useState<SortKey>("relevance");
  const [items, setItems] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    // ⬇️ przekażemy filtry do API (mock lub prawdziwy backend)
    fetchListings({ location, profile: profile as any, priceMax, areaMin, maxDistanceKm })
      .then(r => setItems(r))
      .catch(e => setError(e?.message ?? "Błąd nieznany"))
      .finally(() => setLoading(false));
  }, [location, profile, priceMax, areaMin, maxDistanceKm]);

  const sorted = useMemo(() => {
    const copy = [...items];
    if (sort === "priceAsc")  copy.sort((a,b)=>a.pricePln-b.pricePln);
    if (sort === "priceDesc") copy.sort((a,b)=>b.pricePln-a.pricePln);
    if (sort === "areaDesc")  copy.sort((a,b)=>b.areaM2-a.areaM2);
    return copy;
  }, [items, sort]);

  return (
    <div style={{display:"grid",gap:12,gridTemplateColumns:"1fr",alignItems:"start"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <b>Wyniki</b><br/>
          <small>
            Lokalizacja: {location || "—"} • Profil: {profile}
            {priceMax ? ` • Cena ≤ ${Number(priceMax).toLocaleString("pl-PL")} PLN` : ""}
            {areaMin  ? ` • Metraż ≥ ${areaMin} m²` : ""}
            {maxDistanceKm ? ` • Odległość ≤ ${maxDistanceKm} km` : ""}
            {" • "}
            <em>Widoczne: dokładne współrzędne mieszkań</em>
          </small>
        </div>
        <select value={sort} onChange={e=>setSort(e.target.value as SortKey)}>
          <option value="relevance">Trafność (domyślnie)</option>
          <option value="priceAsc">Cena rosnąco</option>
          <option value="priceDesc">Cena malejąco</option>
          <option value="areaDesc">Powierzchnia malejąco</option>
        </select>
      </div>

      {loading && <small>Ładowanie listy…</small>}
      {!loading && error && <div style={{color:"#b91c1c"}}>Błąd: {error}</div>}
      {!loading && !error && sorted.length===0 && <small>Brak wyników.</small>}

      <div style={{display:"grid",gap:12,gridTemplateColumns:"1fr 1fr"}}>
        <div style={{display:"grid",gap:12}}>
  {sorted.map(l => (
    <Link
      key={l.id}
      to={`/listing/${l.id}${search}`}     // zachowuje parametry z URL
      style={{ textDecoration: "none", color: "inherit" }}
    >
      <ListingCard listing={l} />
    </Link>
  ))}
</div>
        <div>
          <MapPlaceholder
            markers={items
              .filter(x=>x.coords)
              .map(x=>({id:x.id,lat:x.coords!.lat,lon:x.coords!.lon,title:x.title}))}
          />
          <small>Docelowo: prawdziwa mapa i POI.</small>
        </div>
      </div>
    </div>
  );
}
