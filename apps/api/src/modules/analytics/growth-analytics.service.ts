import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export function growthPeriod(from?: string, to?: string) {
  const today = new Date(Date.now() + 5 * 3600000).toISOString().slice(0, 10);
  const last = to || today;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(last) || !Number.isFinite(Date.parse(last)))
    throw new BadRequestException('Даты: YYYY-MM-DD');
  const first = from || new Date(Date.parse(`${last}T00:00:00+05:00`) - 29 * 86400000 + 5 * 3600000).toISOString().slice(0, 10);
  for (const value of [first, last]) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0,10) !== value)
      throw new BadRequestException('Даты: YYYY-MM-DD');
  }
  const start = new Date(`${first}T00:00:00+05:00`);
  const end = new Date(Date.parse(`${last}T00:00:00+05:00`) + 86400000);
  if (end <= start || end.getTime()-start.getTime() > 366 * 86400000)
    throw new BadRequestException('Период: от 1 до 366 дней');
  return { start, end };
}

@Injectable()
export class GrowthAnalyticsService {
  constructor(private readonly db: PrismaService) {}
  async report(from?: string, to?: string, page = 1) {
    const { start, end } = growthPeriod(from, to);
    if (!Number.isInteger(page) || page < 1 || page > 10000) throw new BadRequestException('Некорректная страница');
    return this.db.$transaction(async (tx) => {
      const cohort = await tx.$queryRaw<Record<string, number>[]>`
        WITH cohort AS (SELECT id, created_at FROM users WHERE NOT is_admin AND created_at >= ${start} AND created_at < ${end}),
        stages AS (
          SELECT c.id, s.started, f.finished, p.paid
          FROM cohort c
          LEFT JOIN LATERAL (SELECT min(started_at) AS started FROM test_sessions WHERE user_id=c.id AND started_at>=c.created_at AND started_at<${end}) s ON true
          LEFT JOIN LATERAL (SELECT min(finished_at) AS finished FROM test_sessions WHERE user_id=c.id AND started_at>=s.started AND status IN ('completed','timed_out') AND finished_at<${end}) f ON true
          LEFT JOIN LATERAL (SELECT min(paid_at) AS paid FROM payment_orders WHERE user_id=c.id AND status='paid' AND amount>0 AND paid_at>=f.finished AND paid_at<${end}) p ON true
        ) SELECT count(*)::int registered, count(started)::int started, count(finished)::int finished, count(paid)::int paid FROM stages`;
      const payments = await tx.$queryRaw<Record<string, unknown>[]>`
        SELECT provider, status, count(*)::int orders, count(DISTINCT user_id)::int buyers,
          sum(amount)::float8 amount
        FROM payment_orders p JOIN users u ON u.id=p.user_id
        WHERE NOT u.is_admin AND p.created_at>=${start} AND p.created_at<${end}
        GROUP BY provider,status ORDER BY provider,status`;
      const revenue = await tx.$queryRaw<Record<string, number>[]>`
        SELECT count(*)::int paid_orders, count(DISTINCT user_id)::int buyers, coalesce(sum(amount),0)::float8 gross_kzt
        FROM payment_orders p JOIN users u ON u.id=p.user_id
        WHERE NOT u.is_admin AND p.status='paid' AND p.amount>0 AND p.currency='KZT' AND p.paid_at>=${start} AND p.paid_at<${end}`;
      const events = await tx.$queryRaw<Record<string, unknown>[]>`
        SELECT fs.step, count(*)::int events, count(DISTINCT v.user_id)::int users
        FROM funnel_steps fs JOIN visit_events v ON v.id=fs.visit_id JOIN users u ON u.id=v.user_id
        WHERE NOT u.is_admin AND fs.timestamp>=${start} AND fs.timestamp<${end}
        GROUP BY fs.step ORDER BY events DESC`;
      const survey = await tx.$queryRaw<Record<string, number>[]>`
        SELECT count(*)::int eligible, count(f.shown_at)::int shown, count(f.skipped_at)::int skipped,
          count(f.submitted_at)::int submitted, avg(f.rating)::float8 average_rating
        FROM test_sessions s JOIN users u ON u.id=s.user_id LEFT JOIN test_feedback f ON f.session_id=s.id
        WHERE NOT u.is_admin AND s.status IN ('completed','timed_out') AND s.finished_at>=${start} AND s.finished_at<${end}`;
      const checkoutErrors = await tx.$queryRaw<Record<string, unknown>[]>`
        SELECT fs.metadata->>'provider' provider, fs.metadata->>'reason' reason,
          count(*)::int events, count(DISTINCT v.user_id)::int users
        FROM funnel_steps fs JOIN visit_events v ON v.id=fs.visit_id JOIN users u ON u.id=v.user_id
        WHERE NOT u.is_admin AND fs.step='checkout_error' AND fs.timestamp>=${start} AND fs.timestamp<${end}
        GROUP BY 1,2 ORDER BY events DESC`;
      const blockers = await tx.$queryRaw<Record<string, unknown>[]>`
        SELECT f.blocker, f.intent, count(*)::int responses FROM test_feedback f
        JOIN test_sessions s ON s.id=f.session_id JOIN users u ON u.id=s.user_id
        WHERE NOT u.is_admin AND f.submitted_at>=${start} AND f.submitted_at<${end}
        GROUP BY f.blocker,f.intent ORDER BY responses DESC`;
      const where = { submittedAt: { gte: start, lt: end }, session: { user: { isAdmin: false } } };
      const total = await tx.testFeedback.count({ where });
      const responses = await tx.testFeedback.findMany({
        where, orderBy: [{ submittedAt: 'desc' }, { sessionId: 'desc' }], take: 25, skip: (page-1)*25,
        select: { sessionId: true, rating: true, blocker: true, intent: true, comment: true, locale: true, submittedAt: true,
          session: { select: { rawScore: true, maxScore: true, status: true } } },
      });
      return { period: { from: start.toISOString(), toExclusive: end.toISOString(), timezone: 'Asia/Almaty' },
        cohort: cohort[0], payments, revenue: revenue[0], events, checkoutErrors, survey: survey[0], blockers, responses, total, page };
    }, { isolationLevel: 'RepeatableRead', timeout: 20000 });
  }
}
