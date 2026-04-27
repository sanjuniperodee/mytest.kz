export type ModernHeroSlide = {
  title?: string;
  subtitle?: string;
  desktopImageUrl: string;
  tabletImageUrl: string;
  mobileImageUrl: string;
  buttonLabel?: string;
  buttonHref?: string;
  showButton?: boolean;
  isActive?: boolean;
};

export type LegacyHeroSlide = {
  image: string;
  title: string;
  subtitle: string;
  cta: string;
};

export type HeroSlide = ModernHeroSlide | LegacyHeroSlide;

export function isModernSlide(slide: HeroSlide): slide is ModernHeroSlide {
  return 'desktopImageUrl' in slide;
}

export type LandingRuntimeSettings = {
  instructionVideoUrl: string;
  instagramUrl: string;
  tiktokUrl: string;
  whatsappUrl: string;
  heroSlides?: HeroSlide[];
};

export function shouldShowHeroCta(slide: HeroSlide): boolean {
  if ((slide as ModernHeroSlide).showButton === false) return false;
  const modern = slide as ModernHeroSlide;
  return Boolean(modern.buttonLabel?.trim() && modern.buttonHref?.trim());
}

export function isExternalHref(href: string | undefined): boolean {
  if (!href) return false;
  return /^https?:\/\//i.test(href);
}

export function toYoutubeEmbedUrl(rawUrl: string): string | null {
  const value = rawUrl.trim();
  if (!value) return null;
  try {
    const parsed = new URL(value);
    if (parsed.hostname.includes('youtu.be')) {
      const id = parsed.pathname.replace(/^\/+/, '').split('/')[0];
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (parsed.hostname.includes('youtube.com')) {
      if (parsed.pathname.startsWith('/embed/')) return value;
      const id = parsed.searchParams.get('v');
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    return null;
  } catch {
    return null;
  }
}
