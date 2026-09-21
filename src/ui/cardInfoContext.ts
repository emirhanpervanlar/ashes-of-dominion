import { createContext, useContext, useEffect } from 'react';
import type { CardPlayability, HeroStats } from '../engine/index.js';

export interface CardInfoOptions {
  upgraded?: boolean;
  /** In battle: whether the card can be played right now, and why not. */
  playability?: CardPlayability;
}

export interface CardInfoApi {
  open: (cardId: string, options?: CardInfoOptions) => void;
  /** The hero whose stats the popup quotes for cards that scale with a stat. */
  setHeroStats: (stats: HeroStats) => void;
}

export const CardInfoContext = createContext<CardInfoApi | null>(null);

/** Opens the card info popup (AO-D040): right-click any card. */
export function useCardInfo(): CardInfoApi {
  const api = useContext(CardInfoContext);
  if (!api) throw new Error('useCardInfo needs a CardInfoProvider');
  return api;
}

/** Tells the card info popup the hero's current stats (call it once from the component that owns the run). */
export function useCardInfoHero(stats: HeroStats): void {
  const { setHeroStats } = useCardInfo();
  useEffect(() => setHeroStats(stats), [setHeroStats, stats]);
}
