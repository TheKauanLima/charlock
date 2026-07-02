'use client'

import { AlertTriangle, LoaderCircle, RefreshCw, WifiOff, X } from 'lucide-react'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'

import styles from './SystemFeedback.module.css'

export function LoadingOverlay({ visible, status = '[SYS] Syncing with neural database...' }: { visible: boolean; status?: string }) {
  if (!visible) return null

  return (
    <div className={styles.loadingOverlay} role="status" aria-live="polite" aria-label="Saving character">
      <LoaderCircle aria-hidden="true" />
      <strong>Saving Character</strong>
      <span>{status}</span>
    </div>
  )
}

export function SaveFailureBanner({ reason, onRetry }: { reason: string; onRetry: () => void }) {
  return (
    <div className={styles.failureBanner} role="alert">
      <AlertTriangle aria-hidden="true" />
      <p>Save rejected by server node. Reason: {reason}</p>
      <button type="button" onClick={onRetry}><RefreshCw aria-hidden="true" />Retry Save</button>
    </div>
  )
}

export function SessionExpiredModal({ open, onDismiss }: { open: boolean; onDismiss: () => void }) {
  if (!open) return null

  function signIn() {
    const returnUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`
    window.location.assign(`/sign-in?redirect_url=${encodeURIComponent(returnUrl)}`)
  }

  return (
    <div className={styles.sessionBackdrop} role="presentation">
      <section className={styles.sessionModal} role="dialog" aria-modal="true" aria-labelledby="session-expired-title">
        <button type="button" className={styles.dismissButton} aria-label="Close session expiry dialog" onClick={onDismiss}><X aria-hidden="true" /></button>
        <p>Security Link</p>
        <h2 id="session-expired-title">SESSION CONNECTION TERMINATED</h2>
        <span>Your security session has expired. To prevent character data corruption, please log back in. Your current draft is stored on this device.</span>
        <button type="button" className={styles.signInButton} onClick={signIn}>Sign In</button>
      </section>
    </div>
  )
}

export function ConnectionStatus() {
  const offline = useSyncExternalStore(
    onChange => {
      window.addEventListener('offline', onChange)
      window.addEventListener('online', onChange)
      return () => {
        window.removeEventListener('offline', onChange)
        window.removeEventListener('online', onChange)
      }
    },
    () => navigator.onLine === false,
    () => false,
  )

  return offline ? (
    <div className={styles.connectionWarning} role="alert"><WifiOff aria-hidden="true" />Connection offline. Draft changes remain stored locally.</div>
  ) : null
}

export function SystemToast({ message, durationMs = 3200 }: { message: string; durationMs?: number }) {
  return <TimedSystemToast key={message} message={message} durationMs={durationMs} />
}

function TimedSystemToast({ message, durationMs }: { message: string; durationMs: number }) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setVisible(false), durationMs)

    return () => window.clearTimeout(timeoutId)
  }, [durationMs])

  if (!visible || typeof document === 'undefined') {
    return null
  }

  return createPortal(<p className={styles.toast} role="status">{message}</p>, document.body)
}

export function ProfileLoadingSkeleton() {
  return (
    <main className={styles.profileLoading} aria-label="Loading profile">
      <aside><span /><span /><span /><span /></aside>
      <section><span className={styles.profileHeroSkeleton} /><span /><span /><div>{Array.from({ length: 8 }, (_, index) => <i key={index} />)}</div></section>
    </main>
  )
}

export function RouteError({ title, message, errorId, onRetry }: { title: string; message: string; errorId?: string; onRetry: () => void }) {
  return (
    <main className={styles.routeError}>
      <AlertTriangle aria-hidden="true" />
      <p>System Fault</p>
      <h1>{title}</h1>
      <span>{message}</span>
      {errorId ? <code>Reference: {errorId}</code> : null}
      <button type="button" onClick={onRetry}><RefreshCw aria-hidden="true" />Retry Connection</button>
    </main>
  )
}
