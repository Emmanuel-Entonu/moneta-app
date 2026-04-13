import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { User, Session } from '@supabase/supabase-js'

interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
  profileReady: boolean
  pacAccountId: string | null
  kycStatus: 'pending' | 'submitted' | 'verified' | 'rejected'
  walletBalance: number

  setSession: (session: Session | null) => void
  signIn: (email: string, password: string) => Promise<string | null>
  signUp: (email: string, password: string, fullName: string) => Promise<string | null>
  signOut: () => Promise<void>
  loadProfile: () => Promise<void>

  /** Credit the wallet after a successful payment — updates Supabase */
  creditWallet: (amountNaira: number) => Promise<void>
  /** Debit the wallet for a stock purchase — updates Supabase */
  debitWallet: (amountNaira: number) => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  loading: true,
  profileReady: false,
  pacAccountId: null,
  kycStatus: 'pending',
  walletBalance: 0,

  setSession: (session) => {
    set({ session, user: session?.user ?? null, loading: false })
    if (session?.user) get().loadProfile()
  },

  signIn: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return error?.message ?? null
  },

  signUp: async (email, password, fullName) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })
    if (error) return error.message
    return null
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null, session: null, pacAccountId: null, kycStatus: 'pending', walletBalance: 0, profileReady: false })
  },

  loadProfile: async () => {
    const { user } = get()
    if (!user) return

    // Core profile — these columns always exist
    const { data: profile } = await supabase
      .from('profiles')
      .select('pac_account_id, kyc_status')
      .eq('id', user.id)
      .single()
    if (profile) {
      set({
        pacAccountId: profile.pac_account_id,
        kycStatus: profile.kyc_status as AuthState['kycStatus'],
      })
    }

    // Wallet balance — separate query so a missing column doesn't break the rest
    const { data: walletRow } = await supabase
      .from('profiles')
      .select('wallet_balance')
      .eq('id', user.id)
      .single()
    if (walletRow?.wallet_balance != null) {
      set({ walletBalance: walletRow.wallet_balance })
    }

    set({ profileReady: true })
  },

  creditWallet: async (amountNaira) => {
    const { user, walletBalance } = get()
    if (!user) throw new Error('Not authenticated')
    const newBalance = walletBalance + amountNaira
    const { error } = await supabase
      .from('profiles')
      .update({ wallet_balance: newBalance })
      .eq('id', user.id)
    if (error) throw new Error(error.message)
    set({ walletBalance: newBalance })
  },

  debitWallet: async (amountNaira) => {
    const { user, walletBalance } = get()
    if (!user) throw new Error('Not authenticated')
    if (walletBalance < amountNaira) throw new Error('Insufficient wallet balance')
    const newBalance = walletBalance - amountNaira
    const { error } = await supabase
      .from('profiles')
      .update({ wallet_balance: newBalance })
      .eq('id', user.id)
    if (error) throw new Error(error.message)
    set({ walletBalance: newBalance })
  },
}))
