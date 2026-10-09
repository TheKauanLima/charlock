'use client'

import { useUser } from '@clerk/nextjs'
import { Menu, X } from 'lucide-react'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'

import { LANDING_NAV_LINKS, LANDING_WORDMARK } from './landing-content'
import LandingNavLink from './LandingNavLink'

import styles from './LandingNavbar.module.css'

const PANEL_ID = 'landing-nav-panel'

export default function LandingNavbar() {
  const { isLoaded, isSignedIn } = useUser()
  const [isOpen, setIsOpen] = useState(false)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const showAuthActions = !(isLoaded && isSignedIn)

  const closeMenu = useCallback(() => setIsOpen(false), [])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
        toggleRef.current?.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  return (
    <header className={styles.header}>
      <nav aria-label="Main" className={styles.nav}>
        <Link className={styles.wordmark} href="/" onClick={closeMenu}>
          {LANDING_WORDMARK}
        </Link>

        <button
          ref={toggleRef}
          type="button"
          className={styles.toggle}
          aria-label={isOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={isOpen}
          aria-controls={PANEL_ID}
          onClick={() => setIsOpen((open) => !open)}
        >
          {isOpen ? <X aria-hidden="true" size={22} /> : <Menu aria-hidden="true" size={22} />}
        </button>

        <div id={PANEL_ID} className={`${styles.panel} ${isOpen ? styles.panelOpen : ''}`}>
          <ul className={styles.links}>
            {LANDING_NAV_LINKS.map((link) => (
              <li key={link.label}>
                <LandingNavLink
                  className={styles.link}
                  label={link.label}
                  signedInHref={link.signedInHref}
                  onNavigate={closeMenu}
                />
              </li>
            ))}
          </ul>

          <div className={styles.actions}>
            {showAuthActions ? (
              <>
                <Link className={styles.signIn} href="/sign-in" onClick={closeMenu}>
                  Sign in
                </Link>
                <Link className={styles.signUp} href="/sign-up" onClick={closeMenu}>
                  Sign up
                </Link>
              </>
            ) : null}
          </div>
        </div>
      </nav>
    </header>
  )
}
