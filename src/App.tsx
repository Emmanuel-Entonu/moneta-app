import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { Browser } from '@capacitor/browser'
import { supabase } from './lib/supabase'
import { useAuthStore } from './store/authStore'
import { verifyPayment } from './lib/monetaApi'

import Login from './pages/Login'
import Register from './pages/Register'
import Market from './pages/Market'
import Portfolio from './pages/Portfolio'
import Trade from './pages/Trade'
import Profile from './pages/Profile'
import Compare from './pages/Compare'
import Onboarding from './pages/Onboarding'
import KYC from './pages/KYC'
import PaymentCallback from './pages/PaymentCallback'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading, profileReady, kycStatus } = useAuthStore()
  const location = useLocation()

  if (loading || (user && !profileReady)) {
    return (
      <div style={{
        minHeight: '100svh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg)',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 40,
            height: 40,
            border: '3px solid var(--border)',
            borderTopColor: 'var(--primary)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 16px',
          }} />
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading…</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  // New user: KYC first (skip if already on /kyc or user explicitly skipped)
  if ((!kycStatus || kycStatus === 'pending')
    && location.pathname !== '/kyc'
    && !localStorage.getItem(`moneta_kyc_skipped_${user.id}`)) {
    return <Navigate to="/kyc" replace />
  }

  // After KYC: onboarding (skip check if on /kyc so KYC can navigate itself)
  if (!localStorage.getItem(`moneta_onboarded_${user.id}`) && location.pathname !== '/kyc') {
    return <Navigate to="/onboarding" replace />
  }

  return <>{children}</>
}

export default function App() {
  const setSession = useAuthStore((s) => s.setSession)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Refresh balance from Supabase whenever the app comes to foreground
  useEffect(() => {
    async function onVisible() {
      if (document.visibilityState !== 'visible') return
      const state = useAuthStore.getState()
      if (state.user) await state.loadProfile()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  // On Android: when the in-app payment browser closes, immediately verify
  // the pending reference in the WebView (which has the auth session).
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    const listener = Browser.addListener('browserFinished', async () => {
      const ref = localStorage.getItem('moneta_pending_ref')
      if (!ref) return
      localStorage.removeItem('moneta_pending_ref')
      try {
        const state = useAuthStore.getState()
        if (!state.user) return
        const result = await verifyPayment(ref)
        if (result.success && result.amountNaira > 0) {
          await state.creditWallet(result.amountNaira)
          await state.loadProfile()
          localStorage.setItem('moneta_last_credit', String(result.amountNaira))
        }
      } catch { /* silent — user can use Recover Payment button */ }
    })
    return () => { listener.then((l) => l.remove()) }
  }, [])

  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/kyc" element={<RequireAuth><KYC /></RequireAuth>} />
        <Route path="/payment/callback" element={<PaymentCallback />} />

        {/* Protected */}
        <Route path="/market" element={<RequireAuth><Market /></RequireAuth>} />
        <Route path="/portfolio" element={<RequireAuth><Portfolio /></RequireAuth>} />
        <Route path="/trade/:symbol" element={<RequireAuth><Trade /></RequireAuth>} />
        <Route path="/compare" element={<RequireAuth><Compare /></RequireAuth>} />
        <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />

        {/* Default */}
        <Route path="*" element={<Navigate to="/market" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
