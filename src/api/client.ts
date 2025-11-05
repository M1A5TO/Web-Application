// src/api/client.ts
import type {
  Listing,
  ListingDetails,
  SearchParams,
  ProfileType,
} from "./types";

// pomocnicze — losowy z tablicy
function pick<T>(xs: T[]): T {
  return xs[Math.floor(Math.random() * xs.length)];
}

// pomocnicze — atrakcyjność 0.50–0.95
function score(): number {
  return Math.round((0.5 + Math.random() * 0.45) * 100) / 100;
}

// pomocnicze — lekko przesuwamy punkt POI obok mieszkania
function nearCoords(
  base: { lat: number; lon: number },
  offsetLat = 0.001,
  offsetLon = 0.001
): { lat: number; lon: number } {
  return {
    lat: base.lat + offsetLat,
    lon: base.lon + offsetLon,
  };
}

const PROFILES: ProfileType[] = [
  "rodzinny",
  "studencki",
  "singiel",
  "uniwersalny",
];

// UDawana baza 10 mieszkań + teraz 3 POI na każde
const MOCK_LISTINGS: ListingDetails[] = [
  {
    id: "1",
    title: "2-pok. blisko parku",
    pricePln: 699_000,
    areaM2: 48,
    address: "Gdańsk, Wrzeszcz",
    coords: { lat: 54.38, lon: 18.61 },
    profileType: "rodzinny",
    attractivenessScore: 0.76,
    scores: { overall: 0.76, commute: 0.72, green: 0.85, services: 0.7 },
    source: { scraper: "demo", url: "https://example.com/oferta/1" },
    description: "Mieszkanie rodzinne, spokojna okolica.",
    poi: [
      {
        type: "szkoła",
        name: "Szkoła Podstawowa nr 52",
        distanceM: 280,
        coords: nearCoords({ lat: 54.38, lon: 18.61 }, 0.0008, 0.0003),
      },
      {
        type: "park",
        name: "Park Akademicki",
        distanceM: 450,
        coords: nearCoords({ lat: 54.38, lon: 18.61 }, -0.0006, 0.0004),
      },
      {
        type: "sklep",
        name: "Sklep osiedlowy",
        distanceM: 160,
        coords: nearCoords({ lat: 54.38, lon: 18.61 }, 0.0004, -0.0005),
      },
    ],
  },
  {
    id: "2",
    title: "Kawalerka — centrum",
    pricePln: 479_000,
    areaM2: 28,
    address: "Gdańsk, Śródmieście",
    coords: { lat: 54.352, lon: 18.646 },
    profileType: "studencki",
    attractivenessScore: 0.64,
    scores: { overall: 0.64, commute: 0.9, green: 0.4, services: 0.88 },
    source: { scraper: "demo", url: "https://example.com/oferta/2" },
    description: "Ścisłe centrum, idealne dla studenta.",
    poi: [
      {
        type: "uczelnia",
        name: "Akademia Muzyczna",
        distanceM: 350,
        coords: nearCoords({ lat: 54.352, lon: 18.646 }, 0.0007, -0.0004),
      },
      {
        type: "kawiarnia",
        name: "Kawiarnia Staromiejska",
        distanceM: 210,
        coords: nearCoords({ lat: 54.352, lon: 18.646 }, -0.0005, 0.0005),
      },
      {
        type: "siłownia",
        name: "Siłownia Centrum",
        distanceM: 420,
        coords: nearCoords({ lat: 54.352, lon: 18.646 }, 0.0005, 0.0006),
      },
    ],
  },
  {
    id: "3",
    title: "Rodzinne 3 pokoje przy szkole",
    pricePln: 835_000,
    areaM2: 62,
    address: "Gdańsk, Morena",
    coords: { lat: 54.3545, lon: 18.563 },
    profileType: "rodzinny",
    attractivenessScore: 0.82,
    scores: { overall: 0.82, commute: 0.68, green: 0.78, services: 0.74 },
    source: { scraper: "demo", url: "https://example.com/oferta/3" },
    poi: [
      {
        type: "szkoła",
        name: "SP Morena",
        distanceM: 200,
        coords: nearCoords({ lat: 54.3545, lon: 18.563 }, 0.0005, -0.0003),
      },
      {
        type: "przedszkole",
        name: "Przedszkole Krasnal",
        distanceM: 260,
        coords: nearCoords({ lat: 54.3545, lon: 18.563 }, -0.0006, 0.0004),
      },
      {
        type: "park",
        name: "Park Morena",
        distanceM: 520,
        coords: nearCoords({ lat: 54.3545, lon: 18.563 }, 0.0007, 0.0006),
      },
    ],
  },
  {
    id: "4",
    title: "Mikroapartament – świetna komunikacja",
    pricePln: 389_000,
    areaM2: 23,
    address: "Gdańsk, Zaspa",
    coords: { lat: 54.3915, lon: 18.5935 },
    profileType: "singiel",
    attractivenessScore: 0.71,
    source: { scraper: "demo", url: "https://example.com/oferta/4" },
    poi: [
      {
        type: "SKM",
        name: "SKM Zaspa",
        distanceM: 340,
        coords: nearCoords({ lat: 54.3915, lon: 18.5935 }, 0.0006, 0.0001),
      },
      {
        type: "siłownia",
        name: "Fitness Zaspa",
        distanceM: 280,
        coords: nearCoords({ lat: 54.3915, lon: 18.5935 }, -0.0004, 0.0004),
      },
      {
        type: "kawiarnia",
        name: "Cafe Zaspa",
        distanceM: 190,
        coords: nearCoords({ lat: 54.3915, lon: 18.5935 }, 0.0005, -0.0004),
      },
    ],
  },
  {
    id: "5",
    title: "Nowe budownictwo na Przymorzu",
    pricePln: 915_000,
    areaM2: 55,
    address: "Gdańsk, Przymorze",
    coords: { lat: 54.4045, lon: 18.602 },
    profileType: "uniwersalny",
    attractivenessScore: 0.79,
    source: { scraper: "demo", url: "https://example.com/oferta/5" },
    poi: [
      {
        type: "galeria",
        name: "Galeria Przymorze",
        distanceM: 430,
        coords: nearCoords({ lat: 54.4045, lon: 18.602 }, 0.0007, 0.0002),
      },
      {
        type: "park",
        name: "Park Regana",
        distanceM: 900,
        coords: nearCoords({ lat: 54.4045, lon: 18.602 }, -0.0005, 0.0005),
      },
      {
        type: "sklep",
        name: "Biedronka Przymorze",
        distanceM: 250,
        coords: nearCoords({ lat: 54.4045, lon: 18.602 }, 0.0004, -0.0004),
      },
    ],
  },
  {
    id: "6",
    title: "2 pokoje – Oliwa/Uniwersytet",
    pricePln: 648_000,
    areaM2: 45,
    address: "Gdańsk, Oliwa",
    coords: { lat: 54.412, lon: 18.565 },
    profileType: "studencki",
    attractivenessScore: 0.73,
    source: { scraper: "demo", url: "https://example.com/oferta/6" },
    poi: [
      {
        type: "uczelnia",
        name: "Uniwersytet Gdański",
        distanceM: 600,
        coords: nearCoords({ lat: 54.412, lon: 18.565 }, 0.0008, -0.0002),
      },
      {
        type: "tramwaj",
        name: "Przystanek Oliwa",
        distanceM: 420,
        coords: nearCoords({ lat: 54.412, lon: 18.565 }, -0.0005, 0.0004),
      },
      {
        type: "kawiarnia",
        name: "Kawiarnia Oliwska",
        distanceM: 210,
        coords: nearCoords({ lat: 54.412, lon: 18.565 }, 0.0004, 0.0005),
      },
    ],
  },
  {
    id: "7",
    title: "Loft dla singla – Stocznia",
    pricePln: 799_000,
    areaM2: 52,
    address: "Gdańsk, Młode Miasto",
    coords: { lat: 54.365, lon: 18.6395 },
    profileType: "singiel",
    attractivenessScore: 0.69,
    source: { scraper: "demo", url: "https://example.com/oferta/7" },
    poi: [
      {
        type: "bar",
        name: "Bar Stocznia",
        distanceM: 240,
        coords: nearCoords({ lat: 54.365, lon: 18.6395 }, 0.0005, 0.0003),
      },
      {
        type: "klub",
        name: "Klub Młode Miasto",
        distanceM: 310,
        coords: nearCoords({ lat: 54.365, lon: 18.6395 }, -0.0005, 0.0002),
      },
      {
        type: "kawiarnia",
        name: "Stocznia Café",
        distanceM: 180,
        coords: nearCoords({ lat: 54.365, lon: 18.6395 }, 0.0006, -0.0004),
      },
    ],
  },
  {
    id: "8",
    title: "Parter z ogródkiem",
    pricePln: 732_000,
    areaM2: 57,
    address: "Gdańsk, Chełm",
    coords: { lat: 54.3405, lon: 18.6105 },
    profileType: "rodzinny",
    attractivenessScore: 0.74,
    source: { scraper: "demo", url: "https://example.com/oferta/8" },
    poi: [
      {
        type: "sklep",
        name: "Biedronka Chełm",
        distanceM: 260,
        coords: nearCoords({ lat: 54.3405, lon: 18.6105 }, 0.0005, 0.0004),
      },
      {
        type: "przystanek",
        name: "Chełm pętla",
        distanceM: 210,
        coords: nearCoords({ lat: 54.3405, lon: 18.6105 }, -0.0005, 0.0002),
      },
      {
        type: "park",
        name: "Zieleniec osiedlowy",
        distanceM: 310,
        coords: nearCoords({ lat: 54.3405, lon: 18.6105 }, 0.0004, -0.0005),
      },
    ],
  },
  {
    id: "9",
    title: "Blisko morza – Jelitkowo",
    pricePln: 1_050_000,
    areaM2: 60,
    address: "Gdańsk, Jelitkowo",
    coords: { lat: 54.42, lon: 18.6 },
    profileType: "uniwersalny",
    attractivenessScore: 0.88,
    source: { scraper: "demo", url: "https://example.com/oferta/9" },
    poi: [
      {
        type: "plaża",
        name: "Plaża Jelitkowo",
        distanceM: 550,
        coords: nearCoords({ lat: 54.42, lon: 18.6 }, 0.0007, 0.0003),
      },
      {
        type: "ścieżka rowerowa",
        name: "Bulwar nadmorski",
        distanceM: 200,
        coords: nearCoords({ lat: 54.42, lon: 18.6 }, -0.0005, 0.0002),
      },
      {
        type: "kawiarnia",
        name: "Kawiarnia przy plaży",
        distanceM: 260,
        coords: nearCoords({ lat: 54.42, lon: 18.6 }, 0.0004, -0.0004),
      },
    ],
  },
  {
    id: "10",
    title: "Budżetowe mieszkanie na Oruni",
    pricePln: 399_000,
    areaM2: 36,
    address: "Gdańsk, Orunia",
    coords: { lat: 54.333, lon: 18.64 },
    profileType: "studencki",
    attractivenessScore: 0.58,
    source: { scraper: "demo", url: "https://example.com/oferta/10" },
    poi: [
      {
        type: "przystanek",
        name: "Orunia",
        distanceM: 400,
        coords: nearCoords({ lat: 54.333, lon: 18.64 }, 0.0007, 0.0004),
      },
      {
        type: "apteka",
        name: "Apteka Orunia",
        distanceM: 280,
        coords: nearCoords({ lat: 54.333, lon: 18.64 }, -0.0006, 0.0005),
      },
      {
        type: "sklep",
        name: "Sklep osiedlowy Orunia",
        distanceM: 190,
        coords: nearCoords({ lat: 54.333, lon: 18.64 }, 0.0004, -0.0005),
      },
    ],
  },
];

// ----------------- funkcje eksportowane -----------------

export async function fetchListings(_params: SearchParams): Promise<Listing[]> {
  await new Promise((r) => setTimeout(r, 500));

  // na razie zwracamy wszystkie, z lekkim losowaniem profilu/atrakcyjności jeśli brak
  return MOCK_LISTINGS.map((x) => ({
    id: x.id,
    title: x.title,
    pricePln: x.pricePln,
    areaM2: x.areaM2,
    address: x.address,
    coords: x.coords,
    profileType: x.profileType ?? pick(PROFILES),
    attractivenessScore: x.attractivenessScore ?? score(),
    thumbnailUrl: x.thumbnailUrl,
  }));
}

export async function fetchListingById(id: string): Promise<ListingDetails> {
  await new Promise((r) => setTimeout(r, 400));
  const found = MOCK_LISTINGS.find((x) => x.id === id);
  if (found) return found;
  return {
    id,
    title: "Oferta",
    pricePln: 0,
    areaM2: 0,
    address: "—",
  };
}
