// Community API contract (apps/api/src/modules/social); mirrors apps/web/components/social.

export type Person = {
  id: string
  firstName: string | null
  lastName: string | null
  avatarUrl: string | null
  followers?: { followerId: string }[]
}

export type Page<T> = { items: T[]; nextCursor: string | null }

export type Post = {
  groupInvite?: { id: string; title: string | null; archived: boolean } | null
  groupInviteToken?: string | null
  id: string
  body: string
  authorId: string
  parentId: string | null
  createdAt: string
  author: Person
  _count: { likes: number; replies: number; reposts: number }
  likes: { userId: string }[]
  reposts: { userId: string }[]
  views?: number
}

export type Attachment = {
  id: string
  name: string
  mime: string
  size: number
}

export type Message = {
  id: string
  authorId: string
  body: string
  createdAt: string
  author: Person
  attachment?: Attachment | null
}

export type Room = {
  id: string
  key: string
  kind: "direct" | "group" | "global"
  title: string | null
  archived: boolean
  onlyAdminsPost: boolean
  unread: number
  members: {
    userId: string
    user: Person
    role: "owner" | "admin" | "member"
    muted: boolean
  }[]
  messages: Message[]
}

export type GroupMember = {
  userId: string
  user: Person
  role: string
  muted: boolean
  banned: boolean
}

export type GroupDetail = {
  id: string
  title: string | null
  description: string
  inviteToken: string | null
  myRole: string
  onlyAdminsPost: boolean
  archived: boolean
  members: GroupMember[]
}

export type ProfileLearning = {
  entAttempts: number
  /** Null when there is no full attempt, or when it is outside the public top. */
  entBest: {
    rank: number
    rawScore: number
    maxScore: number
    profileSubjects: string[]
  } | null
}

export type Profile = Person & {
  createdAt: string
  blocked: boolean
  unavailable: boolean
  learning: ProfileLearning | null
  _count: { followers: number; following: number; socialPosts: number }
}

export type GroupInvitePreview = {
  title: string
  description: string
  _count: { members: number }
}

export const personName = (p: Pick<Person, "firstName" | "lastName">) =>
  [p.firstName, p.lastName].filter(Boolean).join(" ") || "mytest user"

export const profileHref = (id: string) => `/dashboard/profile/${id}` as never

export function formatViews(views?: number): string {
  const n = views ?? 0
  if (n < 1000) return String(n)
  if (n < 1_000_000) {
    const k = n / 1000
    return `${k >= 10 ? Math.round(k) : k.toFixed(1).replace(/\.0$/, "")}K`
  }
  const m = n / 1_000_000
  return `${m >= 10 ? Math.round(m) : m.toFixed(1).replace(/\.0$/, "")}M`
}
