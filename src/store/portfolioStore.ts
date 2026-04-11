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

// Flip to false once real API credentials are confirmed
const USE_MOCK_MARKET = true
export const USE_MOCK_BROKER = true

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
    set({ loadingPortfolio: true })
    try {
      if (USE_MOCK_BROKER) {
        // Real wallet balance lives in Supabase — authStore loads it on sign-in
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
        const account = await getAccountById(accountId)
        set({ account })
      }
    } catch (e) {
      console.error('loadAccount error:', e)
    } finally {
      set({ loadingPortfolio: false })
    }
  },

  loadPositions: async (accountId) => {
    set({ loadingPortfolio: true })
    try {
      const positions = USE_MOCK_BROKER
        ? []
        : await getClientPositions(accountId)
      set({ positions })
    } catch (e) {
      console.error('loadPositions error:', e)
      set({ positions: MOCK_POSITIONS })
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
      if (USE_MOCK_BROKER) {
        await new Promise((r) => setTimeout(r, 1200))
        set({
          orderResult: {
            success: true,
            message: `${order.side} order for ${order.quantity} units of ${order.symbol} placed successfully.`,
          },
        })
      } else {
        const result = await placeOrder(order)
        set({
          orderResult: {
            success: result.status === 'SUCCESS' || result.status === 'PENDING',
            message: result.message,
          },
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
