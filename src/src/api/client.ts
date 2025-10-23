// src/api/client.ts
import type { Listing, ListingDetails, SearchParams, ProfileType } from "./types";

function pick<T>(xs: T[]): T {
  return xs[Math.floor(Math.random() * xs.length)];
}
function score(): number {
  // 0.50–0.95, zaokrąglone do 2 miejsc
  return Math.round((0.5 + Math.random() * 0.45) * 100) / 100;
}

export async function fetchListings(_params: SearchParams): Promise<Listing[]> {
  await new Promise((r) => setTimeout(r, 500));

  const profiles: ProfileType[] = ["rodzinny", "studencki", "singiel", "uniwersalny"];

  return [
    {
      id: "1",
      title: "2-pok. blisko parku",
      pricePln: 699000,
      areaM2: 48,
      address: "Gdańsk, Wrzeszcz",
      coords: { lat: 54.38, lon: 18.61 },
      profileType: pick(profiles),
      attractivenessScore: score(),
    },
    {
      id: "2",
      title: "Kawalerka – centrum",
      pricePln: 479000,
      areaM2: 28,
      address: "Gdańsk, Śródmieście",
      coords: { lat: 54.352, lon: 18.646 },
      profileType: pick(profiles),
      attractivenessScore: score(),
    },
  ];
}

/** MOCK: szczegóły jednego mieszkania */
export async function fetchListingById(id: string): Promise<ListingDetails> {
  await new Promise((r) => setTimeout(r, 400));
  const base: Record<string, ListingDetails> = {
    "1": {
      id: "1",
      title: "2-pok. blisko parku",
      pricePln: 699000,
      areaM2: 48, 
      address: "Gdańsk, Wrzeszcz",
      coords: { lat: 54.38, lon: 18.61 },
      profileType: "rodzinny",
      attractivenessScore: 0.76,
      photos: [],
      scores: { overall: 0.76, commute: 0.72, green: 0.85, services: 0.7 },
      source: { scraper: "demo", url: "https://example.com/oferta/1" },
      poi: [
        { type: "park", name: "Park Akademicki", distanceM: 450 },
        { type: "sklep", name: "Żabka", distanceM: 180 },
      ],
      description: "Placeholder opisu oferty. Tu pojawią się dane ze scrapera/API.",
    },
    "2": {
      id: "2",
      title: "Kawalerka — centrum",
      pricePln: 479000,
      areaM2: 28,
      address: "Gdańsk, Śródmieście",
      coords: { lat: 54.352, lon: 18.646 },
      profileType: "studencki",
      attractivenessScore: 0.64,
      scores: { overall: 0.64, commute: 0.9, green: 0.4, services: 0.88 },
      source: { scraper: "demo", url: "https://example.com/oferta/2" },
      poi: [{ type: "tramwaj", name: "Przystanek Hucisko", distanceM: 220 }],
    },
  };
  return base[id] ?? { id, title: "Oferta", pricePln: 0, areaM2: 0, address: "—" };
}
