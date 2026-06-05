import AuthShell, { AuthLink } from '@/components/auth/AuthShell'
import SignUpForm from '@/components/auth/SignUpForm'

import styles from '@/components/auth/auth-ui.module.css'

export default function SignUpPage() {
  return (
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
  )
}
