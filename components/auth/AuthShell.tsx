import Link from 'next/link'
import type { ReactNode } from 'react'

import styles from './auth-ui.module.css'

interface AuthShellProps {
  eyebrow: string
  title: string
  children: ReactNode
  footer?: ReactNode
}

export default function AuthShell({ eyebrow, title, children, footer }: AuthShellProps) {
  return (
    <main className={styles.shell}>
      <section className={styles.panel} aria-labelledby="auth-title">
        <header className={styles.header}>
          <p className={styles.eyebrow}>{eyebrow}</p>
          <h1 id="auth-title" className={styles.title}>{title}</h1>
        </header>
        {children}
        {footer ? <div className={styles.form}>{footer}</div> : null}
      </section>
    </main>
  )
}

export function AuthLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link className={styles.link} href={href}>
      {children}
    </Link>
  )
}
