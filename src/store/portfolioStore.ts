import { create } from 'zustand'
import {
  getClientPositions,
  getMarketData,
  getAccountById,
  placeOrder,
  type PacPosition,
  type PacMarketData,
  type PacAccount,
  type PacOrderRequest,
} from '../lib/pacApi'
import { useAuthStore } from './authStore'

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
      const account = await getAccountById(accountId)
      set({ account })
    } catch (e) {
      console.error('loadAccount error:', e)
    }
  },

  loadPositions: async (accountId) => {
    set({ loadingPortfolio: true, apiStatus: null })
    try {
      const positions = await getClientPositions(accountId)
      set({ positions })
    } catch (e) {
      const msg = (e as Error).message ?? String(e)
      console.error('loadPositions error:', msg)
      // 404 means the broker account doesn't exist yet — show empty, no error banner
      if (msg.includes('404') || msg.toLowerCase().includes('not found')) {
        set({ positions: [] })
      } else {
        set({ positions: [], apiStatus: `ERROR: ${msg}` })
      }
    } finally {
      set({ loadingPortfolio: false })
    }
  },

  loadMarketData: async () => {
    set({ loadingMarket: true, apiStatus: null })
    try {
      const marketData = await getMarketData()
      set({ marketData })
    } catch (e) {
      const msg = (e as Error).message ?? String(e)
      set({ marketData: [], apiStatus: `Market data error: ${msg}` })
    } finally {
      set({ loadingMarket: false })
    }
  },

  placeOrder: async (order) => {
    set({ orderLoading: true, orderResult: null })
    try {
      const result = await placeOrder(order)
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
          user_id: userId, symbol: order.symbol, side: order.side,
          order_type: order.orderType, quantity: order.quantity,
          limit_price: order.limitPrice ?? null,
          estimated_total: order.estimatedTotal ?? null,
          pac_order_id: result.id ?? result.orderId ?? null,
          status: success ? 'placed' : 'failed',
        })
      }
    } catch (e: unknown) {
      set({ orderResult: { success: false, message: (e as Error).message } })
    } finally {
      set({ orderLoading: false })
    }
  },

  clearOrderResult: () => set({ orderResult: null }),

  fundWallet: async (amountNaira) => {
    await useAuthStore.getState().creditWallet(amountNaira)
    const newBalance = useAuthStore.getState().walletBalance
    const current = get().account
    if (current) set({ account: { ...current, balance: newBalance } })
  },

  deductBalance: async (amountNaira) => {
    await useAuthStore.getState().debitWallet(amountNaira)
    const newBalance = useAuthStore.getState().walletBalance
    const current = get().account
    if (current) set({ account: { ...current, balance: newBalance } })
  },
}))
