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

  // On native: auto-close the in-app browser once Moneta confirms payment success,
  // then navigate to the callback page inside the authenticated WebView.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    let pollInterval: ReturnType<typeof setInterval> | null = null
    let pollAttempts = 0
    const MAX_ATTEMPTS = 60 // 5 minutes at 5s intervals

    function stopPolling() {
      if (pollInterval) { clearInterval(pollInterval); pollInterval = null }
      pollAttempts = 0
    }

    function navigateToCallback() {
      const ref    = localStorage.getItem('moneta_pending_ref')
      const amount = localStorage.getItem('moneta_pending_amount')
      if (!ref) return
      const extra = amount ? `&expected=${encodeURIComponent(amount)}` : ''
      window.location.href = `/payment/callback?reference=${encodeURIComponent(ref)}${extra}`
    }

    // When the browser is closed (by user or by us calling Browser.close()),
    // navigate to the callback page in the WebView where auth is alive.
    const finishedListener = Browser.addListener('browserFinished', () => {
      stopPolling()
      navigateToCallback()
    })

    // browserPageLoaded fires exactly once — when the initial Moneta payment
    // URL finishes loading. That's our signal to start polling for success
    // so we can close the browser automatically instead of waiting for the user.
    const pageLoadedListener = Browser.addListener('browserPageLoaded', () => {
      const ref = localStorage.getItem('moneta_pending_ref')
      if (!ref) return

      pollInterval = setInterval(async () => {
        pollAttempts++
        const currentRef = localStorage.getItem('moneta_pending_ref')
        if (!currentRef || pollAttempts > MAX_ATTEMPTS) { stopPolling(); return }

        try {
          const result = await verifyPayment(currentRef)
          if (result.success) {
            stopPolling()
            // Close the in-app browser — this fires browserFinished which
            // calls navigateToCallback() above.
            Browser.close()
          }
        } catch {
          // Network/API error — keep polling
        }
      }, 5000)
    })

    return () => {
      stopPolling()
      finishedListener.then((l) => l.remove())
      pageLoadedListener.then((l) => l.remove())
    }
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
