type Props = { markers?: Array<{ id: string; lat: number; lon: number; title?: string }>; };

export default function MapPlaceholder({ markers = [] }: Props) {
  return (
    <div style={{
      height:420,border:"1px dashed #e5e7eb",borderRadius:12,
      display:"grid",placeItems:"center",background:"#fafafa"
    }}>
      <div style={{textAlign:"center"}}>
        <div>Mapa wyników (placeholder)</div>
        <small>Markery: {markers.length}</small>
      </div>
    </div>
  );
}
