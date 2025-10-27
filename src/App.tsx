import { Routes, Route, Navigate, Link } from "react-router-dom";
import Home from "./pages/Home";
import Loading from "./pages/Loading";
import Results from "./pages/Results";
import ListingDetails from "./pages/ListingDetails"; // ⬅ nowy import

export default function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <div className="brand-badge">M</div>
          <div>
            <div className="brand-title">M1A5TO — znajdź swój wymarzony dom</div>
            <div className="brand-sub">
              Inteligentne wyszukiwanie mieszkań inspirowane ideą miasta 15-minutowego
            </div>
          </div>
          <nav style={{marginLeft:"auto",display:"flex",gap:16,alignItems:"center"}}>
            <Link to="/">Start</Link>
            <Link to="/loading">Ładowanie</Link>
            <Link to="/results">Wyniki</Link>
          </nav>
        </div>
      </header>

      <main className="app-main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/loading" element={<Loading />} />
          <Route path="/results" element={<Results />} />
          <Route path="/listing/:id" element={<ListingDetails />} /> {/* ⬅ nowa strona */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <footer className="app-footer">
        © {new Date().getFullYear()} M1A5TO
      </footer>
    </div>
  );
}
