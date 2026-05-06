import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { UsersService } from './users.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

const AVATAR_IMAGE_SUBDIR = 'avatars';
const AVATAR_IMAGE_MIME = /^image\/(jpeg|jpg|png|webp)$/i;
const MAX_AVATAR_IMAGE_BYTES = 3 * 1024 * 1024;

@Controller('users')
@UseGuards(AuthGuard('jwt'))
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  async getProfile(@CurrentUser('id') userId: string) {
    return this.usersService.getProfile(userId);
  }

  @Patch('me')
  async updateProfile(
    @CurrentUser('id') userId: string,
    @Body() data: { preferredLanguage?: string; timezone?: string; avatarUrl?: string | null },
  ) {
    return this.usersService.updateProfile(userId, data);
  }

  @Post('me/avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_AVATAR_IMAGE_BYTES },
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype || !AVATAR_IMAGE_MIME.test(file.mimetype)) {
          cb(new BadRequestException('Допустимы только изображения: jpeg, png, webp'), false);
          return;
        }
        cb(null, true);
      },
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const dir = join(process.cwd(), 'uploads', AVATAR_IMAGE_SUBDIR);
          if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname || '').toLowerCase();
          const safe = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext) ? ext : '.png';
          cb(null, `${randomUUID()}${safe}`);
        },
      }),
    }),
  )
  async uploadAvatar(
    @CurrentUser('id') userId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file?.filename) {
      throw new BadRequestException('Файл не получен');
    }
    const avatarUrl = `/uploads/${AVATAR_IMAGE_SUBDIR}/${file.filename}`;
    return this.usersService.updateProfile(userId, { avatarUrl });
  }

  @Delete('me/avatar')
  async deleteAvatar(@CurrentUser('id') userId: string) {
    return this.usersService.updateProfile(userId, { avatarUrl: null });
  }

  @Get('me/stats')
  async getStats(@CurrentUser('id') userId: string) {
    return this.usersService.getStats(userId);
  }
}
