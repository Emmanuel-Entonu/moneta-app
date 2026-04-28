import { create } from 'zustand'
import {
  getClientPositions,
  getMarketData,
  getAccountById,
  placeOrder,
  MOCK_POSITIONS,
  MOCK_MARKET_DATA,
  type PacPosition,
  type PacMarketData,
  type PacAccount,
  type PacOrderRequest,
} from '../lib/pacApi'
import { useAuthStore } from './authStore'

const USE_MOCK_MARKET = true
export const USE_MOCK_BROKER = false
const USE_MOCK_ORDERS = false
const PAC_TEST_ACCOUNT_ID = '0f4ce611-3a2c-4ba0-8c7d-2e2f0587741e'

interface PortfolioState {
  apiStatus: string | null
  account: PacAccount | null
  positions: PacPosition[]
  marketData: PacMarketData[]
  loadingPortfolio: boolean
  loadingMarket: boolean
  orderLoading: boolean
  orderResult: { success: boolean; message: string } | null

  loadAccount: (accountId: string) => Promise<void>
  loadPositions: (accountId: string) => Promise<void>
  loadMarketData: () => Promise<void>
  placeOrder: (order: PacOrderRequest) => Promise<void>
  clearOrderResult: () => void
  fundWallet: (amountNaira: number) => Promise<void>
  deductBalance: (amountNaira: number) => Promise<void>

  get totalValue(): number
  get totalPnL(): number
  get totalPnLPercent(): number
}

export const usePortfolioStore = create<PortfolioState>((set, get) => ({
  account: null,
  positions: [],
  marketData: [],
  loadingPortfolio: false,
  loadingMarket: false,
  orderLoading: false,
  orderResult: null,
  apiStatus: null,

  get totalValue() {
    return get().positions.reduce((sum, p) => sum + p.marketValue, 0)
  },
  get totalPnL() {
    return get().positions.reduce((sum, p) => sum + p.unrealizedPnL, 0)
  },
  get totalPnLPercent() {
    const cost = get().positions.reduce(
      (sum, p) => sum + p.averageCost * p.quantity,
      0
    )
    if (cost === 0) return 0
    return (get().totalPnL / cost) * 100
  },

  loadAccount: async (accountId) => {
    try {
      if (USE_MOCK_BROKER) {
        const balance = useAuthStore.getState().walletBalance
        set({
          account: {
            id: accountId,
            accountNumber: 'PAC-001234',
            accountName: 'Test Account',
            balance,
            currency: 'NGN',
            status: 'ACTIVE',
          },
        })
      } else {
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(accountId ?? '')
        const realId = isUUID ? accountId : PAC_TEST_ACCOUNT_ID
        const account = await getAccountById(realId)
        set({ account })
      }
    } catch (e) {
      console.error('loadAccount error:', e)
    }
  },

  loadPositions: async (accountId) => {
    set({ loadingPortfolio: true })
    try {
      if (USE_MOCK_BROKER) {
        set({ positions: MOCK_POSITIONS })
      } else {
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(accountId ?? '')
        const realId = isUUID ? accountId : PAC_TEST_ACCOUNT_ID
        const { BROKER_BASE_DISPLAY } = await import('../lib/pacApi')
        set({ apiStatus: `base=${BROKER_BASE_DISPLAY.substring(0,30)} id=${realId.substring(0,8)}` })
        const positions = await getClientPositions(realId)
        set({ positions, apiStatus: `live: ${positions.length} positions` })
      }
    } catch (e) {
      const msg = (e as Error).message ?? String(e)
      console.error('loadPositions error:', msg)
      set({ positions: [], apiStatus: `ERROR: ${msg}` })
    } finally {
      set({ loadingPortfolio: false })
    }
  },

  loadMarketData: async () => {
    set({ loadingMarket: true })
    try {
      if (USE_MOCK_MARKET) {
        set({ marketData: MOCK_MARKET_DATA, apiStatus: 'mock' })
      } else {
        const marketData = await getMarketData()
        if (marketData.length > 0) {
          set({ marketData, apiStatus: 'live' })
        } else {
          set({ marketData: MOCK_MARKET_DATA, apiStatus: 'mock: API returned empty' })
        }
      }
    } catch (e) {
      const msg = (e as Error).message ?? String(e)
      set({ marketData: MOCK_MARKET_DATA, apiStatus: `error: ${msg}` })
    } finally {
      set({ loadingMarket: false })
    }
  },

  placeOrder: async (order) => {
    set({ orderLoading: true, orderResult: null })
    try {
      if (USE_MOCK_ORDERS) {
        await new Promise((r) => setTimeout(r, 1200))
        const msg = `${order.side} order for ${order.quantity} units of ${order.symbol} placed successfully.`
        set({ orderResult: { success: true, message: msg } })
        const { supabase } = await import('../lib/supabase')
        const userId = useAuthStore.getState().user?.id
        if (userId) {
          await supabase.from('orders').insert({
            user_id: userId, symbol: order.symbol, side: order.side,
            order_type: order.orderType, quantity: order.quantity,
            limit_price: order.limitPrice ?? null,
            estimated_total: order.estimatedTotal ?? null,
            pac_order_id: null, status: 'placed',
          })
        }
      } else {
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(order.accountId ?? '')
        const realOrder = { ...order, accountId: isUUID ? order.accountId : PAC_TEST_ACCOUNT_ID }
        const result = await placeOrder(realOrder)
        const routingOk = result.routingStatus === 'ACCEPTED' || result.routingStatus === 'DELIVERED'
        const statusOk = result.orderStatus === 'PENDING' || result.orderStatus === 'NEW' ||
          result.orderStatus === 'FILLED' || result.orderStatus === 'PARTIALLY_FILLED' ||
          result.status === 'SUCCESS' || result.status === 'PENDING'
        const success = routingOk || statusOk || !!(result.id ?? result.orderId)
        set({
          orderResult: {
            success,
            message: result.routingMessage ?? result.message ?? (success ? 'Order placed' : 'Order failed'),
          },
        })
        const { supabase } = await import('../lib/supabase')
        const userId = useAuthStore.getState().user?.id
        if (userId) {
          await supabase.from('orders').insert({
            user_id: userId, symbol: realOrder.symbol, side: realOrder.side,
            order_type: realOrder.orderType, quantity: realOrder.quantity,
            limit_price: realOrder.limitPrice ?? null,
            estimated_total: realOrder.estimatedTotal ?? null,
            pac_order_id: result.id ?? result.orderId ?? null,
            status: success ? 'placed' : 'failed',
          })
        }
      }
    } catch (e: unknown) {
      set({ orderResult: { success: false, message: (e as Error).message } })
    } finally {
      set({ orderLoading: false })
    }
  },

  clearOrderResult: () => set({ orderResult: null }),

  fundWallet: async (amountNaira) => {
    // Persist to Supabase via authStore, then sync local display balance
    await useAuthStore.getState().creditWallet(amountNaira)
    const newBalance = useAuthStore.getState().walletBalance
    const current = get().account
    if (current) set({ account: { ...current, balance: newBalance } })
  },

  deductBalance: async (amountNaira) => {
    // Persist to Supabase via authStore, then sync local display balance
    await useAuthStore.getState().debitWallet(amountNaira)
    const newBalance = useAuthStore.getState().walletBalance
    const current = get().account
    if (current) set({ account: { ...current, balance: newBalance } })
  },
}))
