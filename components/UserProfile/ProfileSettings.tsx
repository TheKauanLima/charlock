import Image from 'next/image'
import Link from 'next/link'
import { Bell, Bookmark, Heart, MessageSquare, Settings, UsersRound } from 'lucide-react'
import type { CSSProperties } from 'react'

import { deleteAccount, updateProfileSettings } from '@/app/profile/actions'
import type { HeroDefinition } from '@/lib/hero-data'
import type { ProfileUser } from '@/lib/profile'

import ClerkSecurityButton from './ClerkSecurityButton'
import styles from './ProfileSettings.module.css'

interface ProfileSettingsProps {
  user: ProfileUser
  avatarUrl: string | null
  preferredHero: HeroDefinition
  heroes: HeroDefinition[]
  deleteError?: boolean
}

export default function ProfileSettings({ user, avatarUrl, preferredHero, heroes, deleteError = false }: ProfileSettingsProps) {
  return (
    <main
      className={styles.shell}
      style={{
        '--settings-accent': preferredHero.heroInfo.tagColor,
        '--settings-name': preferredHero.heroInfo.nameColor,
      } as CSSProperties}
    >
      <Image src={preferredHero.render} alt="" fill priority sizes="100vw" className={styles.backgroundRender} />
      <div className={styles.noiseLayer} aria-hidden="true" />

      <div className={styles.content}>
        <aside className={styles.sidePanel} aria-label="Profile sections">
          <div className={styles.railIdentity}>
            <div className={styles.railTopline}>
              <Link href="/" className={styles.backButton} aria-label="Back to site">
                <span aria-hidden="true">&lt;</span>
              </Link>
              <div>
                <span>Profile</span>
                <strong>{user.username}</strong>
              </div>
            </div>
            <div className={styles.avatar}>
              {avatarUrl ? (
                <Image src={avatarUrl} alt="" fill unoptimized sizes="132px" className={styles.avatarImage} />
              ) : (
                <span>{user.username.slice(0, 2).toUpperCase()}</span>
              )}
            </div>
            <div className={styles.sideProfileCopy}>
              <p className={styles.eyebrow}>Profile</p>
              <h1>{user.username}</h1>
            </div>
          </div>
          <div className={styles.sidePanelList}>
            <Link href="/profile#characters-created" className={styles.sidePanelItem}>
              <UsersRound aria-hidden="true" size={17} />
              Saved Characters
            </Link>
            <Link href="/profile#bookmarks" className={styles.sidePanelItem}>
              <Bookmark aria-hidden="true" size={17} />
              Bookmarks
            </Link>
            <Link href="/profile#likes" className={styles.sidePanelItem}>
              <Heart aria-hidden="true" size={17} />
              Likes
            </Link>
            <Link href="/profile#comments" className={styles.sidePanelItem}>
              <MessageSquare aria-hidden="true" size={17} />
              Comments
            </Link>
            <Link href="/profile#notifications" className={styles.sidePanelItem}>
              <Bell aria-hidden="true" size={17} />
              Notifications
            </Link>
            <Link href="/profile/settings" className={`${styles.sidePanelItem} ${styles.sidePanelItemActive}`} aria-current="page">
              <Settings aria-hidden="true" size={17} />
              Settings
            </Link>
          </div>
        </aside>

        <section className={styles.panel} aria-label="Profile settings">
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Profile</p>
            <h1>Settings</h1>
            <p className={styles.identifier}>{user.email}</p>
          </div>
        </header>

        <form className={styles.form} action={updateProfileSettings}>
          <section className={styles.section}>
            <h2>Profile Controls</h2>
            <label className={styles.field}>
              <span>Main Hero</span>
              <select name="preferredHero" defaultValue={user.preferredHero}>
                {heroes.map(hero => (
                  <option key={hero.slug} value={hero.slug}>
                    {hero.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.textareaField}>
              <span>Bio</span>
              <textarea name="customBio" defaultValue={user.customBio} rows={7} />
            </label>
          </section>

          <section className={styles.section}>
            <h2>Privacy</h2>
            <label className={styles.toggle}>
              <input type="checkbox" name="isPublic" defaultChecked={user.isPublic} />
              <span aria-hidden="true" />
              <strong>Public Profile</strong>
            </label>
            <label className={styles.toggle}>
              <input type="checkbox" name="anonymousEdits" defaultChecked={user.anonymousEdits} />
              <span aria-hidden="true" />
              <strong>Anonymous Edits</strong>
            </label>
          </section>

          <button className={styles.saveButton} type="submit">
            Save Profile
          </button>
        </form>

        <section className={`${styles.section} ${styles.securitySection}`}>
          <h2>Security</h2>
          <div className={styles.actionRow}>
            <Link className={styles.secondaryAction} href="/forgot-password">
              Reset Password
            </Link>
            <ClerkSecurityButton className={styles.secondaryAction} />
          </div>
        </section>

        <section className={styles.dangerZone}>
          <h2>Delete Account</h2>
          <p>Type <strong>{user.username}</strong> to confirm permanent account deletion.</p>
          {deleteError ? <p className={styles.error} role="alert">Confirmation string did not match.</p> : null}
          <form className={styles.deleteForm} action={deleteAccount}>
            <input name="confirmation" required autoComplete="off" aria-label="Delete account confirmation" />
            <button type="submit">Delete Account</button>
          </form>
        </section>
      </section>
      </div>
    </main>
  )
}
