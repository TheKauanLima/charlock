'use client'

import { useState } from 'react'
import type { FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useClerk, useSignIn } from '@clerk/nextjs'

import { getAuthErrorMessage } from './auth-errors'
import styles from './auth-ui.module.css'

export default function SignInForm() {
  const router = useRouter()
  const { client } = useClerk()
  const { signIn } = useSignIn()
  const googleSignIn = client?.signIn
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!signIn || isSubmitting) {
      return
    }

    setError(null)
    setIsSubmitting(true)

    try {
      const createResult = await signIn.create({ identifier })
      if (createResult.error) {
        throw createResult.error
      }

      const passwordResult = await signIn.password({ password })
      if (passwordResult.error) {
        throw passwordResult.error
      }

      const finalizeResult = await signIn.finalize()
      if (finalizeResult.error) {
        throw finalizeResult.error
      }

      router.push('/')
      router.refresh()
    } catch (caughtError) {
      setError(getAuthErrorMessage(caughtError))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleGoogleSignIn() {
    if (!googleSignIn || isGoogleSubmitting) {
      return
    }

    setError(null)
    setIsGoogleSubmitting(true)

    try {
      await googleSignIn.authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: '/sso-callback',
        redirectUrlComplete: '/',
      })
    } catch (caughtError) {
      setError(getAuthErrorMessage(caughtError))
      setIsGoogleSubmitting(false)
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      <button className={styles.oauthButton} type="button" disabled={!googleSignIn || isGoogleSubmitting || isSubmitting} onClick={handleGoogleSignIn}>
        {isGoogleSubmitting ? 'Opening Google' : 'Continue with Google'}
      </button>
      <span className={styles.divider}>or</span>
      <label className={styles.field}>
        <span className={styles.label}>Email or Username</span>
        <input className={styles.input} value={identifier} onChange={event => setIdentifier(event.target.value)} required autoComplete="username" />
      </label>
      <label className={styles.field}>
        <span className={styles.label}>Password</span>
        <input className={styles.input} value={password} onChange={event => setPassword(event.target.value)} required type="password" autoComplete="current-password" />
      </label>
      <button className={styles.button} type="submit" disabled={!signIn || isSubmitting}>
        {isSubmitting ? 'Signing In' : 'Sign In'}
      </button>
    </form>
  )
}
