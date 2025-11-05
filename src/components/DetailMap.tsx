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

type ListingMarker = { lat: number; lon: number; title?: string };
type PoiMarker = { lat: number; lon: number; name: string; type?: string };

// typ → emoji
const poiStyle: Record<string, { emoji: string }> = {
  park: { emoji: "🌳" },
  "park osiedlowy": { emoji: "🌳" },
  szkoła: { emoji: "📚" },
  przedszkole: { emoji: "🧸" },
  uczelnia: { emoji: "🎓" },
  kawiarnia: { emoji: "☕" },
  restauracja: { emoji: "🍽️" },
  sklep: { emoji: "🛒" },
  galeria: { emoji: "🛍️" },
  apteka: { emoji: "💊" },
  siłownia: { emoji: "🏋️" },
  tramwaj: { emoji: "🚋" },
  przystanek: { emoji: "🚌" },
  SKM: { emoji: "🚆" },
  bar: { emoji: "🍺" },
  klub: { emoji: "🎉" },
  weterynarz: { emoji: "🐾" },
  "sklep zoologiczny": { emoji: "🐾" },
};

// fioletowe kółko mieszkania – bez białego kwadratu
const listingIcon = L.divIcon({
  className: "", // <- to usuwa domyślne białe tło Leafleta
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
    <div style={{ height: 420, borderRadius: 12, overflow: "hidden" }}>
      <MapContainer center={center} zoom={14} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution="&copy; OpenStreetMap"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* mieszkanie */}
        {listing && (
          <Marker position={[listing.lat, listing.lon]} icon={listingIcon}>
            <Popup>{listing.title ?? "Mieszkanie"}</Popup>
          </Marker>
        )}

        {/* POI jako same emoji */}
        {poi.map((p, idx) => {
          const key = (p.type ?? "").trim();
          const style = poiStyle[key] || { emoji: "📍" };

          const poiIcon = L.divIcon({
            className: "", // bez białego kwadratu
            html: `<div style="
              font-size: 22px;
              line-height: 1;
              text-shadow: 0 1px 2px rgba(0,0,0,.45);
            ">${style.emoji}</div>`,
            iconSize: [22, 22],
            iconAnchor: [11, 22],
            popupAnchor: [0, -20],
          });

          return (
            <Marker key={idx} position={[p.lat, p.lon]} icon={poiIcon}>
              <Popup>
                <div style={{ fontWeight: 600 }}>{p.name}</div>
                {p.type && <div style={{ fontSize: 12, opacity: 0.7 }}>{p.type}</div>}
              </Popup>
            </Marker>
          );
        })}

        <FitAll listing={listing} poi={poi} />
      </MapContainer>
    </div>
  );
}
