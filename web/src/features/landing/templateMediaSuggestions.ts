export type TemplateMediaPack = {
  hero: string;
  gallery: string[];
};

const IMAGE_LIBRARY = {
  luxury: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1800&q=80',
  warm: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1800&q=80',
  minimal: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1800&q=80',
  bold: 'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1800&q=80',
  elegant: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1800&q=80',
  coastal: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1800&q=80',
  urban: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1800&q=80',
  garden: 'https://images.unsplash.com/photo-1598228723793-52759bba239c?auto=format&fit=crop&w=1800&q=80',
};

const TEMPLATE_MEDIA_PACKS: Record<string, TemplateMediaPack> = {
  'modern-luxury': {
    hero: IMAGE_LIBRARY.luxury,
    gallery: [IMAGE_LIBRARY.elegant, IMAGE_LIBRARY.bold, IMAGE_LIBRARY.minimal, IMAGE_LIBRARY.urban],
  },
  'warm-earth': {
    hero: IMAGE_LIBRARY.warm,
    gallery: [IMAGE_LIBRARY.garden, IMAGE_LIBRARY.elegant, IMAGE_LIBRARY.luxury, IMAGE_LIBRARY.coastal],
  },
  'minimal-white': {
    hero: IMAGE_LIBRARY.minimal,
    gallery: [IMAGE_LIBRARY.luxury, IMAGE_LIBRARY.urban, IMAGE_LIBRARY.coastal, IMAGE_LIBRARY.elegant],
  },
  'bold-contrast': {
    hero: IMAGE_LIBRARY.bold,
    gallery: [IMAGE_LIBRARY.urban, IMAGE_LIBRARY.luxury, IMAGE_LIBRARY.coastal, IMAGE_LIBRARY.minimal],
  },
  'elegant-serif': {
    hero: IMAGE_LIBRARY.elegant,
    gallery: [IMAGE_LIBRARY.luxury, IMAGE_LIBRARY.warm, IMAGE_LIBRARY.garden, IMAGE_LIBRARY.coastal],
  },
  'coastal-breeze': {
    hero: IMAGE_LIBRARY.coastal,
    gallery: [IMAGE_LIBRARY.minimal, IMAGE_LIBRARY.luxury, IMAGE_LIBRARY.warm, IMAGE_LIBRARY.garden],
  },
  'urban-edge': {
    hero: IMAGE_LIBRARY.urban,
    gallery: [IMAGE_LIBRARY.bold, IMAGE_LIBRARY.minimal, IMAGE_LIBRARY.luxury, IMAGE_LIBRARY.elegant],
  },
  'garden-retreat': {
    hero: IMAGE_LIBRARY.garden,
    gallery: [IMAGE_LIBRARY.warm, IMAGE_LIBRARY.coastal, IMAGE_LIBRARY.luxury, IMAGE_LIBRARY.elegant],
  },
};

const DEFAULT_TEMPLATE_ID = 'modern-luxury';

export function getTemplateMediaPack(templateId?: string | null): TemplateMediaPack {
  const id = templateId && TEMPLATE_MEDIA_PACKS[templateId] ? templateId : DEFAULT_TEMPLATE_ID;
  const pack = TEMPLATE_MEDIA_PACKS[id];
  return {
    hero: pack.hero,
    gallery: [...pack.gallery],
  };
}

export function getTemplatePreviewImage(templateId?: string | null): string {
  return getTemplateMediaPack(templateId).hero;
}
