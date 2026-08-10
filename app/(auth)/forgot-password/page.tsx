import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

import AuthShell, { AuthLink } from '@/components/auth/AuthShell'
import ForgotPasswordForm from '@/components/auth/ForgotPasswordForm'
import GuestOnlyAuth from '@/components/auth/GuestOnlyAuth'

import styles from '@/components/auth/auth-ui.module.css'

export default async function ForgotPasswordPage() {
  const { userId } = await auth()

  if (userId) {
    redirect('/')
  }

  return (
    <GuestOnlyAuth>
      <AuthShell
        eyebrow="Account Recovery"
        title="Forgot Password"
        footer={(
          <p className={styles.footer}>
            <span>Remembered it?</span>
            <AuthLink href="/sign-in">Return to sign in</AuthLink>
          </p>
        )}
      >
        <ForgotPasswordForm />
      </AuthShell>
    </GuestOnlyAuth>
  )
}
