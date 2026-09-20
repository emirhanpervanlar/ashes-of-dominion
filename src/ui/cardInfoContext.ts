import { createContext, useContext } from 'react';
import type { CardPlayability } from '../engine/index.js';

export interface CardInfoOptions {
  upgraded?: boolean;
  /** In battle: whether the card can be played right now, and why not. */
  playability?: CardPlayability;
}

export interface CardInfoApi {
  open: (cardId: string, options?: CardInfoOptions) => void;
}

export const CardInfoContext = createContext<CardInfoApi | null>(null);

/** Opens the card info popup (AO-D040): right-click any card. */
export function useCardInfo(): CardInfoApi {
  const api = useContext(CardInfoContext);
  if (!api) throw new Error('useCardInfo needs a CardInfoProvider');
  return api;
}
