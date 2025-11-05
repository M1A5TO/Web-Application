import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { useEffect } from "react";
import icon2x from "leaflet/dist/images/marker-icon-2x.png";
import icon from "leaflet/dist/images/marker-icon.png";
import shadow from "leaflet/dist/images/marker-shadow.png";

L.Icon.Default.mergeOptions({ iconRetinaUrl: icon2x, iconUrl: icon, shadowUrl: shadow });

type MarkerT = { id: string; lat: number; lon: number; title?: string };

function FitBounds({ markers }: { markers: MarkerT[] }) {
  const map = useMap();
  useEffect(() => {
    if (!markers.length) return;
    const b = L.latLngBounds(markers.map(m => [m.lat, m.lon]));
    map.fitBounds(b, { padding: [24, 24] });
  }, [markers, map]);
  return null;
}

function labelFromIndex(i: number): string {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return i < letters.length ? letters[i] : `#${i + 1}`;
}

export default function ResultsMap({
  markers,
  onMarkerClick,
}: {
  markers: MarkerT[];
  onMarkerClick?: (id: string) => void;
}) {
  const has = markers.length > 0;
  const center: [number, number] = has ? [markers[0].lat, markers[0].lon] : [52.2297, 21.0122];

  return (
    <div style={{ height: 420, borderRadius: 12, overflow: "hidden", border: "1px solid rgba(255,255,255,.06)" }}>
      <MapContainer center={center} zoom={12} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; OpenStreetMap'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {markers.map((m, idx) => {
          const label = labelFromIndex(idx);
          const icon = L.divIcon({
            className: "miasto-marker",
            html: `<div class="miasto-marker__inner">${label}</div>`,
            iconSize: [30, 30],
            iconAnchor: [15, 30],
            popupAnchor: [0, -28],
          });

          return (
            <Marker
              key={m.id}
              position={[m.lat, m.lon]}
              icon={icon}
              eventHandlers={{
                click: () => {
                  onMarkerClick?.(m.id);
                },
              }}
            >
              <Popup>
                <b>{label}</b> — {m.title ?? "Mieszkanie"}
              </Popup>
            </Marker>
          );
        })}

        <FitBounds markers={markers} />
      </MapContainer>
    </div>
  );
}
