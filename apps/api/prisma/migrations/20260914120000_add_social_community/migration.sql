-- CreateEnum
CREATE TYPE "ChatKind" AS ENUM ('direct', 'group', 'global');

-- CreateEnum
CREATE TYPE "ChatRole" AS ENUM ('owner', 'admin', 'member');

-- CreateTable
CREATE TABLE "SocialPost" (
    "groupInviteId" UUID,
    "groupInviteToken" UUID,
    "id" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "body" VARCHAR(2000) NOT NULL,
    "parentId" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMPTZ,

    CONSTRAINT "SocialPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialLike" (
    "userId" UUID NOT NULL,
    "postId" UUID NOT NULL,

    CONSTRAINT "SocialLike_pkey" PRIMARY KEY ("userId","postId")
);

-- CreateTable
CREATE TABLE "SocialRepost" (
    "userId" UUID NOT NULL,
    "postId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialRepost_pkey" PRIMARY KEY ("userId","postId")
);

-- CreateTable
CREATE TABLE "SocialFollow" (
    "followerId" UUID NOT NULL,
    "followingId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialFollow_pkey" PRIMARY KEY ("followerId","followingId")
);

-- CreateTable
CREATE TABLE "SocialBlock" (
    "blockerId" UUID NOT NULL,
    "blockedId" UUID NOT NULL,

    CONSTRAINT "SocialBlock_pkey" PRIMARY KEY ("blockerId","blockedId")
);

-- CreateTable
CREATE TABLE "SocialReport" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "postId" UUID NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatRoom" (
    "kind" "ChatKind" NOT NULL DEFAULT 'direct',
    "title" VARCHAR(100),
    "description" VARCHAR(500) NOT NULL DEFAULT '',
    "inviteToken" UUID,
    "onlyAdminsPost" BOOLEAN NOT NULL DEFAULT false,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "id" UUID NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMember" (
    "role" "ChatRole" NOT NULL DEFAULT 'member',
    "muted" BOOLEAN NOT NULL DEFAULT false,
    "banned" BOOLEAN NOT NULL DEFAULT false,
    "roomId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "readAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMember_pkey" PRIMARY KEY ("roomId","userId")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "deletedAt" TIMESTAMPTZ,
    "attachmentId" UUID,
    "id" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "body" VARCHAR(2000) NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatAttachment" (
    "id" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "uploaderId" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "mime" VARCHAR(80) NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatModerationAudit" (
    "id" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "targetId" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatModerationAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SocialPost_parentId_createdAt_id_idx" ON "SocialPost"("parentId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "SocialPost_authorId_createdAt_id_idx" ON "SocialPost"("authorId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "SocialLike_postId_idx" ON "SocialLike"("postId");

-- CreateIndex
CREATE INDEX "SocialRepost_postId_idx" ON "SocialRepost"("postId");

-- CreateIndex
CREATE INDEX "SocialFollow_followingId_idx" ON "SocialFollow"("followingId");

-- CreateIndex
CREATE INDEX "SocialBlock_blockedId_idx" ON "SocialBlock"("blockedId");

-- CreateIndex
CREATE UNIQUE INDEX "SocialReport_userId_postId_key" ON "SocialReport"("userId", "postId");

-- CreateIndex
CREATE UNIQUE INDEX "ChatRoom_inviteToken_key" ON "ChatRoom"("inviteToken");

-- CreateIndex
CREATE UNIQUE INDEX "ChatRoom_key_key" ON "ChatRoom"("key");

-- CreateIndex
CREATE INDEX "ChatMember_userId_idx" ON "ChatMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ChatMessage_attachmentId_key" ON "ChatMessage"("attachmentId");

-- CreateIndex
CREATE INDEX "ChatMessage_roomId_createdAt_id_idx" ON "ChatMessage"("roomId", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ChatMessage_authorId_clientId_key" ON "ChatMessage"("authorId", "clientId");

-- CreateIndex
CREATE INDEX "ChatAttachment_roomId_createdAt_idx" ON "ChatAttachment"("roomId", "createdAt");

-- CreateIndex
CREATE INDEX "ChatModerationAudit_roomId_createdAt_idx" ON "ChatModerationAudit"("roomId", "createdAt");

-- AddForeignKey
ALTER TABLE "SocialPost" ADD CONSTRAINT "SocialPost_groupInviteId_fkey" FOREIGN KEY ("groupInviteId") REFERENCES "ChatRoom"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialPost" ADD CONSTRAINT "SocialPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialPost" ADD CONSTRAINT "SocialPost_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "SocialPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialLike" ADD CONSTRAINT "SocialLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialLike" ADD CONSTRAINT "SocialLike_postId_fkey" FOREIGN KEY ("postId") REFERENCES "SocialPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialRepost" ADD CONSTRAINT "SocialRepost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialRepost" ADD CONSTRAINT "SocialRepost_postId_fkey" FOREIGN KEY ("postId") REFERENCES "SocialPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialFollow" ADD CONSTRAINT "SocialFollow_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialFollow" ADD CONSTRAINT "SocialFollow_followingId_fkey" FOREIGN KEY ("followingId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialBlock" ADD CONSTRAINT "SocialBlock_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialBlock" ADD CONSTRAINT "SocialBlock_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialReport" ADD CONSTRAINT "SocialReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialReport" ADD CONSTRAINT "SocialReport_postId_fkey" FOREIGN KEY ("postId") REFERENCES "SocialPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMember" ADD CONSTRAINT "ChatMember_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "ChatRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMember" ADD CONSTRAINT "ChatMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_attachmentId_fkey" FOREIGN KEY ("attachmentId") REFERENCES "ChatAttachment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "ChatRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatAttachment" ADD CONSTRAINT "ChatAttachment_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "ChatRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
