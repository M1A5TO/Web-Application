import type { Listing } from "../api/types";

type Props = {
  listing: Listing;
  markerLabel?: string;
  locationLabel?: string; // adres z reverse-geocoding (opcjonalnie)
};

export default function ListingCard({ listing, markerLabel, locationLabel }: Props) {
  const profileLabel: Record<NonNullable<Listing["profileType"]>, string> = {
    rodzinny: "Rodzinny",
    studencki: "Studencki",
    singiel: "Singiel",
    uniwersalny: "Uniwersalny",
    wlasciciel_psa: "Właściciel psa",
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
      style={{
        border: "1px solid #e5e7eb1a",
        borderRadius: 12,
        padding: 12,
        transition: "transform .05s",
      }}
    >
      {listing.thumbnailUrl && (
        <img
          src={listing.thumbnailUrl}
          alt={listing.title}
          loading="lazy"
          referrerPolicy="no-referrer"
          style={{
            width: "100%",
            height: 160,
            objectFit: "cover",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,.08)",
            marginBottom: 10,
            display: "block",
          }}
        />
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {markerLabel && (
          <span
            style={{
              background: "rgba(109,40,217,.12)",
              border: "1px solid rgba(109,40,217,.55)",
              width: 26,
              height: 26,
              borderRadius: 999,
              display: "grid",
              placeItems: "center",
              color: "#e5e7eb",
              fontWeight: 800,
              fontSize: 13,
              boxShadow: "0 6px 18px rgba(0,0,0,.25)",
              backdropFilter: "blur(6px)",
              WebkitBackdropFilter: "blur(6px)",
            }}
            title={`Marker ${markerLabel}`}
          >
            {markerLabel}
          </span>
        )}

        <div style={{ fontWeight: 700 }}>{listing.title}</div>

        {listing.profileType && (
          <span
            style={{
              padding: "2px 8px",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,.08)",
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
            {Math.round(listing.attractivenessScore)}%
          </span>
        )}
      </div>

      <small>
        {listing.address}
        {listing.id ? (
          <>
            {" · "}
            <span title="ID mieszkania" style={{ color: "#9ca3af", fontWeight: 600 }}>
              ID: {listing.id}
            </span>
          </>
        ) : null}
      </small>

      <div style={{ marginTop: 8, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <div>
          <b>{listing.pricePln.toLocaleString("pl-PL")}</b> PLN
        </div>
        <div>{listing.areaM2} m²</div>
      </div>

      {/* Lokalizacja: adres (jeśli jest) zamiast współrzędnych */}
      <div style={{ marginTop: 8 }}>
        <small style={{ color: "#6b7280" }}>Lokalizacja:&nbsp;</small>

        {locationLabel ? (
          <span style={{ fontWeight: 600 }}>{locationLabel}</span>
        ) : coordsText ? (
          <>
            <code>{coordsText}</code>
            {mapHref ? (
              <>
                {" · "}
                <a href={mapHref} target="_blank" rel="noreferrer">
                  Pokaż na mapie
                </a>
              </>
            ) : null}
          </>
        ) : (
          <small style={{ color: "#9ca3af" }}>—</small>
        )}
      </div>
    </div>
  );
}
