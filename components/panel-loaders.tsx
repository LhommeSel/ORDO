'use client';

import { lazy, Suspense, type ReactNode } from 'react';

/**
 * Les vues qui chargent des atlas/cartes ou des fiches diplomatiques restent
 * hors du premier bundle. Ce module isole le câblage de chargement afin que la
 * page de jeu n'ait pas à connaître les détails de chaque chunk.
 */
export const WorldMap = lazy(() => import('@/components/world-map').then((module) => ({ default: module.WorldMap })));
export const TerritoryExplorer = lazy(() => import('@/components/territory-explorer').then((module) => ({ default: module.TerritoryExplorer })));
export const DiplomacySheet = lazy(() => import('@/components/diplomacy-sheet').then((module) => ({ default: module.DiplomacySheet })));

export function DeferredPanel({ fallback, children }: { fallback: ReactNode; children: ReactNode }) {
  return <Suspense fallback={fallback}>{children}</Suspense>;
}
