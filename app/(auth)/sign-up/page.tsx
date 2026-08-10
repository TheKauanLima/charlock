import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

import AuthShell, { AuthLink } from '@/components/auth/AuthShell'
import GuestOnlyAuth from '@/components/auth/GuestOnlyAuth'
import SignUpForm from '@/components/auth/SignUpForm'

import styles from '@/components/auth/auth-ui.module.css'

export default async function SignUpPage() {
  const { userId } = await auth()

  if (userId) {
    redirect('/')
  }

  return (
    <GuestOnlyAuth>
      <AuthShell
        eyebrow="New Operator"
        title="Sign Up"
        footer={(
          <p className={styles.footer}>
            <span>Already registered?</span>
            <AuthLink href="/sign-in">Sign in</AuthLink>
          </p>
        )}
      >
        <SignUpForm />
      </AuthShell>
    </GuestOnlyAuth>
  )
}
