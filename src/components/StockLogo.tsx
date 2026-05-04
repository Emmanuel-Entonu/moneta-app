import { useState } from 'react'

const SYMBOL_DOMAIN: Record<string, string> = {
  // Banks
  GTCO:         'gtbank.com',
  ZENITHBANK:   'zenithbank.com',
  ACCESS:       'accessbank.com',
  ACCESSCORP:   'accessbank.com',
  FBNH:         'firstbanknigeria.com',
  UBA:          'ubagroup.com',
  FIDELITYBK:   'fidelitybank.ng',
  STANBIC:      'stanbicibtc.com',
  FCMB:         'fcmb.com',
  WEMABANK:     'wemabank.com',
  STERLINGBANK: 'sterling.ng',
  JAIZBANK:     'jaizbank.com',
  UNITYBNK:     'unitybankng.com',
  ETI:          'ecobank.com',
  // Cement / Construction
  DANGCEM:      'dangote.com',
  BUACEMENT:    'buacement.com',
  WAPCO:        'lafarge.com',
  LAFARGE:      'lafarge.com',
  JBERGER:      'julius-berger.com',
  // Telecom
  MTNN:         'mtn.ng',
  AIRTELAFRI:   'airtel.africa',
  // Energy / Oil
  SEPLAT:       'seplatpetroleum.com',
  OANDO:        'oandoplc.com',
  TOTAL:        'totalenergies.com',
  TOTALENERGIES:'totalenergies.com',
  ARDOVA:       'ardovaplc.com',
  // Consumer / FMCG
  NESTLE:       'nestle.com',
  DANGSUGAR:    'dangote.com',
  BUAFOODS:     'buagroup.com',
  NB:           'nbplc.com',
  GUINNESS:     'guinness.com',
  CADBURY:      'cadbury.co.uk',
  UNILEVER:     'unilever.com',
  FLOURMILL:    'flourmillsng.com',
  HONYFLOUR:    'honeyflourmill.com',
  VITAFOAM:     'vitafoam.com.ng',
  // Agriculture
  PRESCO:       'presco.com.ng',
  OKOMUOIL:     'okomuoil.com',
  // Conglomerate / Others
  TRANSCORP:    'transcorpgroup.com',
  CORONATION:   'coronationmb.com',
  CUTIX:        'cutix.com.ng',
}

const TICKER_COLORS: Record<string, string> = {
  DANGCEM: '#f59e0b', GTCO: '#ef4444', ZENITHBANK: '#8b5cf6',
  MTNN: '#eab308', AIRTELAFRI: '#ec4899', FBNH: '#3b82f6',
  BUACEMENT: '#f97316', ACCESS: '#10b981', NESTLE: '#d97706', SEPLAT: '#6366f1',
  UBA: '#0ea5e9', STANBIC: '#14b8a6', FCMB: '#a855f7', FIDELITYBK: '#f43f5e',
  WEMABANK: '#84cc16', STERLINGBANK: '#06b6d4', JAIZBANK: '#10b981',
  TRANSCORP: '#f59e0b', OANDO: '#6366f1', PRESCO: '#22c55e',
  CADBURY: '#a16207', UNILEVER: '#0284c7', FLOURMILL: '#ca8a04',
  DANGSUGAR: '#dc2626', CORONATION: '#7c3aed', NB: '#b45309', VITAFOAM: '#065f46',
}
const COLOR_POOL = [
  '#f59e0b','#ef4444','#8b5cf6','#eab308','#ec4899','#3b82f6',
  '#f97316','#10b981','#d97706','#6366f1','#0ea5e9','#14b8a6',
  '#a855f7','#f43f5e','#84cc16','#06b6d4','#22c55e','#dc2626',
]
export function tickerColor(sym: string): string {
  if (TICKER_COLORS[sym]) return TICKER_COLORS[sym]
  let hash = 0
  for (let i = 0; i < sym.length; i++) hash = sym.charCodeAt(i) + ((hash << 5) - hash)
  return COLOR_POOL[Math.abs(hash) % COLOR_POOL.length]
}

interface StockLogoProps {
  symbol: string
  size?: number
  radius?: number
}

export default function StockLogo({ symbol, size = 46, radius = 14 }: StockLogoProps) {
  const [failed, setFailed] = useState(false)
  const domain = SYMBOL_DOMAIN[symbol]
  const color = tickerColor(symbol)
  const initials = symbol.replace(/[^A-Z]/gi, '').slice(0, 3).toUpperCase()

  if (domain && !failed) {
    // Google's S2 favicon service: returns the real favicon at sz=64,
    // or a 16×16 generic globe (ignoring sz) when it has nothing — we
    // detect the generic globe via naturalWidth and fall back to avatar.
    const src = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`
    return (
      <div style={{
        width: size, height: size, borderRadius: radius, flexShrink: 0,
        background: '#ffffff',
        border: '1.5px solid rgba(255,255,255,0.12)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
        boxShadow: '0 2px 10px rgba(0,0,0,0.25)',
      }}>
        <img
          src={src}
          alt={symbol}
          style={{ width: '78%', height: '78%', objectFit: 'contain' }}
          onLoad={(e) => {
            if (e.currentTarget.naturalWidth <= 16) setFailed(true)
          }}
          onError={() => setFailed(true)}
        />
      </div>
    )
  }

  return (
    <div style={{
      width: size, height: size, borderRadius: radius, flexShrink: 0,
      background: `linear-gradient(145deg, ${color}30, ${color}14)`,
      border: `1.5px solid ${color}45`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: `0 2px 10px ${color}18`,
    }}>
      <span style={{ fontSize: Math.round(size * 0.24), fontWeight: 900, color, letterSpacing: -0.5 }}>
        {initials}
      </span>
    </div>
  )
}
