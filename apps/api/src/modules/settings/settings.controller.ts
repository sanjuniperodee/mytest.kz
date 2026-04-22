import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { existsSync, mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import { AdminGuard } from '../../common/guards/admin.guard';
import { UpdateLandingSettingsDto } from './dto/update-landing-settings.dto';
import { SettingsService } from './settings.service';

const LANDING_IMAGE_SUBDIR = 'landing-carousel';
const IMAGE_MIME = /^image\/(jpeg|jpg|png|gif|webp)$/i;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

@Controller()
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('public/landing-settings')
  async getPublicLandingSettings() {
    return this.settingsService.getLandingSettings();
  }

  @Get('admin/settings/landing')
  @UseGuards(AuthGuard('jwt'), AdminGuard)
  async getAdminLandingSettings() {
    return this.settingsService.getLandingSettings();
  }

  @Patch('admin/settings/landing')
  @UseGuards(AuthGuard('jwt'), AdminGuard)
  async updateAdminLandingSettings(@Body() dto: UpdateLandingSettingsDto) {
    return this.settingsService.updateLandingSettings(dto);
  }

  @Post('admin/settings/landing/images')
  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_IMAGE_BYTES },
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype || !IMAGE_MIME.test(file.mimetype)) {
          cb(new BadRequestException('Допустимы только изображения: jpeg, png, gif, webp'), false);
          return;
        }
        cb(null, true);
      },
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const dir = join(process.cwd(), 'uploads', LANDING_IMAGE_SUBDIR);
          if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname || '').toLowerCase();
          const safe = ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext) ? ext : '.png';
          cb(null, `${randomUUID()}${safe}`);
        },
      }),
    }),
  )
  async uploadLandingImage(@UploadedFile() file: Express.Multer.File) {
    if (!file?.filename) {
      throw new BadRequestException('Файл не получен');
    }
    const url = `/uploads/${LANDING_IMAGE_SUBDIR}/${file.filename}`;
    return { url };
  }
}
