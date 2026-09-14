import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "crypto";
import { PrismaService } from "../../database/prisma.service";
import { ChatAccessService } from "./chat-access.service";
import { ChatFileStore } from "./infrastructure/chat-file-store";
import { sniffChatMedia } from "./domain/media-format";
@Injectable()
export class ChatMediaService {
  constructor(
    private readonly db: PrismaService,
    private readonly chatAccess: ChatAccessService,
    private readonly files: ChatFileStore,
  ) {}
  async upload(user: string, id: string, file: Express.Multer.File) {
    await this.chatAccess.access(user, id, this.db, true);
    if (!file?.buffer) throw new BadRequestException("Выберите файл");
    let mime = sniffChatMedia(file.buffer);
    if (!mime)
      throw new BadRequestException(
        "Поддерживаются JPG, PNG, WebP, PDF, MP4, WebM, MP3, OGG и WAV",
      );
    if (file.mimetype.startsWith("audio/") && mime.startsWith("video/"))
      mime = mime.replace("video/", "audio/");
    const attachmentId = randomUUID();
    await this.files.put(attachmentId, file.buffer);
    try {
      return await this.db.$transaction(async (tx) => {
        // Serialize quota reservations across all rooms for this uploader.
        await tx.$queryRaw`SELECT id FROM "users" WHERE id = ${user}::uuid FOR UPDATE`;
        const usage = await tx.chatAttachment.aggregate({
          where: { uploaderId: user, createdAt: { gte: new Date(Date.now() - 86400000) } },
          _sum: { size: true },
        });
        if ((usage._sum.size || 0) + file.size > 150 * 1024 * 1024)
          throw new BadRequestException("Дневной лимит загрузок — 150 МБ");
        return tx.chatAttachment.create({
        data: {
          id: attachmentId,
          roomId: id,
          uploaderId: user,
          name: file.originalname.replace(/[\x00-\x1f/\\]/g, "_").slice(0, 150),
          size: file.size,
          mime,
        },
        });
      });
    } catch (e) {
      await this.files.remove(attachmentId);
      throw e;
    }
  }

  async download(user: string, id: string) {
    const file = await this.db.chatAttachment.findUnique({
      where: { id },
      include: { message: true },
    });
    if (!file) throw new NotFoundException();
    const admin = await this.db.user.findUnique({
      where: { id: user },
      select: { isAdmin: true },
    });
    if (admin?.isAdmin)
      await this.db.chatModerationAudit.create({
        data: {
          actorId: user,
          roomId: file.roomId,
          targetId: id,
          action: "view_media",
        },
      });
    else {
      await this.chatAccess.access(user, file.roomId);
      if (
        file.message?.deletedAt ||
        (!file.message && file.uploaderId !== user)
      )
        throw new NotFoundException();
      if (
        await this.db.socialBlock.findFirst({
          where: {
            OR: [
              { blockerId: user, blockedId: file.uploaderId },
              { blockerId: file.uploaderId, blockedId: user },
            ],
          },
        })
      )
        throw new NotFoundException();
    }

    return { ...file, path: this.files.path(id) };
  }
}
