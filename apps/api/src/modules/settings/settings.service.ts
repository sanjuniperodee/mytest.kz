import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { PrismaService } from '../../database/prisma.service';
import { UpdateLandingSettingsDto } from './dto/update-landing-settings.dto';
import { REDIS_CLIENT } from '../../database/redis.module';

type LandingSettings = {
  instructionVideoUrl: string;
  instagramUrl: string;
  tiktokUrl: string;
  whatsappUrl: string;
  heroSlides: Array<{
    title: string;
    subtitle: string;
    desktopImageUrl: string;
    tabletImageUrl: string;
    mobileImageUrl: string;
    buttonLabel: string;
    buttonHref: string;
    showButton: boolean;
    isActive: boolean;
  }>;
};

const LANDING_SETTINGS_KEY = 'landing';
const CACHE_KEY = `settings:${LANDING_SETTINGS_KEY}`;

const DEFAULT_LANDING_SETTINGS: LandingSettings = {
  instructionVideoUrl: 'https://youtu.be/xsfHraWRMQ0?si=L3vYe1tIRvOU2XpJ',
  instagramUrl: 'https://instagram.com/',
  tiktokUrl: 'https://www.tiktok.com/',
  whatsappUrl: 'https://wa.me/77775932124',
  heroSlides: [],
};

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async getLandingSettings(): Promise<LandingSettings> {
    const cached = await this.redis.get(CACHE_KEY);
    if (cached) {
      try {
        return JSON.parse(cached) as LandingSettings;
      } catch {}
    }

    const row = await this.prisma.siteSetting.findUnique({
      where: { key: LANDING_SETTINGS_KEY },
      select: { value: true },
    });
    let result: LandingSettings;
    if (!row?.value || typeof row.value !== 'object' || Array.isArray(row.value)) {
      result = DEFAULT_LANDING_SETTINGS;
    } else {
      const raw = row.value as Partial<LandingSettings>;
      result = {
        instructionVideoUrl: raw.instructionVideoUrl || DEFAULT_LANDING_SETTINGS.instructionVideoUrl,
        instagramUrl: raw.instagramUrl || DEFAULT_LANDING_SETTINGS.instagramUrl,
        tiktokUrl: raw.tiktokUrl || DEFAULT_LANDING_SETTINGS.tiktokUrl,
        whatsappUrl: raw.whatsappUrl || DEFAULT_LANDING_SETTINGS.whatsappUrl,
        heroSlides: Array.isArray(raw.heroSlides)
          ? raw.heroSlides
              .filter((x): x is NonNullable<LandingSettings['heroSlides']>[number] => {
                return !!x && typeof x === 'object';
              })
              .map((x) => ({
                title: String(x.title || '').trim(),
                subtitle: String(x.subtitle || '').trim(),
                desktopImageUrl: String(x.desktopImageUrl || '').trim(),
                tabletImageUrl: String(x.tabletImageUrl || '').trim(),
                mobileImageUrl: String(x.mobileImageUrl || '').trim(),
                buttonLabel: String(x.buttonLabel || '').trim(),
                buttonHref: String(x.buttonHref || '').trim(),
                showButton: Boolean(x.showButton ?? true),
                isActive: Boolean(x.isActive ?? true),
              }))
              .filter((x) => x.desktopImageUrl && x.tabletImageUrl && x.mobileImageUrl)
          : DEFAULT_LANDING_SETTINGS.heroSlides,
      };
    }

    await this.redis.set(CACHE_KEY, JSON.stringify(result), 'EX', 3600);
    return result;
  }

  async updateLandingSettings(dto: UpdateLandingSettingsDto): Promise<LandingSettings> {
    const current = await this.getLandingSettings();
    const merged: LandingSettings = {
      instructionVideoUrl: dto.instructionVideoUrl ?? current.instructionVideoUrl,
      instagramUrl: dto.instagramUrl ?? current.instagramUrl,
      tiktokUrl: dto.tiktokUrl ?? current.tiktokUrl,
      whatsappUrl: dto.whatsappUrl ?? current.whatsappUrl,
      heroSlides:
        dto.heroSlides?.map((slide) => ({
          title: slide.title?.trim() ?? '',
          subtitle: slide.subtitle?.trim() ?? '',
          desktopImageUrl: slide.desktopImageUrl.trim(),
          tabletImageUrl: slide.tabletImageUrl.trim(),
          mobileImageUrl: slide.mobileImageUrl.trim(),
          buttonLabel: slide.buttonLabel?.trim() ?? '',
          buttonHref: slide.buttonHref?.trim() ?? '',
          showButton: slide.showButton !== false,
          isActive: slide.isActive !== false,
        })) ?? current.heroSlides,
    };
    await this.prisma.siteSetting.upsert({
      where: { key: LANDING_SETTINGS_KEY },
      update: { value: merged },
      create: { key: LANDING_SETTINGS_KEY, value: merged },
    });
    await this.redis.del(CACHE_KEY);
    return merged;
  }
}
