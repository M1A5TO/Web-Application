import type { Listing, SearchParams } from "./types";

export async function fetchListings(_params: SearchParams): Promise<Listing[]> {
  // MOCK — podmienisz na fetch('/api/...') gdy backend będzie gotowy
  await new Promise(r => setTimeout(r, 500));
  return [
    { id:"1", title:"2-pok. blisko parku", pricePln:699000, areaM2:48, address:"Gdańsk, Wrzeszcz", coords:{lat:54.38,lon:18.61} },
    { id:"2", title:"Kawalerka – centrum",  pricePln:479000, areaM2:28, address:"Gdańsk, Śródmieście", coords:{lat:54.352,lon:18.646} },
  ];
}
