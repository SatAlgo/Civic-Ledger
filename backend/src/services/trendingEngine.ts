import { Issue } from '../models/Issue';

/**
 * Engagement score — HN-inspired time-decay formula.
 *
 *   score = (upvotes + comments * 2) / (hoursOld + 2)^1.5
 *
 * - Comments count double because writing is harder than clicking.
 * - The (+2) prevents brand-new issues with one vote from scoring infinity.
 * - The 1.5 exponent gives moderate decay: a 24h-old issue needs noticeably
 *   more engagement than a 2h-old one to stay on top.
 *
 * Re-tune these constants by editing here only — don't sprinkle the math
 * across the codebase.
 */
const COMMENT_WEIGHT = 2;
const GRAVITY = 1.5;
const AGE_OFFSET_HOURS = 2;

export function computeEngagementScore(params: {
  upvotes: number;
  comments: number;
  createdAt: Date;
  now?: Date;
}): number {
  const now = params.now ?? new Date();
  const hoursOld =
    Math.max(0, (now.getTime() - params.createdAt.getTime()) / 36e5);
  const raw = params.upvotes + params.comments * COMMENT_WEIGHT;
  const denom = Math.pow(hoursOld + AGE_OFFSET_HOURS, GRAVITY);
  return raw / denom;
}

/**
 * Recompute engagement scores for issues posted in the last N days.
 * Old issues have effectively-zero decayed scores so they don't need refreshing.
 *
 * Uses bulkWrite for efficiency. Safe to run repeatedly.
 */
const REFRESH_WINDOW_DAYS = 7;

export async function refreshTrendingScores() {
  const cutoff = new Date(Date.now() - REFRESH_WINDOW_DAYS * 86400_000);
  const issues = await Issue.find(
    { createdAt: { $gte: cutoff } },
    { _id: 1, upvoteCount: 1, commentCount: 1, createdAt: 1 }
  ).lean();

  if (issues.length === 0) return { updated: 0 };

  const now = new Date();
  const ops = issues.map((i) => ({
    updateOne: {
      filter: { _id: i._id },
      update: {
        $set: {
          engagementScore: computeEngagementScore({
            upvotes: i.upvoteCount ?? 0,
            comments: i.commentCount ?? 0,
            createdAt: i.createdAt,
            now,
          }),
        },
      },
    },
  }));

  const res = await Issue.bulkWrite(ops, { ordered: false });
  return { updated: res.modifiedCount ?? 0 };
}

/**
 * Starts a background interval that refreshes trending scores every N minutes.
 * Returns a handle so the caller can stop it (in tests, on shutdown).
 */
const REFRESH_EVERY_MINUTES = 5;

export function startTrendingRefreshLoop() {
  const tick = async () => {
    try {
      const { updated } = await refreshTrendingScores();
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[trending] refreshed ${updated} issues`);
      }
    } catch (err) {
      console.error('[trending] refresh failed:', err);
    }
  };

  // Don't block startup — first tick after 30s, then on the interval
  const handle = setInterval(tick, REFRESH_EVERY_MINUTES * 60_000);
  setTimeout(tick, 30_000).unref();
  return handle;
}
