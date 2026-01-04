import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Home() {
  const nav = useNavigate();
  const [location, setLocation] = useState("");
  const [profile, setProfile] = useState<"uniwersalne" | "student" | "singiel" | "wlasciciel_psa" | "rodzina">("uniwersalne");
  const [priceMax, setPriceMax] = useState<string>("");
  const [areaMin, setAreaMin] = useState<string>("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = new URLSearchParams({
      location,
      profile,
      ...(priceMax ? { priceMax } : {}),
      ...(areaMin ? { areaMin } : {}),
    });
    nav(`/loading?${q.toString()}`);
  }

  return (
    <form className="card" onSubmit={submit} style={{ maxWidth: 760, margin: "0 auto", display: "grid", gap: 16 }}>
      <div>
        <label className="label">Wprowadź lokalizację</label>
        <input
          className="input"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="np. Gdańsk, Warszawa, Wrocław"
          required
        />
      </div>

      <div>
        <label className="label">Wybierz swój profil</label>
        <select className="select" value={profile} onChange={(e) => setProfile(e.target.value as "uniwersalne" | "student" | "singiel" | "wlasciciel_psa" | "rodzina")}>
          <option value="uniwersalne">Uniwersalny</option>
          <option value="student">Student</option>
          <option value="singiel">Singiel</option>
          <option value="wlasciciel_psa">Właściciel psa</option>
          <option value="rodzina">Rodzinny</option>
        </select>
      </div>

      <div>
        <label className="label">Wprowadź cenę maksymalną (opcjonalnie)</label>
        <div style={{ position: "relative" }}>
          <input
            className="input"
            inputMode="numeric"
            value={priceMax}
            onChange={(e) => setPriceMax(e.target.value.replace(/[^0-9]/g, ""))}
            placeholder="np. 700000"
            style={{ paddingRight: 52 }}
            aria-label="Cena maksymalna"
          />
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              right: 14,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--muted)",
              fontWeight: 700,
              pointerEvents: "none",
            }}
          >
            zł
          </span>
        </div>
      </div>

      <div>
        <label className="label">Wprowadź minimalny metraż (opcjonalnie)</label>
        <div style={{ position: "relative" }}>
          <input
            className="input"
            inputMode="numeric"
            value={areaMin}
            onChange={(e) => setAreaMin(e.target.value.replace(/[^0-9]/g, ""))}
            placeholder="np. 40"
            style={{ paddingRight: 52 }}
            aria-label="Minimalny metraż"
          />
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              right: 14,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--muted)",
              fontWeight: 700,
              pointerEvents: "none",
            }}
          >
            m²
          </span>
        </div>
      </div>

      <div>
        <button
          className="button button--outline"
          type="submit"
          style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
        >
          <svg
            aria-hidden="true"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{ opacity: 0.9 }}
          >
            <path
              d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M21 21l-4.35-4.35"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Wyszukaj
        </button>
      </div>
    </form>
  );
}
