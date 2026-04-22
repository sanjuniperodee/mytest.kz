import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UpdateLandingSettingsDto } from './dto/update-landing-settings.dto';

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

const DEFAULT_LANDING_SETTINGS: LandingSettings = {
  instructionVideoUrl: 'https://youtu.be/xsfHraWRMQ0?si=L3vYe1tIRvOU2XpJ',
  instagramUrl: 'https://instagram.com/',
  tiktokUrl: 'https://www.tiktok.com/',
  whatsappUrl: 'https://wa.me/77775932124',
  heroSlides: [],
};

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getLandingSettings(): Promise<LandingSettings> {
    const row = await this.prisma.siteSetting.findUnique({
      where: { key: LANDING_SETTINGS_KEY },
      select: { value: true },
    });
    if (!row?.value || typeof row.value !== 'object' || Array.isArray(row.value)) {
      return DEFAULT_LANDING_SETTINGS;
    }
    const raw = row.value as Partial<LandingSettings>;
    return {
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
              buttonLabel: String(x.buttonLabel || '').trim() || 'Начать тест',
              buttonHref: String(x.buttonHref || '').trim() || '/login',
              showButton: Boolean(x.showButton ?? true),
              isActive: Boolean(x.isActive ?? true),
            }))
            .filter((x) => x.title && x.desktopImageUrl && x.tabletImageUrl && x.mobileImageUrl)
        : DEFAULT_LANDING_SETTINGS.heroSlides,
    };
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
          title: slide.title.trim(),
          subtitle: slide.subtitle?.trim() || '',
          desktopImageUrl: slide.desktopImageUrl.trim(),
          tabletImageUrl: slide.tabletImageUrl.trim(),
          mobileImageUrl: slide.mobileImageUrl.trim(),
          buttonLabel: slide.buttonLabel?.trim() || 'Начать тест',
          buttonHref: slide.buttonHref?.trim() || '/login',
          showButton: slide.showButton !== false,
          isActive: slide.isActive !== false,
        })) ?? current.heroSlides,
    };
    await this.prisma.siteSetting.upsert({
      where: { key: LANDING_SETTINGS_KEY },
      update: { value: merged },
      create: { key: LANDING_SETTINGS_KEY, value: merged },
    });
    return merged;
  }
}
