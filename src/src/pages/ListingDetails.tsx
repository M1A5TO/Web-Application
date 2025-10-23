import { useEffect, useState, useMemo } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { fetchListingById } from "../api/client";
import type { ListingDetails } from "../api/types";
import MapPlaceholder from "../components/MapPlaceholder"; // na razie placeholder mapy

export default function ListingDetailsPage() {
  const { id = "" } = useParams();
  const { search } = useLocation();     // przeniesiemy kontekst powrotu (filtry)
  const navigate = useNavigate();

  const [data, setData] = useState<ListingDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchListingById(id)
      .then((res) => setData(res))
      .catch((e) => setError(e?.message ?? "Błąd nieznany"))
      .finally(() => setLoading(false));
  }, [id]);

  const marker = useMemo(() => {
    if (!data?.coords) return [];
    return [{ id: data.id, lat: data.coords.lat, lon: data.coords.lon, title: data.title }];
  }, [data]);

  return (
    <div style={{display:"grid", gap:16}}>
      <div className="card" style={{display:"flex", justifyContent:"space-between", alignItems:"center"}}>
        <div>
          <div style={{fontSize:18, fontWeight:800}}>Szczegóły mieszkania</div>
          <div style={{color:"var(--muted)"}}>
            {id ? `ID: ${id}` : ""} {data?.address ? `• ${data.address}` : ""}
          </div>
        </div>
        <div style={{display:"flex", gap:8}}>
          <button className="button" onClick={() => navigate(-1)}>← Wróć</button>
          <Link className="button" to={`/results${search}`}>Wróć do wyników</Link>
        </div>
      </div>

      {/* GŁÓWNY UKŁAD: lewa kolumna treści, prawa kolumna mapa */}
      <div className="grid-results" style={{gridTemplateColumns:"1.2fr 0.8fr"}}>
        <section className="card" style={{display:"grid", gap:16}}>
          {loading && <div>Ładowanie…</div>}
          {error && <div style={{color:"#fca5a5"}}>Błąd: {error}</div>}
          {!loading && !error && data && (
            <>
              {/* Nagłówek oferty */}
              <div>
                <div style={{fontSize:20, fontWeight:800}}>{data.title}</div>
                <div style={{color:"var(--muted)"}}>{data.address}</div>
                <div style={{marginTop:8, display:"flex", gap:12, flexWrap:"wrap"}}>
                  <div><b>{data.pricePln?.toLocaleString("pl-PL")}</b> PLN</div>
                  <div>{data.areaM2} m²</div>
                  {data.coords && (
                    <div style={{color:"var(--muted)"}}>
                      <small>Dokładna lokalizacja:&nbsp;</small>
                      <code>{data.coords.lat.toFixed(5)}, {data.coords.lon.toFixed(5)}</code>
                    </div>
                  )}
                </div>
              </div>

              {/* Sekcja ZDJĘCIA (placeholder) */}
              <div>
                <div className="label">Podgląd</div>
                <div style={{display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:8}}>
                  {[0,1,2].map(i => (
                    <div key={i} style={{height:120, borderRadius:12, background:"var(--panel-2)", border:"1px solid var(--border)"}} />
                  ))}
                </div>
              </div>

              {/* Sekcja ALG-ROZ (placeholder metryk) */}
              <div>
                <div className="label">Info z alg-roz</div>
                <div style={{display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:8}}>
                  {["Ogólna", "Dojazdy", "Zieleń", "Usługi"].map((k, i) => (
                    <div key={i} className="card" style={{padding:12}}>
                      <div style={{color:"var(--muted)", fontSize:12}}>{k}</div>
                      <div style={{fontSize:18, fontWeight:800}}>
                        {Math.round(((data.scores?.overall ?? 0.7) + i*0.03) * 100)}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sekcja SCRAPER (placeholder) */}
              <div>
                <div className="label">Informacje ze scraperów</div>
                <div className="card" style={{padding:12}}>
                  <div>Źródło: {data.source?.scraper ?? "—"}</div>
                  {data.source?.url && <a href={data.source.url} target="_blank" rel="noreferrer">Otwórz ofertę</a>}
                  <div style={{marginTop:8, color:"var(--muted)"}}>
                    {data.description ?? "Opis oferty pojawi się tutaj."}
                  </div>
                </div>
              </div>

              {/* Sekcja POI (placeholder listy) */}
              <div>
                <div className="label">Najbliższe POI</div>
                <div className="card" style={{padding:12}}>
                  {(data.poi ?? []).length === 0 ? (
                    <div style={{color:"var(--muted)"}}>Brak danych POI (placeholder).</div>
                  ) : (
                    <ul style={{margin:0, paddingLeft:16}}>
                      {data.poi!.map((p, i) => (
                        <li key={i}>{p.type}: {p.name} — {(p.distanceM/1000).toFixed(2)} km</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </>
          )}
        </section>

        {/* Prawa kolumna: mapa (na razie placeholder) */}
        <aside className="card">
          <div className="label">Mapa</div>
          <MapPlaceholder markers={marker} />
          <div style={{marginTop:8, color:"var(--muted)"}}>
            Docelowo: dynamiczne POI i okrąg zasięgu.
          </div>
        </aside>
      </div>
    </div>
  );
}
