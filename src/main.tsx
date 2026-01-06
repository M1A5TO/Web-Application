import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
import "leaflet/dist/leaflet.css";
import "leaflet/dist/leaflet.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  // React.StrictMode intentionally disabled to avoid double-invoking effects in dev.
  // This makes back-navigation state restoration (sessionStorage) deterministic.
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
