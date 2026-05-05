import { create } from 'zustand'
import {
  getClientPositions,
  getMarketData,
  getAccountById,
  placeOrder,
  cancelOrder,
  listOrders,
  listFills,
  type PacPosition,
  type PacMarketData,
  type PacAccount,
  type PacOrderRequest,
  type PacOrderListItem,
  type PacOrderFill,
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

  pacOrders: PacOrderListItem[]
  loadingOrders: boolean
  orderFills: Record<string, PacOrderFill[]>
  loadingFillsId: string | null

  loadAccount: (accountId: string) => Promise<void>
  loadPositions: (accountId: string) => Promise<void>
  loadMarketData: () => Promise<void>
  loadOrders: (accountId: string) => Promise<void>
  loadFills: (orderId: string) => Promise<void>
  placeOrder: (order: PacOrderRequest) => Promise<void>
  cancelOrder: (pacOrderId: string, supabaseOrderId: string | null) => Promise<void>
  clearOrderResult: () => void

  get totalValue(): number
  get totalPnL(): number
  get totalPnLPercent(): number
}

export const usePortfolioStore = create<PortfolioState>((set, get) => ({
  account: null,
  positions: [],
  marketData: [],
  pacOrders: [],
  orderFills: {},
  loadingPortfolio: false,
  loadingMarket: false,
  loadingOrders: false,
  loadingFillsId: null,
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

  loadOrders: async (accountId) => {
    set({ loadingOrders: true })
    try {
      const pacOrders = await listOrders(accountId)
      set({ pacOrders })
    } catch (e) {
      console.error('[loadOrders] error:', e)
      set({ pacOrders: [] })
    } finally {
      set({ loadingOrders: false })
    }
  },

  loadFills: async (orderId) => {
    set({ loadingFillsId: orderId })
    try {
      const fills = await listFills(orderId)
      set(state => ({ orderFills: { ...state.orderFills, [orderId]: fills } }))
    } catch (e) {
      console.error('[loadFills] error:', e)
      set(state => ({ orderFills: { ...state.orderFills, [orderId]: [] } }))
    } finally {
      set({ loadingFillsId: null })
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
      // Log to Supabase — wrapped separately so a logging failure never overwrites the order result
      try {
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
      } catch (logErr) {
        console.error('[placeOrder] Supabase logging failed:', logErr)
      }
    } catch (e: unknown) {
      set({ orderResult: { success: false, message: (e as Error).message } })
    } finally {
      set({ orderLoading: false })
    }
  },

  cancelOrder: async (pacOrderId: string, supabaseOrderId: string | null) => {
    try {
      await cancelOrder(pacOrderId)
      // Optimistically update live orders list
      set(state => ({
        pacOrders: state.pacOrders.map(o =>
          o.id === pacOrderId ? { ...o, orderStatus: 'PENDING_CANCEL' } : o
        ),
      }))
      // Update Supabase record if we have the ID
      if (supabaseOrderId) {
        try {
          const { supabase } = await import('../lib/supabase')
          await supabase.from('orders').update({ status: 'cancelled' }).eq('id', supabaseOrderId)
        } catch (logErr) {
          console.error('[cancelOrder] Supabase update failed:', logErr)
        }
      }
    } catch (e: unknown) {
      throw new Error((e as Error).message)
    }
  },

  clearOrderResult: () => set({ orderResult: null }),
}))
