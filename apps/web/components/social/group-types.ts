import type { Person } from './common';
export type Member = {
  userId: string;
  user: Person;
  role: string;
  muted: boolean;
  banned: boolean;
};
export type GroupDetail = {
  id: string;
  title: string | null;
  description: string;
  inviteToken: string | null;
  myRole: string;
  onlyAdminsPost: boolean;
  archived: boolean;
  members: Member[];
};
