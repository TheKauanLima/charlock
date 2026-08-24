'use client'

import { useState } from 'react'
import type { FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useClerk, useSignUp } from '@clerk/nextjs'

import { getAuthErrorMessage, sendThemedAuthEmail } from './auth-errors'
import styles from './auth-ui.module.css'

export default function SignUpForm() {
  const router = useRouter()
  const { client } = useClerk()
  const { signUp } = useSignUp()
  const googleSignUp = client?.signUp
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false)

  async function handleCreateAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!signUp || isSubmitting) {
      return
    }

    setError(null)
    setNotice(null)
    setIsSubmitting(true)

    try {
      const createResult = await signUp.create({
        emailAddress: email,
        unsafeMetadata: {
          username,
        },
      })
      if (createResult.error) {
        throw createResult.error
      }

      const passwordResult = await signUp.password({ password })
      if (passwordResult.error) {
        throw passwordResult.error
      }

      const sendCodeResult = await signUp.verifications.sendEmailCode()
      if (sendCodeResult.error) {
        throw sendCodeResult.error
      }

      await sendThemedAuthEmail(email, 'verify_email')
      setIsVerifying(true)
      setNotice('Enter the 6-digit verification code sent to your email.')
    } catch (caughtError) {
      setError(getAuthErrorMessage(caughtError))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleGoogleSignUp() {
    if (!googleSignUp || isGoogleSubmitting) {
      return
    }

    setError(null)
    setNotice(null)
    setIsGoogleSubmitting(true)

    try {
      await googleSignUp.authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: '/sso-callback',
        redirectUrlComplete: '/',
      })
    } catch (caughtError) {
      setError(getAuthErrorMessage(caughtError))
      setIsGoogleSubmitting(false)
    }
  }

  async function handleVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!signUp || isSubmitting) {
      return
    }

    setError(null)
    setIsSubmitting(true)

    try {
      const verifyResult = await signUp.verifications.verifyEmailCode({ code })
      if (verifyResult.error) {
        throw verifyResult.error
      }

      const finalizeResult = await signUp.finalize()
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

  if (isVerifying) {
    return (
      <form className={styles.form} onSubmit={handleVerify}>
        {error ? <p className={styles.error} role="alert">{error}</p> : null}
        {notice ? <p className={styles.success}>{notice}</p> : null}
        <label className={styles.field}>
          <span className={styles.label}>Verification Code</span>
          <input className={styles.input} value={code} onChange={event => setCode(event.target.value)} required inputMode="numeric" pattern="[0-9]{6}" autoComplete="one-time-code" />
        </label>
        <button className={styles.button} type="submit" disabled={!signUp || isSubmitting}>
          {isSubmitting ? 'Verifying' : 'Verify Email'}
        </button>
      </form>
    )
  }

  return (
    <form className={styles.form} onSubmit={handleCreateAccount}>
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      <button className={styles.oauthButton} type="button" disabled={!googleSignUp || isGoogleSubmitting || isSubmitting} onClick={handleGoogleSignUp}>
        {isGoogleSubmitting ? 'Opening Google' : 'Continue with Google'}
      </button>
      <p className={styles.message}>Google sign-up creates a username automatically. You can change it later in Profile Settings.</p>
      <span className={styles.divider}>or</span>
      <label className={styles.field}>
        <span className={styles.label}>Email</span>
        <input className={styles.input} value={email} onChange={event => setEmail(event.target.value)} required type="email" autoComplete="email" />
      </label>
      <label className={styles.field}>
        <span className={styles.label}>Username</span>
        <input className={styles.input} value={username} onChange={event => setUsername(event.target.value)} required autoComplete="username" />
      </label>
      <label className={styles.field}>
        <span className={styles.label}>Password</span>
        <input className={styles.input} value={password} onChange={event => setPassword(event.target.value)} required type="password" autoComplete="new-password" />
      </label>
      <div id="clerk-captcha" className={styles.captcha} data-testid="clerk-captcha" />
      <button className={styles.button} type="submit" disabled={!signUp || isSubmitting}>
        {isSubmitting ? 'Creating' : 'Create Account'}
      </button>
    </form>
  )
}
