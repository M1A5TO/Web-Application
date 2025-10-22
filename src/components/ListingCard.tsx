import type { Listing } from "../api/types";

export default function ListingCard({ listing }: { listing: Listing }) {
  return (
    <div style={{border:"1px solid #e5e7eb",borderRadius:12,padding:12}}>
      <div style={{fontWeight:700}}>{listing.title}</div>
      <small>{listing.address}</small>
      <div style={{marginTop:8,display:"flex",gap:12}}>
        <div><b>{listing.pricePln.toLocaleString("pl-PL")}</b> PLN</div>
        <div>{listing.areaM2} m²</div>
      </div>
    </div>
  );
}
