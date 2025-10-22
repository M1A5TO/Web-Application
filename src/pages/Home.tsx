import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Home() {
  const nav = useNavigate();
  const [location, setLocation] = useState("");
  const [profile, setProfile] = useState("uniwersalne");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = new URLSearchParams({ location, profile });
    nav(`/loading?${q.toString()}`);
  }

  return (
    <form onSubmit={submit} style={{display:"grid",gap:12}}>
      <div>
        <label>Lokalizacja</label><br/>
        <input
          value={location}
          onChange={e=>setLocation(e.target.value)}
          placeholder="np. Gdańsk, Wrzeszcz"
          style={{padding:8,width:"100%"}}
          required
        />
      </div>
      <div>
        <label>Profil mieszkania</label><br/>
        <select value={profile} onChange={e=>setProfile(e.target.value)} style={{padding:8}}>
          <option value="uniwersalne">Uniwersalne</option>
          <option value="rodzina">Rodzina</option>
          <option value="student">Student</option>
          <option value="singiel">Singiel</option>
          <option value="wlasciciel-psa">Właściciel psa</option>
        </select>
      </div>
      <button type="submit" style={{padding:"10px 14px"}}>Szukaj</button>
    </form>
  );
}
