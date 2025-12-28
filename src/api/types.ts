// src/api/types.ts

// profil wyszukiwania (to co idzie w query ?profile=)
export type Profile = "uniwersalne" | "rodzina" | "student" | "singiel" | "wlasciciel_psa";

export interface SearchParams {
  location: string;
  profile: Profile;
  priceMax?: number;
  areaMin?: number;
  maxDistanceKm?: number;
}

// profil opisowy w UI (etykieta na karcie)
export type ProfileType = "rodzinny" | "studencki" | "singiel" | "uniwersalny" | "wlasciciel_psa";

export interface Listing {
  id: string;
  title: string;
  pricePln: number;
  areaM2: number;
  address: string;
  coords?: { lat: number; lon: number };

  profileType?: ProfileType;
  attractivenessScore?: number;

  thumbnailUrl?: string;
}

/** Dane dla ekranu szczegółów */
export interface ListingDetails extends Listing {
  description?: string;
  photos?: string[];
  scores?: {
    overall?: number;
    commute?: number;
    green?: number;
    services?: number;
  };
  source?: { scraper?: string; url?: string };
  poi?: Array<{
    type: string;
    name: string;
    distanceM: number;
    coords?: { lat: number; lon: number };
  }>;
}
