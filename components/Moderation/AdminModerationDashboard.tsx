'use client'

import { Ban, CheckCircle2, ShieldAlert, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

import type { ModerationAction, ModerationContentType, ModerationQueue, ModerationQueueItem } from '@/lib/moderation-types'

import styles from './AdminModerationDashboard.module.css'

interface AdminModerationDashboardProps {
  initialQueue: ModerationQueue
}

function ReasonBreakdown({ item }: { item: ModerationQueueItem }) {
  const entries = Object.entries(item.reasonCounts)

  return (
    <ul className={styles.reasons} aria-label="Report reason breakdown">
      {entries.map(([reason, count]) => <li key={reason}><span>{reason}</span><strong>{count}</strong></li>)}
    </ul>
  )
}

export default function AdminModerationDashboard({ initialQueue }: AdminModerationDashboardProps) {
  const [queue, setQueue] = useState(initialQueue)
  const [activeType, setActiveType] = useState<ModerationContentType>('hero')
  const [pendingKey, setPendingKey] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const items = activeType === 'hero' ? queue.heroes : queue.comments

  async function resolveItem(item: ModerationQueueItem, action: ModerationAction) {
    if (action === 'delete' && !window.confirm(`Permanently delete this ${item.type}?`)) {
      return
    }

    const key = `${item.type}:${item.id}`

    setPendingKey(key)
    setStatus(null)

    try {
      const response = await fetch('/api/admin/moderation/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: item.type, id: item.id, action }),
      })
      const body = await response.json() as { resolution?: { resolved: true }; error?: string }

      if (!response.ok || !body.resolution) {
        throw new Error(body.error || `Moderation action failed with ${response.status}`)
      }

      if (action !== 'suspend') {
        setQueue(current => ({
          heroes: item.type === 'hero' ? current.heroes.filter(entry => entry.id !== item.id) : current.heroes,
          comments: item.type === 'comment' ? current.comments.filter(entry => entry.id !== item.id) : current.comments,
        }))
      }
      setStatus(action === 'approve'
        ? 'Flags cleared and content approved.'
        : action === 'delete'
          ? 'Content permanently deleted.'
          : 'Content author suspended from community contributions.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Moderation action failed.')
    } finally {
      setPendingKey(null)
    }
  }

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div>
          <p><ShieldAlert aria-hidden="true" /> Restricted workspace</p>
          <h1>Moderation &amp; Safety</h1>
          <span>Review community reports and restore or remove flagged content.</span>
        </div>
        <Link href="/">Return to Charlock</Link>
      </header>

      <div className={styles.workspace}>
        <aside className={styles.sidebar} aria-label="Moderation queues">
          <button type="button" aria-pressed={activeType === 'hero'} onClick={() => setActiveType('hero')}>
            Flagged Characters <span>{queue.heroes.length}</span>
          </button>
          <button type="button" aria-pressed={activeType === 'comment'} onClick={() => setActiveType('comment')}>
            Flagged Comments <span>{queue.comments.length}</span>
          </button>
        </aside>

        <section className={styles.queue} aria-label={activeType === 'hero' ? 'Flagged characters' : 'Flagged comments'}>
          <div className={styles.queueHeader}>
            <h2>{activeType === 'hero' ? 'Flagged Characters' : 'Flagged Comments'}</h2>
            <span>{items.length} awaiting review</span>
          </div>

          {status ? <p className={styles.status} role="status">{status}</p> : null}

          {items.length ? (
            <div className={activeType === 'hero' ? styles.heroGrid : styles.commentList}>
              {items.map(item => {
                const isPending = pendingKey === `${item.type}:${item.id}`

                return (
                  <article key={item.id} className={styles.item}>
                    {item.thumbnail ? <div className={styles.thumbnail} role="img" aria-label={`${item.title} thumbnail`} style={{ backgroundImage: `url('${item.thumbnail}')` }} /> : null}
                    <div className={styles.itemBody}>
                      <div className={styles.itemHeading}>
                        <div>
                          <h3>{item.title}</h3>
                          <p>Author: {item.authorId}</p>
                        </div>
                        <span data-status={item.moderationStatus}>{item.moderationStatus}</span>
                      </div>
                      {item.content ? <blockquote>{item.content}</blockquote> : null}
                      <p className={styles.reportCount}>{item.reportCount} unique report{item.reportCount === 1 ? '' : 's'}</p>
                      <ReasonBreakdown item={item} />
                      <details>
                        <summary>Report details</summary>
                        <ul className={styles.reportDetails}>
                          {item.reports.map(report => (
                            <li key={`${report.reporterId}:${report.createdAt}`}>
                              <strong>{report.reason}</strong>
                              <span>{report.details || 'No additional explanation.'}</span>
                            </li>
                          ))}
                        </ul>
                      </details>
                      <footer>
                        <button type="button" disabled={isPending} onClick={() => void resolveItem(item, 'approve')}>
                          <CheckCircle2 aria-hidden="true" /> Approve / Clear flags
                        </button>
                        <button type="button" disabled={isPending} onClick={() => void resolveItem(item, 'delete')}>
                          <Trash2 aria-hidden="true" /> Delete Content
                        </button>
                        <button type="button" disabled={isPending} onClick={() => void resolveItem(item, 'suspend')}>
                          <Ban aria-hidden="true" /> Suspend User
                        </button>
                      </footer>
                    </div>
                  </article>
                )
              })}
            </div>
          ) : (
            <div className={styles.empty}>
              <CheckCircle2 aria-hidden="true" />
              <h3>Queue clear</h3>
              <p>No reported {activeType === 'hero' ? 'characters' : 'comments'} require review.</p>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
