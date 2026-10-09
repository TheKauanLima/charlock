import type { PublicComment } from '@/lib/public-page-types'

import PublicHeroCommentForm from './PublicHeroCommentForm'
import { formatCommentDate } from './public-hero-utils'
import styles from './PublicHero.module.css'

interface PublicHeroCommentsProps {
  heroId: string
  comments: PublicComment[]
  isSignedIn: boolean
}

/** Rendered only for public heroes; owner previews of private or hidden heroes have no comments. */
export default function PublicHeroComments({ heroId, comments, isSignedIn }: PublicHeroCommentsProps) {
  return (
    <section id="comments" className={styles.panel} aria-labelledby="public-hero-comments-heading">
      <h2 id="public-hero-comments-heading" className={styles.sectionHeading}>
        Comments <span className={styles.commentCount}>({comments.length})</span>
      </h2>

      {comments.length ? (
        <ol className={styles.commentList}>
          {comments.map(comment => (
            <li key={comment.id} id={`comment-${comment.id}`} className={styles.comment}>
              <p className={styles.commentMeta}>
                <span className={styles.commentAuthor}>{comment.authorName}</span>
                <time dateTime={comment.createdAt}>{formatCommentDate(comment.createdAt)}</time>
              </p>
              <p className={styles.commentContent}>{comment.content}</p>
            </li>
          ))}
        </ol>
      ) : (
        <p className={styles.emptyComments}>No comments yet.</p>
      )}

      <PublicHeroCommentForm heroId={heroId} isSignedIn={isSignedIn} />
    </section>
  )
}
