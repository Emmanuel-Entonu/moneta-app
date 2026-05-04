const BROKER_BASE = (import.meta.env.VITE_BROKER_BASE_URL as string | undefined) || 'https://api.dev.mywealthcare.io'
export const BROKER_BASE_DISPLAY = BROKER_BASE
const USERNAME    = (import.meta.env.VITE_PAC_USERNAME    as string | undefined) || 'api.test'
const PASSWORD    = (import.meta.env.VITE_PAC_PASSWORD    as string | undefined) || '8QUYVaa9J5j#'
const TENANT_ID   = (import.meta.env.VITE_PAC_TENANT_ID   as string | undefined) || 'pac'

const MARKET_CODE = 'NGX'

const TRACKED_SYMBOLS = [
  'DANGCEM', 'GTCO', 'ZENITHBANK', 'MTNN', 'AIRTELAFRI',
  'FBNH', 'BUACEMENT', 'ACCESS', 'NESTLE', 'SEPLAT',
]

const SECURITY_NAMES: Record<string, string> = {
  DANGCEM:    'Dangote Cement Plc',
  GTCO:       'GT Holding Company Plc',
  ZENITHBANK: 'Zenith Bank Plc',
  MTNN:       'MTN Nigeria Comm. Plc',
  AIRTELAFRI: 'Airtel Africa Plc',
  FBNH:       'FBN Holdings Plc',
  BUACEMENT:  'BUA Cement Plc',
  ACCESS:     'Access Holdings Plc',
  NESTLE:     'Nestle Nigeria Plc',
  SEPLAT:     'Seplat Energy Plc',
}

let _bearerToken: string | null = null
let _tokenExpiry = 0
let _tokenPromise: Promise<string> | null = null

const PROXY_PATH = '/api/pac-proxy'

