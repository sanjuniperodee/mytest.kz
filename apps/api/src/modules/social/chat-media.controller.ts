import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { FileInterceptor } from "@nestjs/platform-express";
import { Throttle } from "@nestjs/throttler";
import { memoryStorage } from "multer";
import type { Response } from "express";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ChatMediaService } from "./chat-media.service";
@Controller("social")
@UseGuards(AuthGuard("jwt"))
export class ChatMediaController {
  constructor(private readonly service: ChatMediaService) {}
  @Post("rooms/:id/media")
  @Throttle({ default: { limit: 6, ttl: 60000 } })
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: 15 * 1024 * 1024, files: 1, fields: 0 },
    }),
  )
  upload(
    @CurrentUser("id") user: string,
    @Param("id", ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.service.upload(user, id, file);
  }
  @Get("media/:id")
  async download(
    @CurrentUser("id") user: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const file = await this.service.download(user, id);
    res.setHeader("Content-Type", file.mime);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
    );
    res.sendFile(file.path, (err) => {
      if (err && !res.headersSent) res.status(404).end();
    });
  }
}
