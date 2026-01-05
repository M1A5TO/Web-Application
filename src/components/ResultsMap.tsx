import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { useEffect, useMemo } from "react";

import icon2x from "leaflet/dist/images/marker-icon-2x.png";
import icon from "leaflet/dist/images/marker-icon.png";
import shadow from "leaflet/dist/images/marker-shadow.png";

// zostawiamy domyślny marker Leafleta dla innych miejsc w aplikacji
L.Icon.Default.mergeOptions({
  iconRetinaUrl: icon2x,
  iconUrl: icon,
  shadowUrl: shadow,
});

type MarkerItem = { id: string; lat: number; lon: number; title?: string; label?: string };

function FitAll({ markers }: { markers: MarkerItem[] }) {
  const map = useMap();

  useEffect(() => {
    // ważne przy dynamicznych layoutach
    setTimeout(() => map.invalidateSize(), 0);

    if (!markers.length) return;

    const bounds = L.latLngBounds(markers.map((m) => [m.lat, m.lon] as [number, number]));
    map.fitBounds(bounds, { padding: [24, 24] });
  }, [markers, map]);

  return null;
}

function makeLetterIcon(label: string) {
  return L.divIcon({
    className: "",
    html: `<div style="
      width: 30px; height: 30px;
      border-radius: 9999px;
      display: grid;
      place-items: center;
      font-weight: 800;
      font-size: 12px;
      color: #f8fafc;
      background: radial-gradient(circle at 30% 30%, rgba(109,40,217,.55) 0%, rgba(76,29,149,.85) 55%, rgba(30,13,62,.95) 100%);
      border: 1px solid rgba(139,92,246,.65);
      box-shadow: 0 8px 22px rgba(0,0,0,.45);
      text-shadow: 0 1px 2px rgba(0,0,0,.5);
    ">${label}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -26],
  });
}

export default function ResultsMap({
  markers,
  onMarkerClick,
}: {
  markers: MarkerItem[];
  onMarkerClick?: (id: string) => void;
}) {
  const center: [number, number] = useMemo(() => {
    if (markers.length) return [markers[0].lat, markers[0].lon];
    return [52.2297, 21.0122];
  }, [markers]);

  return (
    <div style={{ height: "100%", width: "100%", borderRadius: 12, overflow: "hidden" }}>
      <MapContainer center={center} zoom={6} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution="&copy; OpenStreetMap"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {markers.map((m) => {
          const label = m.label ?? "•";
          const icon = makeLetterIcon(label);

          return (
            <Marker
              key={m.id}
              position={[m.lat, m.lon]}
              icon={icon}
              eventHandlers={{
                click: () => onMarkerClick?.(m.id),
              }}
            >
              <Popup>{m.title ?? "Oferta"}</Popup>
            </Marker>
          );
        })}

        <FitAll markers={markers} />
      </MapContainer>
    </div>
  );
}
