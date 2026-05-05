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

  creditWallet: (amountNaira: number) => Promise<void>
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

    const { data: profile, error: fetchError } = await supabase
      .from('profiles')
      .select('pac_account_id, kyc_status, wallet_balance')
      .eq('id', user.id)
      .single()

    if (profile) {
      // '0f4ce611-...' was a hardcoded fallback that was accidentally saved — clear it
      const BAD_UUID = '0f4ce611-3a2c-4ba0-8c7d-2e2f0587741e'
      let pacAccountId = profile.pac_account_id ?? null
      if (pacAccountId === BAD_UUID) {
        pacAccountId = null
        await supabase.from('profiles').update({ pac_account_id: null }).eq('id', user.id)
      }
      set({
        pacAccountId,
        kycStatus: (profile.kyc_status as AuthState['kycStatus']) ?? 'pending',
        walletBalance: profile.wallet_balance ?? 0,
      })
    } else if (!fetchError || fetchError.code === 'PGRST116') {
      await supabase.from('profiles').upsert({
        id: user.id,
        kyc_status: 'pending',
        wallet_balance: 0,
      })
    }

    set({ profileReady: true })
  },

  creditWallet: async (amountNaira) => {
    const { user } = get()
    if (!user) throw new Error('Not authenticated')
    const { data, error } = await supabase.rpc('increment_wallet', {
      user_id: user.id,
      delta: amountNaira,
    })
    if (error) throw new Error(error.message)
    set({ walletBalance: data as number })
  },

  debitWallet: async (amountNaira) => {
    const { user } = get()
    if (!user) throw new Error('Not authenticated')
    const { data, error } = await supabase.rpc('decrement_wallet', {
      user_id: user.id,
      delta: amountNaira,
    })
    if (error) throw new Error(error.message)
    if (data === null) throw new Error('Insufficient wallet balance')
    set({ walletBalance: data as number })
  },
}))
