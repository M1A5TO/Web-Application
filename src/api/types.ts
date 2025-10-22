export type Profile = "uniwersalne" | "rodzina" | "student" | "singiel" | "wlasciciel-psa";

export interface SearchParams {
  location: string;
  profile: Profile;
}

export interface Listing {
  id: string;
  title: string;
  pricePln: number;
  areaM2: number;
  address: string;
  coords?: { lat: number; lon: number };
  attractivenessScore?: number;
  thumbnailUrl?: string;
}
