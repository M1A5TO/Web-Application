import { Routes, Route, Navigate, Link } from "react-router-dom";
import Home from "./pages/Home";
import Loading from "./pages/Loading";
import Results from "./pages/Results";

export default function App() {
  return (
    <div style={{minHeight:"100vh",display:"grid",gridTemplateRows:"auto 1fr auto"}}>
      <header style={{padding:16,borderBottom:"1px solid #e5e7eb"}}>
        <b>Miasto 15 — wyszukiwarka mieszkań</b>
        <nav style={{display:"inline-flex",gap:12,marginLeft:16}}>
          <Link to="/">Start</Link>
          <Link to="/loading">Ładowanie</Link>
          <Link to="/results">Wyniki</Link>
        </nav>
      </header>

      <main style={{padding:16,maxWidth:1200,margin:"0 auto",width:"100%"}}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/loading" element={<Loading />} />
          <Route path="/results" element={<Results />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <footer style={{padding:16,borderTop:"1px solid #e5e7eb",color:"#6b7280"}}>
        © {new Date().getFullYear()} M1A5TO
      </footer>
    </div>
  );
}
