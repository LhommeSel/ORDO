export const GAME_BRANDS = {
  fr: {
    name: 'État-Nation',
    title: 'État-Nation — Simulation géopolitique',
    tagline: 'Le monde réagit à vos décisions',
  },
  en: {
    name: 'Nation-State',
    title: 'Nation-State — Geopolitical Simulation',
    tagline: 'The world reacts to every decision',
  },
} as const;

export type GameLocale = keyof typeof GAME_BRANDS;
export const DEFAULT_GAME_LOCALE: GameLocale = 'fr';
export const GAME_BRAND = GAME_BRANDS[DEFAULT_GAME_LOCALE];
