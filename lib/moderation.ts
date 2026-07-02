import 'server-only'

import { auth } from '@clerk/nextjs/server'
import { Types } from 'mongoose'

import { requireAdmin } from '@/lib/admin-guard'
import { ApiRequestError } from '@/lib/api-errors'
import dbConnect from '@/lib/dbConnect'
import type { ContentReportRequest, ModerationResolveRequest } from '@/lib/moderation-schemas'
import type { ContentReport, ModerationQueue, ModerationQueueItem, ReportReason } from '@/lib/moderation-types'
import AbilityStats from '@/lib/models/AbilityStats'
import Comment from '@/lib/models/Comment'
import type { IComment } from '@/lib/models/Comment'
import CustomHero from '@/lib/models/CustomHero'
import type { ICustomHero } from '@/lib/models/CustomHero'
import HeroInfo from '@/lib/models/HeroInfo'
import Like from '@/lib/models/Like'
import Notification from '@/lib/models/Notification'
import SpiritStats from '@/lib/models/SpiritStats'
import User from '@/lib/models/User'
import VitalityStats from '@/lib/models/VitalityStats'
import WeaponStats from '@/lib/models/WeaponStats'
import { enforceRateLimit } from '@/lib/rate-limit'
import { assertUserNotSuspended } from '@/lib/user-suspension'

const AUTO_HIDE_REPORT_COUNT = 5

interface HeroModerationRecord extends ICustomHero {
  _id: Types.ObjectId
}

interface CommentModerationRecord extends IComment {
  _id: Types.ObjectId
}

function getObjectId(id: string, label: string) {
  if (!Types.ObjectId.isValid(id)) {
    throw new ApiRequestError(`${label} not found`, 404)
  }

  return new Types.ObjectId(id)
}

async function getReporterId() {
  const { userId } = await auth()

  if (!userId) {
    throw new ApiRequestError('Authentication required', 401)
  }

  enforceRateLimit({
    key: `content-report:user:${userId}`,
    limit: 20,
    windowMs: 60 * 1000,
  })

  return userId
}

function getModerationStatus(reportCount: number) {
  return reportCount >= AUTO_HIDE_REPORT_COUNT ? 'hidden' as const : 'flagged' as const
}

function normalizeReport(input: ContentReportRequest, reporterId: string): ContentReport {
  return {
    reporterId,
    reason: input.reason,
    ...(input.details ? { details: input.details } : {}),
    createdAt: new Date(),
  }
}

async function finishHeroReport(hero: HeroModerationRecord) {
  const reportCount = (hero.reports ?? []).length
  const moderationStatus = getModerationStatus(reportCount)
  const statusFilter = moderationStatus === 'hidden'
    ? { _id: hero._id }
    : { _id: hero._id, 'reports.4': { $exists: false } }

  await CustomHero.updateOne(statusFilter, { $set: { moderationStatus } })

  return { id: hero._id.toString(), reportCount, moderationStatus }
}

async function finishCommentReport(comment: CommentModerationRecord) {
  const reportCount = (comment.reports ?? []).length
  const moderationStatus = getModerationStatus(reportCount)
  const statusFilter = moderationStatus === 'hidden'
    ? { _id: comment._id }
    : { _id: comment._id, 'reports.4': { $exists: false } }

  await Comment.updateOne(statusFilter, { $set: { moderationStatus } })

  return { id: comment._id.toString(), reportCount, moderationStatus }
}

export async function reportHero(heroId: string, input: ContentReportRequest) {
  const reporterId = await getReporterId()

  await dbConnect()
  await assertUserNotSuspended(reporterId)

  const objectId = getObjectId(heroId, 'Hero')
  const hero = await CustomHero.findOneAndUpdate(
    {
      _id: objectId,
      status: 'published',
      'reports.reporterId': { $ne: reporterId },
    },
    { $push: { reports: normalizeReport(input, reporterId) } },
    { returnDocument: 'after', runValidators: true },
  ).lean<HeroModerationRecord | null>()

  if (hero) {
    return finishHeroReport(hero)
  }

  const existing = await CustomHero.exists({ _id: objectId, status: 'published' })

  if (!existing) {
    throw new ApiRequestError('Hero not found', 404)
  }

  throw new ApiRequestError('You have already reported this character', 409)
}

export async function reportComment(commentId: string, input: ContentReportRequest) {
  const reporterId = await getReporterId()

  await dbConnect()
  await assertUserNotSuspended(reporterId)

  const objectId = getObjectId(commentId, 'Comment')
  const comment = await Comment.findOneAndUpdate(
    {
      _id: objectId,
      'reports.reporterId': { $ne: reporterId },
    },
    { $push: { reports: normalizeReport(input, reporterId) } },
    { returnDocument: 'after', runValidators: true },
  ).lean<CommentModerationRecord | null>()

  if (comment) {
    return finishCommentReport(comment)
  }

  if (!await Comment.exists({ _id: objectId })) {
    throw new ApiRequestError('Comment not found', 404)
  }

  throw new ApiRequestError('You have already reported this comment', 409)
}

