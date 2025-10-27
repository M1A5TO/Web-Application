import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Home() {
  const nav = useNavigate();
  const [location, setLocation] = useState("");
  const [profile, setProfile] = useState("uniwersalne");
  const [priceMax, setPriceMax] = useState<string>("");
  const [areaMin, setAreaMin] = useState<string>("");
  const [maxDistanceKm, setMaxDistanceKm] = useState<number>(0);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = new URLSearchParams({
      location,
      profile,
      ...(priceMax ? { priceMax } : {}),
      ...(areaMin ? { areaMin } : {}),
      ...(maxDistanceKm ? { maxDistanceKm: String(maxDistanceKm) } : {}),
    });
    nav(`/loading?${q.toString()}`);
  }

  return (
    <form className="card" onSubmit={submit} style={{maxWidth: 760, margin:"0 auto", display:"grid", gap:16}}>
      <div>
        <label className="label">Lokalizacja</label>
        <input
          className="input"
          value={location}
          onChange={e=>setLocation(e.target.value)}
          placeholder="np. Gdańsk, Wrzeszcz"
          required
        />
      </div>

      <div>
        <label className="label">Profil mieszkania</label>
        <select className="select" value={profile} onChange={e=>setProfile(e.target.value)}>
          <option value="uniwersalne">Uniwersalne</option>
          <option value="rodzina">Rodzina</option>
          <option value="student">Student</option>
          <option value="singiel">Singiel</option>
        </select>
      </div>

      <div>
        <label className="label">Cena maks. (PLN)</label>
        <input className="input" value={priceMax} onChange={e=>setPriceMax(e.target.value)} placeholder="np. 700000" />
      </div>

      <div>
        <label className="label">Metraż min. (m²)</label>
        <input className="input" value={areaMin} onChange={e=>setAreaMin(e.target.value)} placeholder="np. 30" />
      </div>

      <div>
        <label className="label">Maks. odległość od punktu (km)</label>
        <div className="range-wrap">
          <input
            className="range"
            type="range"
            min={0}
            max={50}
            step={1}
            value={maxDistanceKm}
            onChange={e=>setMaxDistanceKm(Number(e.target.value))}
            aria-label="Maksymalna odległość w kilometrach"
          />
          <div className="range-value">{maxDistanceKm} km</div>
        </div>
        <div style={{color:"var(--muted)", marginTop:6, fontSize:13}}>
          0 km = bez ograniczenia (logika odległości po stronie backendu).
        </div>
      </div>

      <div>
        <button className="button" type="submit" style={{width:"100%"}}>Szukaj</button>
      </div>
    </form>
  );
}
