import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { useEffect } from "react";
import icon2x from "leaflet/dist/images/marker-icon-2x.png";
import icon from "leaflet/dist/images/marker-icon.png";
import shadow from "leaflet/dist/images/marker-shadow.png";

// żeby leaflet mógł dalej używać domyślnego markera gdzie indziej
L.Icon.Default.mergeOptions({
  iconRetinaUrl: icon2x,
  iconUrl: icon,
  shadowUrl: shadow,
});

type ListingMarker = { lat: number; lon: number };
type PoiMarker = { lat: number; lon: number; name: string; type?: string; distanceM?: number };

/**
 * Normalizuje typ POI z bazy:
 * - przycina spacje
 * - jeśli jest format "tram_stop: tram_stop" to bierze część przed ":"
 * - sprowadza do lowercase
 */
function normalizePoiType(raw?: string): string {
  if (!raw) return "";
  const s = String(raw).trim();
  if (!s) return "";
  const beforeColon = s.split(":")[0].trim(); // "tram_stop: tram_stop" -> "tram_stop"
  return beforeColon.toLowerCase();
}

/**
 * Słownik: kanoniczny klucz (z bazy) -> etykieta PL + emoji.
 * Rozszerzaj bezpiecznie – UI i mapa będą spójne.
 */
const POI_META: Record<string, { pl: string; emoji: string }> = {
  // transport
  tram_stop: { pl: "Przystanek tramwajowy", emoji: "🚋" },
  bus_stop: { pl: "Przystanek autobusowy", emoji: "🚌" },
  rail_station: { pl: "Stacja kolejowa", emoji: "🚆" },

  // edukacja
  school: { pl: "Szkoła", emoji: "📚" },
  kinder_childcare: { pl: "Przedszkole", emoji: "🧸" },
  university: { pl: "Uczelnia", emoji: "🎓" },
  library: { pl: "Biblioteka", emoji: "📖" },

  // jedzenie / rozrywka
  pub: { pl: "Pub", emoji: "🍺" },
  nightclub: { pl: "Klub", emoji: "🎉" },

  // zakupy / usługi
  convenience: { pl: "Sklep", emoji: "🛒" },
  supermarket: { pl: "Supermarket", emoji: "🛒" },
  parcel_locker: { pl: "Paczkomat", emoji: "📦" },
  pharmacy: { pl: "Apteka", emoji: "💊" },
  bakery: { pl: "Piekarnia", emoji: "🥐" },

  // zdrowie / sport
  clinic_hospital: { pl: "Obiekt medyczny", emoji: "🏥" },
  fitness_centre: { pl: "Siłownia", emoji: "🏋️" },

  // rekreacja
  park: { pl: "Park", emoji: "🌳" },
  playground: { pl: "Plac zabaw", emoji: "🛝" },

  // zwierzęta
  veterinary: { pl: "Weterynarz", emoji: "🐾" },
  pet_shop: { pl: "Sklep zoologiczny", emoji: "🐾" },
};


/** Fallback do PL: ładniejsze niż "tram_stop" */
function humanizeFallbackPl(key: string): string {
  if (!key) return "Punkt POI";
  // tram_stop -> Tram stop -> Tram stop (nadal EN, ale czytelne)
  const spaced = key.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** fioletowe kółko mieszkania – bez białego kwadratu */
const listingIcon = L.divIcon({
  className: "",
  html: `<div style="
    background: radial-gradient(circle at 30% 30%, #a855f7 0%, #6d28d9 60%, #4c1d95 100%);
    width: 34px; height: 34px;
    border-radius: 9999px;
    box-shadow: 0 6px 16px rgba(0,0,0,.35);
    border: 1px solid rgba(255,255,255,.25);
  "></div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 34],
  popupAnchor: [0, -30],
});

function FitAll({ listing, poi }: { listing?: ListingMarker; poi: PoiMarker[] }) {
  const map = useMap();
  useEffect(() => {
    const points: [number, number][] = [];
    if (listing) points.push([listing.lat, listing.lon]);
    poi.forEach((p) => points.push([p.lat, p.lon]));
    if (!points.length) return;
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [24, 24] });
  }, [listing, poi, map]);
  return null;
}

export default function DetailMap({
  listing,
  poi,
}: {
  listing?: ListingMarker;
  poi: PoiMarker[];
}) {
  const center: [number, number] = listing ? [listing.lat, listing.lon] : [52.2297, 21.0122];

  return (
    <div style={{ height: "100%", borderRadius: 12, overflow: "hidden" }}>
      <MapContainer center={center} zoom={14} style={{ height: "100%", width: "100%" }}>
        <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        {/* mieszkanie */}
        {listing && (
          <Marker position={[listing.lat, listing.lon]} icon={listingIcon}>
            <Popup>Mieszkanie</Popup>
          </Marker>
        )}

        {/* POI jako emoji + polskie etykiety */}
        {poi.map((p, idx) => {
          const key = normalizePoiType(p.type);
          const meta = POI_META[key];
          const emoji = meta?.emoji ?? "📍";
          const labelPl = meta?.pl ?? humanizeFallbackPl(key);

          const poiIcon = L.divIcon({
            className: "",
            html: `<div style="
              font-size: 22px;
              line-height: 1;
              text-shadow: 0 1px 2px rgba(0,0,0,.45);
            ">${emoji}</div>`,
            iconSize: [22, 22],
            iconAnchor: [11, 22],
            popupAnchor: [0, -20],
          });

          const minutes = typeof p.distanceM === "number" && Number.isFinite(p.distanceM)
            ? Math.max(0, Math.round(p.distanceM / 60))
            : null;

          return (
            <Marker key={idx} position={[p.lat, p.lon]} icon={poiIcon}>
              <Popup>
                <div style={{ fontWeight: 800 }}>{labelPl}</div>
                {minutes != null ? (
                  <div style={{ fontSize: 12, opacity: 0.8 }}>~{minutes} min pieszo</div>
                ) : null}
              </Popup>
            </Marker>
          );
        })}

        <FitAll listing={listing} poi={poi} />
      </MapContainer>
    </div>
  );
}
