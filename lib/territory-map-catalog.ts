/** Only geometry manifests belong here; the save carries no polygons. Lazy, same-origin loading. */
export const territoryMapCatalog: Record<string, { groups: { id: string; label: string; geometryUrl?: string }[] }> = {
  FRA: { groups: [
    { id: 'metropole', label: 'Métropole · régions de 2000', geometryUrl: '/maps/fra-regions-2000.geojson' },
    { id: 'overseas', label: 'Outre-mer · localisateurs' },
  ] },
  DEU: { groups: [{ id: 'national', label: 'Länder · fond régional 2000', geometryUrl: '/maps/deu-regions.geojson' }] },
  ITA: { groups: [{ id: 'national', label: 'Régions · fond régional 2000', geometryUrl: '/maps/ita-regions.geojson' }] },
  ESP: { groups: [{ id: 'national', label: 'Communautés · fond régional 2000', geometryUrl: '/maps/esp-regions.geojson' }] },
  GBR: { groups: [{ id: 'national', label: 'Nations et régions · fond régional 2000', geometryUrl: '/maps/gbr-regions.geojson' }] },
};
