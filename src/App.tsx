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
          <img className="brand-logo" src="/M1A5TO.png" alt="M1A5TO" />

          <div className="brand-center">
            <div className="brand-title">M1A5TO</div>
            <div className="brand-sub">Serwis do wyszukiwania i oceniania mieszkań w koncepcji 15-minutowego miasta</div>
          </div>

          <nav className="brand-nav">
            <Link to="/">Wyszukiwanie</Link>
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
