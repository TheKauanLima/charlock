'use client'

import { useState } from 'react'
import type { FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useSignIn } from '@clerk/nextjs'

import { getAuthErrorMessage, sendThemedAuthEmail } from './auth-errors'
import styles from './auth-ui.module.css'

export default function ForgotPasswordForm() {
  const router = useRouter()
  const { signIn } = useSignIn()
  const [identifier, setIdentifier] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [isResetting, setIsResetting] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function handleRequestReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!signIn || isSubmitting) {
      return
    }

    setError(null)
    setNotice(null)
    setIsSubmitting(true)

    try {
      const createResult = await signIn.create({ identifier })
      if (createResult.error) {
        throw createResult.error
      }

      const codeResult = await signIn.resetPasswordEmailCode.sendCode()
      if (codeResult.error) {
        throw codeResult.error
      }

      if (identifier.includes('@')) {
        await sendThemedAuthEmail(identifier, 'reset_password')
      }
      setIsResetting(true)
      setNotice('Enter the 6-digit reset code and choose a new password.')
    } catch (caughtError) {
      setError(getAuthErrorMessage(caughtError))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleResetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!signIn || isSubmitting) {
      return
    }

    setError(null)
    setIsSubmitting(true)

    try {
      const verifyResult = await signIn.resetPasswordEmailCode.verifyCode({ code })
      if (verifyResult.error) {
        throw verifyResult.error
      }

      const passwordResult = await signIn.resetPasswordEmailCode.submitPassword({ password })
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

  if (isResetting) {
    return (
      <form className={styles.form} onSubmit={handleResetPassword}>
        {error ? <p className={styles.error} role="alert">{error}</p> : null}
        {notice ? <p className={styles.success}>{notice}</p> : null}
        <label className={styles.field}>
          <span className={styles.label}>Reset Code</span>
          <input className={styles.input} value={code} onChange={event => setCode(event.target.value)} required inputMode="numeric" pattern="[0-9]{6}" autoComplete="one-time-code" />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>New Password</span>
          <input className={styles.input} value={password} onChange={event => setPassword(event.target.value)} required type="password" autoComplete="new-password" />
        </label>
        <button className={styles.button} type="submit" disabled={!signIn || isSubmitting}>
          {isSubmitting ? 'Resetting' : 'Reset Password'}
        </button>
      </form>
    )
  }

  return (
    <form className={styles.form} onSubmit={handleRequestReset}>
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      <p className={styles.message}>Enter the email or username for your account. Clerk will send the reset code to the account email.</p>
      <label className={styles.field}>
        <span className={styles.label}>Email or Username</span>
        <input className={styles.input} value={identifier} onChange={event => setIdentifier(event.target.value)} required autoComplete="username" />
      </label>
      <button className={styles.button} type="submit" disabled={!signIn || isSubmitting}>
        {isSubmitting ? 'Sending' : 'Send Reset Code'}
      </button>
    </form>
  )
}
