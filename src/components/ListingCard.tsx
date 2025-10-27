import type { Listing } from "../api/types";

export default function ListingCard({ listing }: { listing: Listing }) {
  // (opcjonalnie) etykiety/prosty mapping profilu z bazy
  const profileLabel: Record<NonNullable<Listing["profileType"]>, string> = {
    rodzinny: "Rodzinny",
    studencki: "Studencki",
    singiel: "Singiel",
    uniwersalny: "Uniwersalny",
  };

  const coordsText = listing.coords
    ? `${listing.coords.lat.toFixed(5)}, ${listing.coords.lon.toFixed(5)}`
    : null;

  const mapHref = listing.coords
    ? `https://www.google.com/maps?q=${listing.coords.lat},${listing.coords.lon}`
    : undefined;

  return (
    <div
      className="listing-card"
      style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, transition: "transform .05s" }}
    >
      {/* NAGŁÓWEK: tytuł + (opcjonalnie) badge profilu + (opcjonalnie) atrakcyjność */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <div style={{ fontWeight: 700 }}>{listing.title}</div>

        {listing.profileType && (
          <span
            style={{
              padding: "2px 8px",
              borderRadius: 999,
              border: "1px solid var(--border)",
              color: "var(--text)",
              fontSize: 12,
            }}
          >
            {profileLabel[listing.profileType]}
          </span>
        )}

        {typeof listing.attractivenessScore === "number" && (
          <span
            style={{
              marginLeft: 4,
              padding: "2px 8px",
              borderRadius: 999,
              background: "rgba(109,40,217,.12)",
              border: "1px solid rgba(109,40,217,.35)",
              fontSize: 12,
            }}
            title="Atrakcyjność (z bazy)"
          >
            {(listing.attractivenessScore * 100).toFixed(0)}%
          </span>
        )}
      </div>

      <small>{listing.address}</small>

      <div style={{ marginTop: 8, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <div>
          <b>{listing.pricePln.toLocaleString("pl-PL")}</b> PLN
        </div>
        <div>{listing.areaM2} m²</div>
      </div>

      {/* Dokładna lokalizacja */}
      <div style={{ marginTop: 8 }}>
        <small style={{ color: "#6b7280" }}>Dokładna lokalizacja:&nbsp;</small>
        {coordsText ? (
          <>
            <code>{coordsText}</code>
            {" · "}
            <a href={mapHref} target="_blank" rel="noreferrer">
              Pokaż na mapie
            </a>
          </>
        ) : (
          <small style={{ color: "#9ca3af" }}>brak współrzędnych</small>
        )}
      </div>
    </div>
  );
}