async function pacProxy<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const token = _bearerToken ?? ''
  const url = `${PROXY_PATH}?path=${encodeURIComponent(path)}`
  const isGet = method === 'GET' || method === 'HEAD'
  const res = await fetch(url, {
    method,
    headers: {
      ...(!isGet ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { 'x-pac-token': token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`Broker ${res.status}: ${await res.text()}`)
  return res.json()
}

async function getBearerToken(): Promise<string> {
  if (_bearerToken && Date.now() < _tokenExpiry) return _bearerToken
  if (!_tokenPromise) {
    _tokenPromise = pacProxy<{ token?: string; access_token?: string; expires_in?: number }>(
      '/administration/api/v1/users/token/daemon',
      'POST',
      { username: USERNAME, password: PASSWORD, tenant: TENANT_ID },
    ).then((data) => {
      _bearerToken = data.access_token ?? data.token ?? ''
      _tokenExpiry = Date.now() + ((data.expires_in ?? 1800) * 1000) - 60000
      _tokenPromise = null
      return _bearerToken
    }).catch((e) => {
      _tokenPromise = null
      throw e
    })
  }
  return _tokenPromise
}

async function mdsGet<T>(path: string): Promise<T> {
  const res = await fetch(`/api/mds-proxy?path=${encodeURIComponent(path)}`)
  if (!res.ok) throw new Error(`MDS ${res.status}: ${await res.text()}`)
  const json = await res.json()
  console.log('[mds raw]', path.split('?')[0], JSON.stringify(json).slice(0, 800))
  return json
}

async function brokerGet<T>(path: string): Promise<T> {
  await getBearerToken()
  return pacProxy<T>(path, 'GET')
}

async function brokerPost<T>(path: string, body: unknown): Promise<T> {
  await getBearerToken()
  return pacProxy<T>(path, 'POST', body)
}

export interface PacMarketData {
  symbol: string
  name: string
  price: number
  change: number
  changePercent: number
  volume: number
  high: number
  low: number
  open: number
}

export interface PacPosition {
  symbol: string
  securityName: string
  quantity: number
  averageCost: number
  currentPrice: number
  marketValue: number
  unrealizedPnL: number
  unrealizedPnLPercent: number
}

export interface PacAccount {
  id: string
  accountNumber: string
  accountName: string
  balance: number
  currency: string
  status: string
}

export interface PacOrderRequest {
  accountId: string
  symbol: string
  side: 'BUY' | 'SELL'
  quantity: number
  orderType: 'MARKET' | 'LIMIT'
  limitPrice?: number
  estimatedTotal?: number
}

export interface PacOrderResponse {
  id?: string
  orderId?: string
  orderStatus?: string
  routingStatus?: string
  status?: string
  routingMessage?: string
  message?: string
}

interface MdsPriceQuote {
  marketCode: string
  secId: string
  tradeDate: string
  open: number
  high: number
  low: number
  close: number
  lastPx: number
  volTraded: number
  valTraded: number
  percChange: number
  secType: string
}

interface MdsMover {
  marketCode?: string
  secId?: string
  symbol?: string
  ticker?: string
  securityName?: string
  name?: string
  lastPx?: number
  close?: number
  price?: number
  open?: number
  high?: number
  low?: number
  volTraded?: number
  volume?: number
  percChange?: number
  changePercent?: number
}

async function getPriceQuote(secId: string): Promise<PacMarketData> {
  const raw = await mdsGet<unknown>(
    `/api/v1/price/quote?marketCode=${MARKET_CODE}&secId=${secId}`
  )
  // Unwrap common API envelope shapes: {data:{...}}, {data:[{...}]}, {result:{...}}, [{...}]
  const r = raw as Record<string, unknown>
  const inner = r?.data ?? r?.result ?? raw
  const d = (Array.isArray(inner) ? inner[0] : inner) as MdsPriceQuote
  return normalizePriceQuote(d)
}

export async function getMarketData(): Promise<PacMarketData[]> {
  const results = await Promise.allSettled(
    TRACKED_SYMBOLS.map((sym) => getPriceQuote(sym))
  )
  const successful = results
    .filter((r): r is PromiseFulfilledResult<PacMarketData> => r.status === 'fulfilled')
    .map((r) => r.value)
  if (successful.length === 0) {
    const first = results.find((r): r is PromiseRejectedResult => r.status === 'rejected')
    throw new Error(first?.reason?.message ?? 'All MDS calls failed')
  }
  return successful
}

export async function getSecurityData(symbol: string): Promise<PacMarketData> {
  return getPriceQuote(symbol)
}

function unwrapList(raw: unknown): MdsMover[] {
  if (Array.isArray(raw)) return raw as MdsMover[]
  const r = raw as Record<string, unknown>
  const list = r?.data ?? r?.result ?? r?.items ?? []
  return Array.isArray(list) ? list as MdsMover[] : []
}

export async function getTopGainers(): Promise<PacMarketData[]> {
  const raw = await mdsGet<unknown>(`/api/v1/price/top-gainers?marketCode=${MARKET_CODE}`)
  return unwrapList(raw).map(normalizeMover)
}

export async function getTopLosers(): Promise<PacMarketData[]> {
  const raw = await mdsGet<unknown>(`/api/v1/price/top-losers?marketCode=${MARKET_CODE}`)
  return unwrapList(raw).map(normalizeMover)
}

export async function getMostActive(): Promise<PacMarketData[]> {
  const raw = await mdsGet<unknown>(`/api/v1/price/most-active?marketCode=${MARKET_CODE}`)
  return unwrapList(raw).map(normalizeMover)
}

export async function getHistoricalPrices(symbol: string, from: string, to: string) {
  return mdsGet(
    `/api/v1/price/history?marketCode=${MARKET_CODE}&secId=${symbol}&from=${from}&to=${to}`
  )
}

export async function getIndexData() {
  return mdsGet(`/api/v1/index?marketCode=${MARKET_CODE}`)
}

export async function getAccountById(accountId: string): Promise<PacAccount> {
  const data = await brokerGet<Record<string, unknown>>(
    `/position/api/v1/ledgers/report/trading/account/${accountId}?valueDate=${new Date().toISOString().split('T')[0]}`
  )
  return {
    id:            String(data.accountId ?? accountId),
    accountNumber: String(data.accountNo ?? ''),
    accountName:   String(data.accountLabel ?? ''),
    balance:       Number(data.totalValue ?? 0),
    currency:      String(data.reportCurrency ?? 'NGN'),
    status:        'ACTIVE',
  }
}

export async function getClientPositions(accountId: string): Promise<PacPosition[]> {
  const valueDate = new Date().toISOString().split('T')[0]
  const data = await brokerGet<{
    positionInstruments?: unknown[]
    positions?: unknown[]
    data?: unknown[]
  }>(`/position/api/v1/ledgers/report/trading/account/${accountId}?valueDate=${valueDate}`)
  const list = data.positionInstruments ?? data.positions ?? data.data ?? (Array.isArray(data) ? data : [])
  return (list as unknown[]).map(normalizePosition)
}

export async function placeOrder(order: PacOrderRequest): Promise<PacOrderResponse> {
  const body = {
    accountId:    order.accountId,
    secId:        order.symbol,
    side:         order.side,
    requestedQty: order.quantity,
    tif:          'DAY',
    marketCode:   'NGX',
    currency:     'NGN',
    numberOfLegs: 1,
    assetType:    'EQUITY',
    allOrNone:    false,
    autoApprove:  true,
    ...(order.limitPrice ? { limitPrice: order.limitPrice } : {}),
  }
  return brokerPost('/investing/api/v1/orders', body)
}

function normalizePriceQuote(d: MdsPriceQuote): PacMarketData {
  const raw       = d as unknown as Record<string, unknown>
  const price     = Number(d.lastPx ?? d.close ?? raw.lastPrice ?? raw.last ?? raw.price ?? 0)
  const open      = Number(d.open ?? raw.openPx ?? raw.openPrice ?? raw.openingPrice ?? 0)
  const prevClose = Number(raw.prevClose ?? raw.previousClose ?? raw.prevClosingPrice ?? raw.previousClosePrice ?? 0)
  const ref       = open || prevClose
  const change    = ref > 0 ? price - ref : 0
  const apiPct    = Number(
    d.percChange ?? raw.percentageChange ?? raw.changePercent ??
    raw.pctChange ?? raw.pctChg ?? raw.priceChangePct ?? raw.dailyChangePct ?? 0
  )
  const changePercent = apiPct !== 0 ? apiPct : (ref > 0 ? (change / ref) * 100 : 0)
  const sym = d.secId ?? String(raw.symbol ?? raw.ticker ?? raw.secId ?? '')
  return {
    symbol:        sym,
    name:          SECURITY_NAMES[sym] ?? sym,
    price,
    change,
    changePercent,
    volume:        Number(d.volTraded ?? raw.volume ?? raw.totalVolume ?? 0),
    high:          Number(d.high ?? raw.highPrice ?? 0),
    low:           Number(d.low  ?? raw.lowPrice  ?? 0),
    open,
  }
}

function normalizeMover(d: MdsMover): PacMarketData {
  const sym    = String(d.secId ?? d.symbol ?? d.ticker ?? '')
  const price  = Number(d.lastPx ?? d.close ?? d.price ?? 0)
  const open   = Number(d.open ?? 0)
  const pct    = Number(d.percChange ?? d.changePercent ?? 0)
  return {
    symbol:        sym,
    name:          String(d.securityName ?? d.name ?? SECURITY_NAMES[sym] ?? sym),
    price,
    change:        price - open,
    changePercent: pct,
    volume:        Number(d.volTraded ?? d.volume ?? 0),
    high:          Number(d.high ?? 0),
    low:           Number(d.low  ?? 0),
    open,
  }
}

function normalizePosition(d: unknown): PacPosition {
  const r   = d as Record<string, unknown>
  const qty = Number(r.quantity     ?? r.units       ?? 0)
  const avg = Number(r.avgCost      ?? r.averageCost ?? r.costPrice    ?? 0)
  const cur = Number(r.currentPrice ?? r.lastPrice   ?? r.price        ?? 0)
  const val = Number(r.currentValue ?? r.marketValue ?? qty * cur)
  const pnl = Number(r.unrealizedPnL ?? r.unrealisedPnL ?? val - avg * qty)
  return {
    symbol:               String(r.secId ?? r.symbol ?? r.ticker ?? ''),
    securityName:         String(r.secDesc ?? r.securityName ?? r.name ?? ''),
    quantity:             qty,
    averageCost:          avg,
    currentPrice:         cur,
    marketValue:          val,
    unrealizedPnL:        pnl,
    unrealizedPnLPercent: avg > 0 && qty > 0 ? (pnl / (avg * qty)) * 100 : 0,
  }
}


export async function createBrokerAccount(details: {
  fullName: string
  email: string
  phone: string
  bvn: string
}): Promise<string> {
  const data = await brokerPost<Record<string, unknown>>(
    '/position/api/v1/accounts',
    {
      name:    details.fullName,
      email:   details.email,
      phone:   details.phone,
      bvn:     details.bvn,
      currency: 'NGN',
    }
  )
  const id = data.accountId ?? data.id ?? data.account_id ?? data.accountNumber ?? ''
  if (!id) throw new Error('Broker did not return an account ID')
  return String(id)
}

export const MOCK_MARKET_DATA: PacMarketData[] = [
  { symbol: 'DANGCEM',    name: 'Dangote Cement Plc',      price: 582.00, change: 12.50,  changePercent: 2.19,  volume: 1243000, high: 590.00, low: 568.00, open: 570.00 },
  { symbol: 'GTCO',       name: 'GT Holding Company Plc',  price: 51.85,  change: -0.65,  changePercent: -1.24, volume: 5670000, high: 53.00,  low: 51.50,  open: 52.50  },
  { symbol: 'ZENITHBANK', name: 'Zenith Bank Plc',         price: 37.50,  change: 0.90,   changePercent: 2.46,  volume: 8920000, high: 38.00,  low: 36.50,  open: 36.80  },
  { symbol: 'MTNN',       name: 'MTN Nigeria Comm. Plc',   price: 220.10, change: -3.40,  changePercent: -1.52, volume: 2100000, high: 225.00, low: 219.00, open: 224.00 },
  { symbol: 'AIRTELAFRI', name: 'Airtel Africa Plc',       price: 1850.00,change: 45.00,  changePercent: 2.49,  volume: 430000,  high: 1870.00,low: 1800.00,open: 1810.00 },
  { symbol: 'FBNH',       name: 'FBN Holdings Plc',        price: 22.30,  change: 0.30,   changePercent: 1.36,  volume: 6100000, high: 22.80,  low: 21.90,  open: 22.00  },
  { symbol: 'BUACEMENT',  name: 'BUA Cement Plc',          price: 119.90, change: -1.10,  changePercent: -0.91, volume: 880000,  high: 122.00, low: 119.00, open: 121.00 },
  { symbol: 'ACCESS',     name: 'Access Holdings Plc',     price: 19.75,  change: 0.25,   changePercent: 1.28,  volume: 9450000, high: 20.00,  low: 19.40,  open: 19.50  },
  { symbol: 'NESTLE',     name: 'Nestle Nigeria Plc',      price: 1050.00,change: -20.00, changePercent: -1.87, volume: 95000,   high: 1080.00,low: 1045.00,open: 1070.00 },
  { symbol: 'SEPLAT',     name: 'Seplat Energy Plc',       price: 4500.00,change: 120.00, changePercent: 2.74,  volume: 210000,  high: 4550.00,low: 4380.00,open: 4400.00 },
]

export const MOCK_POSITIONS: PacPosition[] = [
  { symbol: 'DANGCEM',    securityName: 'Dangote Cement Plc',     quantity: 50,   averageCost: 560.00, currentPrice: 582.00, marketValue: 29100, unrealizedPnL: 1100,  unrealizedPnLPercent: 3.93  },
  { symbol: 'GTCO',       securityName: 'GT Holding Company Plc', quantity: 500,  averageCost: 49.00,  currentPrice: 51.85,  marketValue: 25925, unrealizedPnL: 1425,  unrealizedPnLPercent: 5.82  },
  { symbol: 'ZENITHBANK', securityName: 'Zenith Bank Plc',        quantity: 800,  averageCost: 38.50,  currentPrice: 37.50,  marketValue: 30000, unrealizedPnL: -800,  unrealizedPnLPercent: -2.60 },
  { symbol: 'ACCESS',     securityName: 'Access Holdings Plc',    quantity: 1000, averageCost: 18.00,  currentPrice: 19.75,  marketValue: 19750, unrealizedPnL: 1750,  unrealizedPnLPercent: 9.72  },
]
