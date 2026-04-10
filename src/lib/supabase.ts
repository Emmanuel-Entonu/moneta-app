import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string | null
          phone: string | null
          date_of_birth: string | null
          address: string | null
          bvn: string | null
          kyc_status: 'pending' | 'submitted' | 'verified' | 'rejected'
          pac_account_id: string | null
          created_at: string
        }
      }
    }
  }
}
