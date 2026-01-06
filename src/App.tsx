import { Routes, Route, Navigate, Link, useLocation } from "react-router-dom";
import { createContext, useMemo, useState } from "react";
import Home from "./pages/Home";
import Loading from "./pages/Loading";
import Results from "./pages/Results";
import ListingDetails from "./pages/ListingDetails"; // ⬅ nowy import

// Session-only (in-memory) cache for Results → used to restore list/page/scroll on back.
export type ResultsSnapshot = {
  key: string; // typically location.search from /results
  items: any[];
  page: number;
  scrollY: number;
  ts: number;
  geoById?: Record<string, string>;
};

export type ResultsSnapshotsMap = Record<string, ResultsSnapshot>;

export const ResultsCacheContext = createContext<{
  snapshot: ResultsSnapshotsMap | null;
  setSnapshot: (s: ResultsSnapshotsMap | null) => void;
} | null>(null);

export default function App() {
  const { pathname } = useLocation();
  const showSearchButton = pathname !== "/";

  const [snapshot, setSnapshot] = useState<ResultsSnapshotsMap | null>(null);
  const cacheValue = useMemo(() => ({ snapshot, setSnapshot }), [snapshot]);

  return (
    <ResultsCacheContext.Provider value={cacheValue}>
      <div className="app-shell">
        <header className="app-header">
          <div className="brand">
            <Link to="/" aria-label="Przejdź do wyszukiwania" style={{ lineHeight: 0 }}>
              <img className="brand-logo" src="/M1A5TO.png" alt="M1A5TO" />
            </Link>

            <div className="brand-center">
              <div className="brand-title">M1A5TO</div>
              <div className="brand-sub">Serwis do wyszukiwania i oceniania mieszkań w koncepcji 15-minutowego miasta</div>
            </div>

            {showSearchButton ? (
              <nav className="brand-nav">
                <Link to="/" className="button button--outline" style={{ padding: "8px 12px" }}>
                  Wyszukiwanie
                </Link>
              </nav>
            ) : null}
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
    </ResultsCacheContext.Provider>
  );
}
