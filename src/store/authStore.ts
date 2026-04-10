import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { User, Session } from '@supabase/supabase-js'

interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
  pacAccountId: string | null
  kycStatus: 'pending' | 'submitted' | 'verified' | 'rejected'
  setSession: (session: Session | null) => void
  signIn: (email: string, password: string) => Promise<string | null>
  signUp: (email: string, password: string, fullName: string) => Promise<string | null>
  signOut: () => Promise<void>
  loadProfile: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  loading: true,
  pacAccountId: null,
  kycStatus: 'pending',

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
    // Profile is auto-created by the on_auth_user_created trigger in Supabase
    return null
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null, session: null, pacAccountId: null, kycStatus: 'pending' })
  },

  loadProfile: async () => {
    const { user } = get()
    if (!user) return
    const { data } = await supabase
      .from('profiles')
      .select('pac_account_id, kyc_status')
      .eq('id', user.id)
      .single()
    if (data) {
      set({
        pacAccountId: data.pac_account_id,
        kycStatus: data.kyc_status as AuthState['kycStatus'],
      })
    }
  },
}))
