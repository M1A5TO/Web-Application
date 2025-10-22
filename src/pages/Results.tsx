import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
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

  const [sort, setSort] = useState<SortKey>("relevance");
  const [items, setItems] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchListings({ location, profile: profile as any }).then(r => {
      setItems(r);
      setLoading(false);
    });
  }, [location, profile]);

  const sorted = useMemo(() => {
    const copy = [...items];
    if (sort === "priceAsc") copy.sort((a,b)=>a.pricePln-b.pricePln);
    if (sort === "priceDesc") copy.sort((a,b)=>b.pricePln-a.pricePln);
    if (sort === "areaDesc") copy.sort((a,b)=>b.areaM2-a.areaM2);
    return copy;
  }, [items, sort]);

  return (
    <div style={{display:"grid",gap:12,gridTemplateColumns:"1fr",alignItems:"start"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <b>Wyniki</b><br/>
          <small>Lokalizacja: {location || "—"} • Profil: {profile}</small>
        </div>
        <select value={sort} onChange={e=>setSort(e.target.value as SortKey)}>
          <option value="relevance">Trafność (domyślnie)</option>
          <option value="priceAsc">Cena rosnąco</option>
          <option value="priceDesc">Cena malejąco</option>
          <option value="areaDesc">Powierzchnia malejąco</option>
        </select>
      </div>

      {loading && <small>Ładowanie listy…</small>}
      {!loading && sorted.length===0 && <small>Brak wyników.</small>}

      <div style={{display:"grid",gap:12,gridTemplateColumns:"1fr 1fr"}}>
        <div style={{display:"grid",gap:12}}>
          {sorted.map(l => <ListingCard key={l.id} listing={l} />)}
        </div>
        <div>
          <MapPlaceholder
            markers={items.filter(x=>x.coords).map(x=>({id:x.id,lat:x.coords!.lat,lon:x.coords!.lon,title:x.title}))}
          />
          <small>Docelowo: prawdziwa mapa i POI.</small>
        </div>
      </div>
    </div>
  );
}
