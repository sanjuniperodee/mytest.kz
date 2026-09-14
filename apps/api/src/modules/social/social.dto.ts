import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from "class-validator";

export class TextDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(1, 2000)
  body!: string;
}
export class PostDto extends TextDto {
  @IsOptional() @IsUUID() parentId?: string;
  @IsOptional() @IsUUID() groupInviteId?: string;
}
export class MessageDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(0, 2000)
  body!: string;
  @IsOptional() @IsUUID() attachmentId?: string;
  @IsUUID() clientId!: string;
}
export class GroupDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(1, 100)
  title!: string;
  @IsOptional() @IsString() @Length(0, 500) description?: string;
  @IsOptional() @IsBoolean() onlyAdminsPost?: boolean;
}
export class MemberDto {
  @IsIn([
    "admin",
    "member",
    "mute",
    "unmute",
    "ban",
    "unban",
    "remove",
    "transfer",
  ])
  action!: string;
}
export class ChatQueryDto {
  @IsOptional() @IsUUID() cursor?: string;
  @IsOptional() @IsString() @Length(0, 100) q?: string;
  @IsOptional() @IsIn(["all", "group", "direct", "global"]) type?: string;
}
export class ReadDto {
  @IsUUID() messageId!: string;
}

export class ReportDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(1, 500)
  reason!: string;
}
export class FeedDto {
  @IsOptional() @IsUUID() cursor?: string;
  @IsOptional() @IsUUID() authorId?: string;
  @IsOptional() @IsUUID() parentId?: string;
  @IsOptional()
  @IsIn(["all", "following", "posts", "replies", "reposts"])
  tab?: string;
}
export class PeopleDto {
  @IsOptional() @IsString() @Length(0, 100) q?: string;
  @IsOptional() @IsUUID() userId?: string;
  @IsOptional() @IsIn(["followers", "following"]) relation?: string;
}
