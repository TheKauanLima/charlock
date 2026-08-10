import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

import AuthShell, { AuthLink } from '@/components/auth/AuthShell'
import GuestOnlyAuth from '@/components/auth/GuestOnlyAuth'
import SignInForm from '@/components/auth/SignInForm'

import styles from '@/components/auth/auth-ui.module.css'

export default async function SignInPage() {
  const { userId } = await auth()

  if (userId) {
    redirect('/')
  }

  return (
    <GuestOnlyAuth>
      <AuthShell
        eyebrow="Account Access"
        title="Sign In"
        footer={(
          <p className={styles.footer}>
            <span>Need an account?</span>
            <AuthLink href="/sign-up">Create one</AuthLink>
            <span>or</span>
            <AuthLink href="/forgot-password">reset password</AuthLink>
          </p>
        )}
      >
        <SignInForm />
      </AuthShell>
    </GuestOnlyAuth>
  )
}
