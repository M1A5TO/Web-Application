export type Profile = "uniwersalne" | "rodzina" | "student" | "singiel";

export interface SearchParams {
  location: string;
  profile: "uniwersalne" | "rodzina" | "student" | "singiel";
  priceMax?: number;
  areaMin?: number;
  maxDistanceKm?: number;
}

// src/api/types.ts
export type ProfileType = "rodzinny" | "studencki" | "singiel" | "uniwersalny";


export interface Listing {
  id: string;
  title: string;
  pricePln: number;
  areaM2: number;
  address: string;
  coords?: { lat: number; lon: number };

  // z bazy (na razie mockowane w client.ts)
  profileType?: ProfileType;
  attractivenessScore?: number;

  thumbnailUrl?: string;
}

/** Szkielet danych dla ekranu szczegółów (na razie wszystko opcjonalne) */
export interface ListingDetails extends Listing {
  description?: string;
  photos?: string[]; // podgląd zdjęć
  scores?: { overall?: number; commute?: number; green?: number; services?: number }; // "alg-roz"
  source?: { scraper?: string; url?: string }; // źródło/scraper
  poi?: Array<{ type: string; name: string; distanceM: number; coords?: { lat: number; lon: number } }>;
}