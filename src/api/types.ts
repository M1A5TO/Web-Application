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

  /**
   * Legacy fallback (same as before): list of direct photo URLs.
   * Prefer using `photoItems` when available.
   */
  photos?: string[];

  /**
   * Photos with metadata from /photos/{id}.
   * Allows details page to avoid extra client-side fetches.
   */
  photoItems?: Array<{
    id: number;
    url: string;
    photo_type?: string | null;
    room_type?: string | null;
    room_style?: string | null;
    style?: string | null;
  }>;

  scores?: {
    /** uniwersalne (0..100) */
    overall?: number;
    /** rodzinny (0..100) */
    family?: number;
    /** studencki (0..100) */
    commute?: number;
    /** właściciel psa (0..100) */
    green?: number;
    /** singiel (0..100) */
    services?: number;
  };
  source?: { scraper?: string; url?: string };
  poi?: Array<{
    type: string;
    name: string;
    distanceM: number;
    coords?: { lat: number; lon: number };
  }>;

  /** Opisy/klasyfikacje z backendu (GET /apartments/{id}) */
  poiDesc?: string;
  priceDesc?: string;
  sizeDesc?: string;
  pricePerM2Pln?: number;
  apartmentStyle?: string;
}
