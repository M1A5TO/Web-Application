import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

export default function Loading() {
  const nav = useNavigate();
  const { search } = useLocation();

  useEffect(() => {
    const t = setTimeout(() => nav(`/results${search}`), 900);
    return () => clearTimeout(t);
  }, [nav, search]);

return (
  <div
    style={{
      minHeight: "60vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      textAlign: "center",
    }}
  >
    <img
      src="/house.png"
      alt="Wyszukiwanie mieszkania"
      style={{
        width: 150,              // było 80
        height: 150,             // było 80
        animation: "spin 1.2s linear infinite",
        filter: "invert(1) brightness(1.6) drop-shadow(0 4px 12px rgba(0,0,0,.4))",
      }}
    />
    <div style={{ marginTop: -2, fontSize: 40, fontWeight: 500 }}>
      Wyszukuję oferty...
    </div>

    <style>
      {`@keyframes spin {
          to { transform: rotate(360deg); }
        }`}
    </style>
  </div>
);


}
