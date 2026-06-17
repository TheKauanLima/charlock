import AuthShell, { AuthLink } from '@/components/auth/AuthShell'
import SignInForm from '@/components/auth/SignInForm'

import styles from '@/components/auth/auth-ui.module.css'

export default function SignInPage() {
  return (
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
  )
}
