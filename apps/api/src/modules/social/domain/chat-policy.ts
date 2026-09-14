import type { ChatKind, ChatRole } from "@prisma/client";

export const GROUP_MEMBER_LIMIT = 200;
export function canSend(
  room: { archived: boolean; onlyAdminsPost: boolean },
  member: { muted: boolean; banned: boolean; role: ChatRole },
): boolean {
  return (
    !room.archived &&
    !member.banned &&
    !member.muted &&
    (!room.onlyAdminsPost || member.role !== "member")
  );
}
export function canManageMember(
  actor: { role: ChatRole; userId: string },
  target: { role: ChatRole; userId: string },
  action: string,
): boolean {
  if (
    actor.userId === target.userId ||
    actor.role === "member" ||
    target.role === "owner"
  )
    return false;
  return (
    actor.role === "owner" ||
    (target.role === "member" &&
      !["admin", "member", "transfer"].includes(action))
  );
}
export function isDirect(kind: ChatKind): boolean {
  return kind === "direct";
}
