import { useMapStore } from '@/store/mapStore'

export function GraticuleFrame() {
  const { view, cursor } = useMapStore()
  
  // Format coordinate nicely (e.g. 14°30'00" N)
  const formatCoord = (deg: number, isLat: boolean) => {
    const absDeg = Math.abs(deg)
    const d = Math.floor(absDeg)
    const min = Math.floor((absDeg - d) * 60)
    const sec = Math.floor(((absDeg - d) * 60 - min) * 60)
    const dir = isLat ? (deg >= 0 ? 'N' : 'S') : (deg >= 0 ? 'E' : 'W')
    return `${d}°${min.toString().padStart(2, '0')}'${sec.toString().padStart(2, '0')}" ${dir}`
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden border-[8px] border-[#020509]">
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 h-6 bg-gradient-to-b from-[#020509]/80 to-transparent flex items-start justify-center text-[10px] font-mono text-ink-3">
        {formatCoord(view.longitude, false)}
      </div>
      
      {/* Bottom bar */}
      <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-[#020509]/80 to-transparent flex items-end justify-center pb-1 text-[10px] font-mono text-ink-3">
        {cursor ? formatCoord(cursor.lon, false) : formatCoord(view.longitude, false)}
      </div>
      
      {/* Left bar */}
      <div className="absolute top-0 bottom-0 left-0 w-6 bg-gradient-to-r from-[#020509]/80 to-transparent flex flex-col justify-center items-start pl-1 text-[10px] font-mono text-ink-3">
        <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
          {formatCoord(view.latitude, true)}
        </div>
      </div>
      
      {/* Right bar */}
      <div className="absolute top-0 bottom-0 right-0 w-6 bg-gradient-to-l from-[#020509]/80 to-transparent flex flex-col justify-center items-end pr-1 text-[10px] font-mono text-ink-3">
        <div style={{ writingMode: 'vertical-rl' }}>
          {cursor ? formatCoord(cursor.lat, true) : formatCoord(view.latitude, true)}
        </div>
      </div>
    </div>
  )
}
