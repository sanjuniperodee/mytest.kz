const INVITE = /^\/dashboard\/community\/invite\/[0-9a-f-]{36}$/i;
const KEY = 'mytest-pending-invite';
export function rememberInvite(path: string) {
  if (INVITE.test(path)) sessionStorage.setItem(KEY, path);
}
export function loginDestination() {
  if (typeof window === 'undefined') return '/dashboard';
  const path = sessionStorage.getItem(KEY);
  return path && INVITE.test(path) ? path : '/dashboard';
}
export function clearInviteDestination() { sessionStorage.removeItem(KEY); }
