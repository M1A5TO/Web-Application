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
    <div style={{textAlign:"center"}}>
      <div style={{
        width:56,height:56,border:"5px solid #e5e7eb",borderTopColor:"#6366f1",
        borderRadius:"50%",margin:"24px auto",animation:"spin 1s linear infinite"
      }}/>
      <div>Wyszukuję oferty…</div>
      <style>{`@keyframes spin {to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
