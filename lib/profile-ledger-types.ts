export interface ProfileLikeItem {
  id: string
  heroId: string
  heroName: string
  creatorId: string
  creatorName: string
  likedAt: string
  href: string
}

export interface ProfileCommentItem {
  id: string
  heroId: string
  heroName: string
  authorId: string
  authorName: string
  content: string
  createdAt: string
  href: string
  viewerCanDelete: boolean
}

export interface ProfileCommentsLedger {
  made: ProfileCommentItem[]
  received: ProfileCommentItem[]
}
