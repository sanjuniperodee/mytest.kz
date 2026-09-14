import type { Person } from "./common";
import type { Attachment } from "./media";
export type Message = {
  id: string;
  authorId: string;
  body: string;
  createdAt: string;
  author: Person;
  attachment?: Attachment | null;
};
export type Room = {
  id: string;
  key: string;
  kind: "direct" | "group" | "global";
  title: string | null;
  archived: boolean;
  onlyAdminsPost: boolean;
  unread: number;
  members: {
    userId: string;
    user: Person;
    role: "owner" | "admin" | "member";
    muted: boolean;
  }[];
  messages: Message[];
};