function getReasonCounts(reports: ContentReport[]) {
  return reports.reduce<Partial<Record<ReportReason, number>>>((counts, report) => ({
    ...counts,
    [report.reason]: (counts[report.reason] ?? 0) + 1,
  }), {})
}

function serializeReports(reports: ContentReport[]) {
  return reports.map(report => ({
    reporterId: report.reporterId,
    reason: report.reason,
    ...(report.details ? { details: report.details } : {}),
    createdAt: report.createdAt.toISOString(),
  }))
}

function serializeHeroQueueItem(hero: HeroModerationRecord): ModerationQueueItem {
  const reports = hero.reports ?? []

  return {
    id: hero._id.toString(),
    type: 'hero',
    title: hero.name,
    thumbnail: hero.portrait,
    authorId: hero.createdByUserId,
    moderationStatus: hero.moderationStatus ?? 'clean',
    reportCount: reports.length,
    reasonCounts: getReasonCounts(reports),
    reports: serializeReports(reports),
  }
}

function serializeCommentQueueItem(comment: CommentModerationRecord): ModerationQueueItem {
  const reports = comment.reports ?? []

  return {
    id: comment._id.toString(),
    type: 'comment',
    title: `Comment on ${comment.heroId.toString()}`,
    content: comment.content,
    authorId: comment.userId,
    moderationStatus: comment.moderationStatus ?? 'clean',
    reportCount: reports.length,
    reasonCounts: getReasonCounts(reports),
    reports: serializeReports(reports),
  }
}

export async function listModerationQueue(): Promise<ModerationQueue> {
  await requireAdmin()
  await dbConnect()

  const flaggedQuery = {
    $or: [
      { 'reports.0': { $exists: true as const } },
      { moderationStatus: 'hidden' as const },
    ],
  }
  const [heroes, comments] = await Promise.all([
    CustomHero.find(flaggedQuery).sort({ updatedAt: -1 }).lean<HeroModerationRecord[]>(),
    Comment.find(flaggedQuery).sort({ updatedAt: -1 }).lean<CommentModerationRecord[]>(),
  ])

  return {
    heroes: heroes.map(serializeHeroQueueItem),
    comments: comments.map(serializeCommentQueueItem),
  }
}

async function deleteHero(heroId: Types.ObjectId) {
  await Promise.all([
    CustomHero.deleteOne({ _id: heroId }),
    HeroInfo.deleteMany({ heroId }),
    WeaponStats.deleteMany({ heroId }),
    VitalityStats.deleteMany({ heroId }),
    SpiritStats.deleteMany({ heroId }),
    AbilityStats.deleteMany({ heroId }),
    Comment.deleteMany({ heroId }),
    Like.deleteMany({ heroId }),
    Notification.deleteMany({ $or: [{ targetId: heroId }, { relatedHeroId: heroId }] }),
    User.updateMany({}, { $pull: { bookmarks: heroId } }),
  ])
}

export async function resolveModerationItem(input: ModerationResolveRequest) {
  await requireAdmin()
  await dbConnect()

  const objectId = getObjectId(input.id, input.type === 'hero' ? 'Hero' : 'Comment')
  if (input.action === 'suspend') {
    const content = input.type === 'hero'
      ? await CustomHero.findOne({ _id: objectId }).select('createdByUserId').lean<{ createdByUserId: string } | null>()
      : await Comment.findOne({ _id: objectId }).select('userId').lean<{ userId: string } | null>()
    const authorId = content && ('createdByUserId' in content ? content.createdByUserId : content.userId)

    if (!authorId) {
      throw new ApiRequestError(`${input.type === 'hero' ? 'Hero' : 'Comment'} not found`, 404)
    }

    const objectIdQuery = Types.ObjectId.isValid(authorId) ? [{ _id: new Types.ObjectId(authorId) }] : []
    const user = await User.findOneAndUpdate(
      { $or: [{ clerkId: authorId }, ...objectIdQuery] },
      {
        $set: {
          suspendedAt: new Date(),
          suspensionReason: `Suspended from moderation review of ${input.type} ${input.id}`,
        },
      },
      { returnDocument: 'after', runValidators: true },
    ).select('_id').lean<{ _id: Types.ObjectId } | null>()

    if (!user) {
      throw new ApiRequestError('Content author not found', 404)
    }
  } else if (input.action === 'approve') {
    const result = input.type === 'hero'
      ? await CustomHero.updateOne(
          { _id: objectId },
          { $set: { reports: [], moderationStatus: 'clean' } },
          { runValidators: true },
        )
      : await Comment.updateOne(
          { _id: objectId },
          { $set: { reports: [], moderationStatus: 'clean' } },
          { runValidators: true },
        )

    if (!result.matchedCount) {
      throw new ApiRequestError(`${input.type === 'hero' ? 'Hero' : 'Comment'} not found`, 404)
    }
  } else if (input.type === 'hero') {
    if (!await CustomHero.exists({ _id: objectId })) {
      throw new ApiRequestError('Hero not found', 404)
    }

    await deleteHero(objectId)
  } else {
    const result = await Comment.deleteOne({ _id: objectId })

    if (!result.deletedCount) {
      throw new ApiRequestError('Comment not found', 404)
    }
  }

  return { id: input.id, type: input.type, action: input.action, resolved: true as const }
}
