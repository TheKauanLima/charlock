import AuthShell, { AuthLink } from '@/components/auth/AuthShell'
import ForgotPasswordForm from '@/components/auth/ForgotPasswordForm'

import styles from '@/components/auth/auth-ui.module.css'

export default function ForgotPasswordPage() {
  return (
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
  )
}
