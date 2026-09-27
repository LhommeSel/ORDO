import type {
  TerritorialAsset,
  TerritorialAssetRole,
  TerritorialPortCapability,
  TerritorialPortClass,
  TerritorialPortOperationalState,
  TerritorialPortProfile,
  TerritorialState,
} from './territory-types';

/**
 * Catalogue portuaire réduit des Amériques.
 *
 * Le but n’est pas de recenser chaque quai : chaque pays reçoit un à six
 * nœuds qui peuvent modifier une route, un approvisionnement ou une crise.
 * Chaque nœud porte un profil jouable : une classe qualitative (qui peut
 * changer), une capacité de marchandises disponible sur 0–10 et un plafond
 * d'infrastructure distinct. Ces curseurs ne constituent pas un tonnage
 * observé et ne remplacent jamais le registre énergétique.
 */
export type AmericasPortEntry = {
  id: string;
  countryId: string;
  name: string;
  /** Suffixe de la maille macro-régionale, ou `aggregate` si non régionalisé. */
  territorySuffix: string;
  anchor: [number, number];
  /** Indices internes historiques, utilisés uniquement pour dériver le profil large. */
  roles: TerritorialAssetRole[];
  note: string;
};

export const portClassLabels: Record<TerritorialPortClass, string> = {
  local: 'Port local',
  regional: 'Port régional',
  national: 'Grand port national',
  major: 'Port majeur',
  global_hub: 'Hub mondial',
  megahub: 'Mégahub',
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function portClassFor(goodsCapacity: number, nationalReach: number): TerritorialPortClass {
  const score = goodsCapacity * 0.7 + nationalReach * 0.3;
  if (score >= 9.2) return 'megahub';
  if (score >= 7.6) return 'global_hub';
  if (score >= 6.2) return 'major';
  if (score >= 4.4) return 'national';
  if (score >= 2.5) return 'regional';
  return 'local';
}

const countryDefaults: Record<string, Pick<TerritorialPortProfile, 'nationalReach' | 'governanceRisk' | 'laborFriction' | 'developmentPotential'>> = {
  USA: { nationalReach: 9, governanceRisk: 1, laborFriction: 2, developmentPotential: 2 },
  CAN: { nationalReach: 8, governanceRisk: 1, laborFriction: 2, developmentPotential: 2 },
  MEX: { nationalReach: 7, governanceRisk: 4, laborFriction: 3, developmentPotential: 3 },
  GTM: { nationalReach: 5, governanceRisk: 5, laborFriction: 3, developmentPotential: 3 },
  BLZ: { nationalReach: 3, governanceRisk: 4, laborFriction: 2, developmentPotential: 3 },
  HND: { nationalReach: 5, governanceRisk: 5, laborFriction: 3, developmentPotential: 3 },
  SLV: { nationalReach: 6, governanceRisk: 4, laborFriction: 3, developmentPotential: 3 },
  NIC: { nationalReach: 4, governanceRisk: 5, laborFriction: 3, developmentPotential: 3 },
  CRI: { nationalReach: 6, governanceRisk: 2, laborFriction: 2, developmentPotential: 2 },
  PAN: { nationalReach: 7, governanceRisk: 3, laborFriction: 2, developmentPotential: 2 },
  CUB: { nationalReach: 5, governanceRisk: 5, laborFriction: 3, developmentPotential: 2 },
  HTI: { nationalReach: 3, governanceRisk: 8, laborFriction: 4, developmentPotential: 4 },
  DOM: { nationalReach: 6, governanceRisk: 4, laborFriction: 3, developmentPotential: 3 },
  JAM: { nationalReach: 6, governanceRisk: 4, laborFriction: 3, developmentPotential: 2 },
  BHS: { nationalReach: 4, governanceRisk: 3, laborFriction: 2, developmentPotential: 2 },
  BRB: { nationalReach: 5, governanceRisk: 2, laborFriction: 2, developmentPotential: 2 },
  TTO: { nationalReach: 6, governanceRisk: 4, laborFriction: 3, developmentPotential: 2 },
  ATG: { nationalReach: 3, governanceRisk: 3, laborFriction: 2, developmentPotential: 3 },
  DMA: { nationalReach: 3, governanceRisk: 3, laborFriction: 2, developmentPotential: 3 },
  GRD: { nationalReach: 3, governanceRisk: 3, laborFriction: 2, developmentPotential: 3 },
  KNA: { nationalReach: 3, governanceRisk: 3, laborFriction: 2, developmentPotential: 3 },
  LCA: { nationalReach: 4, governanceRisk: 3, laborFriction: 2, developmentPotential: 2 },
  VCT: { nationalReach: 3, governanceRisk: 3, laborFriction: 2, developmentPotential: 3 },
  BRA: { nationalReach: 8, governanceRisk: 4, laborFriction: 3, developmentPotential: 3 },
  ARG: { nationalReach: 7, governanceRisk: 4, laborFriction: 3, developmentPotential: 3 },
  CHL: { nationalReach: 7, governanceRisk: 2, laborFriction: 2, developmentPotential: 2 },
  COL: { nationalReach: 6, governanceRisk: 5, laborFriction: 3, developmentPotential: 3 },
  PER: { nationalReach: 6, governanceRisk: 4, laborFriction: 3, developmentPotential: 3 },
  ECU: { nationalReach: 5, governanceRisk: 4, laborFriction: 3, developmentPotential: 3 },
  VEN: { nationalReach: 5, governanceRisk: 7, laborFriction: 4, developmentPotential: 3 },
  GUY: { nationalReach: 4, governanceRisk: 5, laborFriction: 3, developmentPotential: 4 },
  SUR: { nationalReach: 4, governanceRisk: 4, laborFriction: 3, developmentPotential: 4 },
  URY: { nationalReach: 6, governanceRisk: 2, laborFriction: 2, developmentPotential: 2 },
  PRY: { nationalReach: 4, governanceRisk: 5, laborFriction: 3, developmentPotential: 4 },
  BOL: { nationalReach: 3, governanceRisk: 5, laborFriction: 3, developmentPotential: 4 },
};

/** Réglages explicites des hubs retenus au lancement (base 2000). */
const majorPortOverrides: Record<string, Partial<TerritorialPortProfile>> = {
  'los-angeles-long-beach': { goodsCapacity: 10, infrastructureCapacity: 10, nationalReach: 10, governanceRisk: 1, laborFriction: 2, developmentPotential: 1 },
  'new-york-new-jersey': { goodsCapacity: 9, infrastructureCapacity: 10, nationalReach: 10, governanceRisk: 1, laborFriction: 2 },
  houston: { goodsCapacity: 9, infrastructureCapacity: 10, nationalReach: 9, capabilities: ['general_cargo', 'solid_bulk', 'liquid_hydrocarbons', 'lng'] },
  savannah: { goodsCapacity: 8, infrastructureCapacity: 9, nationalReach: 8 },
  vancouver: { goodsCapacity: 8, infrastructureCapacity: 9, nationalReach: 9 },
  montreal: { goodsCapacity: 7, infrastructureCapacity: 8, nationalReach: 9 },
  'manzanillo-mexico': { goodsCapacity: 7, infrastructureCapacity: 8, nationalReach: 7 },
  balboa: { goodsCapacity: 9, infrastructureCapacity: 10, nationalReach: 9 },
  cristobal: { goodsCapacity: 9, infrastructureCapacity: 10, nationalReach: 9 },
  santos: { goodsCapacity: 9, infrastructureCapacity: 10, nationalReach: 9 },
  paranagua: { goodsCapacity: 8, infrastructureCapacity: 9, nationalReach: 8 },
  'buenos-aires': { goodsCapacity: 8, infrastructureCapacity: 9, nationalReach: 8 },
  'cartagena-colombia': { goodsCapacity: 8, infrastructureCapacity: 9, nationalReach: 7 },
  callao: { goodsCapacity: 7, infrastructureCapacity: 8, nationalReach: 7 },
  guayaquil: { goodsCapacity: 7, infrastructureCapacity: 8, nationalReach: 6 },
  kingston: { goodsCapacity: 8, infrastructureCapacity: 9, nationalReach: 6 },
};

const passengerPorts = new Set([
  'new-york-new-jersey', 'vancouver', 'montreal', 'halifax', 'nassau', 'freeport', 'bridgetown',
  'kingston', 'montego-bay', 'port-of-spain', 'castries', 'st-johns', 'roseau', 'st-georges',
  'basseterre', 'kingstown', 'havana', 'port-au-prince', 'puerto-plata', 'mar-del-plata',
]);

function portCapabilities(entry: AmericasPortEntry): TerritorialPortCapability[] {
  const capabilities: TerritorialPortCapability[] = ['general_cargo'];
  if (entry.roles.includes('bulk_export')) capabilities.push('solid_bulk');
  if (entry.roles.includes('hydrocarbon')) capabilities.push('liquid_hydrocarbons');
  if (passengerPorts.has(entry.id)) capabilities.push('passengers_ferries');
  const override = majorPortOverrides[entry.id]?.capabilities;
  return [...new Set(override ?? capabilities)];
}

function profileForEntry(entry: AmericasPortEntry): TerritorialPortProfile {
  const defaults = countryDefaults[entry.countryId] ?? { nationalReach: 5, governanceRisk: 5, laborFriction: 3, developmentPotential: 3 };
  const gatewayBoost = entry.roles.includes('container_gateway') || entry.roles.includes('transshipment') ? 2 : 0;
  const resourceBoost = entry.roles.includes('bulk_export') || entry.roles.includes('hydrocarbon') ? 1 : 0;
  const riverPenalty = entry.roles.includes('riverine') ? 1 : 0;
  const goodsCapacity = clamp(3 + gatewayBoost + resourceBoost - riverPenalty, 1, 8);
  const infrastructureCapacity = clamp(goodsCapacity + (defaults.developmentPotential > 2 ? 2 : 1), goodsCapacity, 10);
  const nationalReach = clamp(defaults.nationalReach + (entry.roles.includes('canal') ? 1 : 0), 0, 10);
  const base: TerritorialPortProfile = {
    classification: portClassFor(goodsCapacity, nationalReach),
    goodsCapacity,
    infrastructureCapacity,
    nationalReach,
    governanceRisk: defaults.governanceRisk,
    laborFriction: defaults.laborFriction,
    capabilities: portCapabilities(entry),
    developmentPotential: defaults.developmentPotential,
    operationalState: 'operating',
  };
  const override = majorPortOverrides[entry.id];
  const profile = { ...base, ...override, capabilities: override?.capabilities ?? base.capabilities };
  return { ...profile, classification: portClassFor(profile.goodsCapacity, profile.nationalReach) };
}

/** Profil exposé pour les générateurs de données et les tests de scénario. */
export function portProfileForEntry(entry: AmericasPortEntry) {
  return profileForEntry(entry);
}

/** Capacité de marchandises réellement exploitable ce mois-ci. */
export function effectivePortGoodsCapacity(profile: TerritorialPortProfile): number {
  const stateFactor: Record<TerritorialPortOperationalState, number> = {
    operating: 1, congested: 0.65, damaged: 0.35, blockaded: 0, closed: 0,
  };
  const governanceFactor = 1 - profile.governanceRisk * 0.025;
  const laborFactor = 1 - profile.laborFriction * 0.04;
  const reachFactor = 0.6 + profile.nationalReach * 0.04;
  const value = profile.goodsCapacity * stateFactor[profile.operationalState] * governanceFactor * laborFactor * reachFactor;
  return Number(clamp(value, 0, profile.infrastructureCapacity).toFixed(2));
}

const p = (
  id: string, countryId: string, name: string, territorySuffix: string,
  lon: number, lat: number, roles: TerritorialAssetRole[], note: string,
): AmericasPortEntry => ({ id, countryId, name, territorySuffix, anchor: [lon, lat], roles, note });

const gateway = ['container_gateway'] as TerritorialAssetRole[];
const multi = ['multi_purpose'] as TerritorialAssetRole[];
const energy = ['hydrocarbon', 'bulk_export'] as TerritorialAssetRole[];
const river = ['riverine', 'bulk_export'] as TerritorialAssetRole[];

/** Nœuds majeurs retenus pour le jeu au 1er janvier 2000. */
export const americasMajorPorts: AmericasPortEntry[] = [
  // Amérique du Nord
  p('los-angeles-long-beach', 'USA', 'Complexe portuaire Los Angeles–Long Beach', 'pacific', -118.25, 33.73, [...gateway, 'transshipment'], 'Façade pacifique et porte des échanges avec l’Asie.'),
  p('new-york-new-jersey', 'USA', 'Port de New York–New Jersey', 'northeast', -74.10, 40.67, gateway, 'Grand débouché atlantique et centre de distribution de la côte Est.'),
  p('houston', 'USA', 'Port de Houston', 'south-gulf', -95.27, 29.73, energy, 'Nœud pétrochimique et énergétique du golfe du Mexique.'),
  p('savannah', 'USA', 'Port de Savannah', 'south-gulf', -81.10, 32.08, gateway, 'Porte conteneurisée de la façade sud-est.'),
  p('norfolk', 'USA', 'Port de Hampton Roads–Norfolk', 'northeast', -76.30, 36.85, ['naval', 'bulk_export'], 'Nœud naval et charbonnier de la côte atlantique.'),
  p('vancouver', 'CAN', 'Port de Vancouver', 'pacific', -123.12, 49.29, [...gateway, 'bulk_export'], 'Porte pacifique et exportations de vrac de l’Ouest canadien.'),
  p('montreal', 'CAN', 'Port de Montréal', 'quebec', -73.53, 45.50, [...gateway, 'riverine'], 'Port d’accès au Saint-Laurent et à l’hinterland des Grands Lacs.'),
  p('halifax', 'CAN', 'Port de Halifax', 'atlantic-north', -63.57, 44.65, [...gateway, 'naval'], 'Port atlantique en eaux profondes et appui naval.'),
  p('prince-rupert', 'CAN', 'Port de Prince Rupert', 'pacific', -130.32, 54.31, gateway, 'Porte pacifique nord-américaine à forte profondeur.'),
  p('manzanillo-mexico', 'MEX', 'Port de Manzanillo', 'west-bajio', -104.32, 19.05, [...gateway, 'transshipment'], 'Principal relais pacifique du Mexique.'),
  p('lazaro-cardenas', 'MEX', 'Port de Lázaro Cárdenas', 'west-bajio', -102.19, 17.93, [...gateway, 'bulk_export'], 'Port industriel et minéral de la façade pacifique.'),
  p('veracruz', 'MEX', 'Port de Veracruz', 'gulf-southeast', -96.14, 19.20, gateway, 'Porte atlantique historique vers le centre du pays.'),
  p('altamira', 'MEX', 'Port d’Altamira', 'gulf-southeast', -97.87, 22.48, [...gateway, 'bulk_export'], 'Complexe industriel et énergétique du golfe.'),
  p('progreso', 'MEX', 'Port de Progreso', 'gulf-southeast', -89.66, 21.28, multi, 'Desserte du Yucatán et des flux régionaux caraïbes.'),

  // Amérique centrale
  p('puerto-quetzal', 'GTM', 'Port de Puerto Quetzal', 'pacific-highlands', -90.79, 13.92, [...gateway, 'bulk_export'], 'Porte pacifique, sucre et vracs agricoles.'),
  p('santo-tomas-castilla', 'GTM', 'Port de Santo Tomás de Castilla', 'caribbean-petén', -88.62, 15.69, gateway, 'Porte caraïbe et débouché de l’Atlantique centraméricain.'),
  p('belize-city', 'BLZ', 'Port de Belize City', 'belize-city', -88.19, 17.50, multi, 'Principal point d’entrée maritime du Belize.'),
  p('big-creek', 'BLZ', 'Port de Big Creek', 'south', -88.40, 16.52, ['bulk_export'], 'Exportations agricoles et desserte du sud du pays.'),
  p('puerto-cortes', 'HND', 'Port de Puerto Cortés', 'north-coast', -87.95, 15.84, [...gateway, 'bulk_export'], 'Principal hub conteneurisé de la côte caraïbe.'),
  p('san-lorenzo-honduras', 'HND', 'Port de San Lorenzo', 'pacific-east', -87.45, 13.42, ['bulk_export'], 'Accès hondurien au golfe de Fonseca.'),
  p('acajutla', 'SLV', 'Port d’Acajutla', 'west-pacific', -89.83, 13.59, [...gateway, 'bulk_export'], 'Principal port commercial et énergétique du Salvador.'),
  p('la-union', 'SLV', 'Port de La Unión', 'east-highlands', -87.88, 13.33, multi, 'Nœud régional du golfe de Fonseca.'),
  p('corinto', 'NIC', 'Port de Corinto', 'pacific-west', -87.17, 12.48, [...gateway, 'bulk_export'], 'Principal port pacifique du Nicaragua.'),
  p('bluefields', 'NIC', 'Port de Bluefields', 'caribbean-east', -83.76, 12.01, multi, 'Accès fluvial et caraïbe de la côte orientale.'),
  p('moin-limon', 'CRI', 'Complexe portuaire Limón–Moín', 'caribbean-south', -83.04, 10.00, [...gateway, 'bulk_export'], 'Porte caraïbe des exportations et importations costariciennes.'),
  p('caldera', 'CRI', 'Port de Caldera', 'pacific', -84.72, 9.91, gateway, 'Principal débouché pacifique du Costa Rica.'),
  p('balboa', 'PAN', 'Port de Balboa', 'canal-capital', -79.57, 8.96, [...gateway, 'canal', 'transshipment'], 'Terminal pacifique du canal interocéanique.'),
  p('cristobal', 'PAN', 'Port de Cristóbal', 'caribbean', -79.92, 9.36, [...gateway, 'canal', 'transshipment'], 'Terminal atlantique du canal interocéanique.'),
  p('manzanillo-panama', 'PAN', 'Manzanillo International Terminal', 'caribbean', -79.88, 9.36, [...gateway, 'transshipment'], 'Plateforme de transbordement caraïbe associée au canal.'),

  // Caraïbes
  p('mariel', 'CUB', 'Port de Mariel', 'havana-west', -82.75, 23.01, [...gateway, 'naval'], 'Port en eau profonde et nœud industriel de l’ouest cubain.'),
  p('havana', 'CUB', 'Port de La Havane', 'havana-west', -82.37, 23.14, multi, 'Port-capitale et point d’entrée des flux nationaux.'),
  p('cienfuegos', 'CUB', 'Port de Cienfuegos', 'central', -80.45, 22.15, energy, 'Port industriel et énergétique de la côte sud.'),
  p('port-au-prince', 'HTI', 'Port-au-Prince', 'port-au-prince', -72.34, 18.54, multi, 'Principal point d’entrée des approvisionnements haïtiens.'),
  p('cap-haitien', 'HTI', 'Port du Cap-Haïtien', 'north', -72.20, 19.76, multi, 'Porte septentrionale et relais régional.'),
  p('caucedo', 'DOM', 'Port de Caucedo', 'santo-domingo', -69.63, 18.42, [...gateway, 'transshipment'], 'Hub conteneurisé et zone logistique de la République dominicaine.'),
  p('rio-haina', 'DOM', 'Port de Río Haina', 'santo-domingo', -70.03, 18.43, multi, 'Port commercial de l’aire de Saint-Domingue.'),
  p('puerto-plata', 'DOM', 'Port de Puerto Plata', 'cibao', -70.69, 19.80, multi, 'Desserte du nord et flux touristiques.'),
  p('kingston', 'JAM', 'Port de Kingston', 'kingston', -76.80, 17.98, [...gateway, 'transshipment', 'naval'], 'Grand hub de transbordement caribéen et port de la capitale.'),
  p('montego-bay', 'JAM', 'Port de Montego Bay', 'north-coast', -77.92, 18.47, multi, 'Desserte du nord-ouest et trafic touristique.'),
  p('freeport', 'BHS', 'Port de Freeport', 'grand-bahama', -78.70, 26.53, [...gateway, 'transshipment'], 'Hub de transbordement et zone franche des Bahamas.'),
  p('nassau', 'BHS', 'Port de Nassau', 'new-providence', -77.34, 25.08, multi, 'Port-capitale et accès aux archipels.'),
  p('bridgetown', 'BRB', 'Port de Bridgetown', 'bridgetown', -59.62, 13.10, [...gateway, 'transshipment'], 'Port principal de la Barbade et relais de croisière/cargo.'),
  p('point-lisas', 'TTO', 'Port de Point Lisas', 'trinidad', -61.47, 10.40, [...energy, 'bulk_export'], 'Complexe industriel, gazier et sidérurgique.'),
  p('port-of-spain', 'TTO', 'Port of Spain', 'trinidad', -61.52, 10.66, [...gateway, 'naval'], 'Port-capitale et centre de distribution régional.'),
  p('st-johns', 'ATG', 'Port de Saint John’s', 'antigua', -61.85, 17.12, multi, 'Port principal de l’île et relais régional.'),
  p('roseau', 'DMA', 'Port de Roseau', 'roseau', -61.39, 15.30, multi, 'Port-capitale de la Dominique.'),
  p('st-georges', 'GRD', 'Port de Saint-Georges', 'st-georges', -61.75, 12.05, multi, 'Port principal de la Grenade.'),
  p('basseterre', 'KNA', 'Port de Basseterre', 'st-kitts', -62.72, 17.30, multi, 'Port principal de Saint-Christophe-et-Niévès.'),
  p('castries', 'LCA', 'Port de Castries', 'castries', -60.99, 14.01, [...gateway, 'naval'], 'Port-capitale et abri naturel des Petites Antilles.'),
  p('vieux-fort', 'LCA', 'Port de Vieux Fort', 'south-east', -60.95, 13.73, multi, 'Desserte méridionale et aéroportuaire de Sainte-Lucie.'),
  p('kingstown', 'VCT', 'Port de Kingstown', 'st-vincent', -61.22, 13.15, multi, 'Port-capitale et point d’entrée de l’archipel.'),

  // Amérique du Sud
  p('santos', 'BRA', 'Port de Santos', 'southeast', -46.31, -23.95, [...gateway, 'bulk_export'], 'Premier grand hub maritime brésilien et porte du Sud-Est industriel.'),
  p('paranagua', 'BRA', 'Port de Paranaguá', 'south', -48.51, -25.52, [...gateway, 'bulk_export'], 'Exportations agricoles et vracs du Sud.'),
  p('rio-itaguai', 'BRA', 'Complexe Rio de Janeiro–Itaguaí', 'southeast', -43.78, -22.92, [...energy, 'bulk_export'], 'Nœud industriel, minerai et énergie du Sud-Est.'),
  p('itaqui', 'BRA', 'Port d’Itaqui', 'northeast', -44.37, -2.58, ['bulk_export', 'hydrocarbon'], 'Grand terminal de vrac et porte du corridor minier du Nord-Est.'),
  p('suape', 'BRA', 'Port de Suape', 'northeast', -34.93, -8.40, [...gateway, 'hydrocarbon'], 'Complexe industriel et pétrochimique du Nord-Est.'),
  p('manaus', 'BRA', 'Port fluvial de Manaus', 'north-amazon', -60.02, -3.14, river, 'Nœud fluvial de l’Amazonie et de la zone industrielle.'),
  p('buenos-aires', 'ARG', 'Port de Buenos Aires', 'pampas', -58.37, -34.60, [...gateway, 'riverine'], 'Porte de la capitale et du bassin du Río de la Plata.'),
  p('rosario', 'ARG', 'Port fluvial de Rosario', 'pampas', -60.64, -32.95, [...river, 'bulk_export'], 'Corridor fluvial des exportations agricoles.'),
  p('bahia-blanca', 'ARG', 'Port de Bahía Blanca', 'patagonia', -62.27, -38.72, [...energy, 'bulk_export'], 'Port en eau profonde, céréales et hydrocarbures.'),
  p('mar-del-plata', 'ARG', 'Port de Mar del Plata', 'pampas', -57.53, -38.00, multi, 'Pêche, cabotage et façade atlantique.'),
  p('san-antonio', 'CHL', 'Port de San Antonio', 'central', -71.62, -33.59, [...gateway, 'bulk_export'], 'Principal hub conteneurisé de la façade centrale.'),
  p('valparaiso', 'CHL', 'Port de Valparaíso', 'central', -71.63, -33.04, [...gateway, 'naval'], 'Port historique, commercial et naval.'),
  p('san-vicente', 'CHL', 'Complexe Talcahuano–San Vicente', 'south', -73.13, -36.73, ['bulk_export', 'naval'], 'Nœud industriel, sidérurgique et naval du Sud.'),
  p('mejillones', 'CHL', 'Port de Mejillones', 'north-mining', -70.45, -23.10, ['bulk_export', 'hydrocarbon'], 'Porte des minerais et de l’énergie du Nord minier.'),
  p('cartagena-colombia', 'COL', 'Port de Carthagène', 'caribbean', -75.53, 10.40, [...gateway, 'transshipment'], 'Hub caribéen et porte industrielle de la Colombie.'),
  p('buenaventura', 'COL', 'Port de Buenaventura', 'pacific-west', -77.02, 3.88, [...gateway, 'transshipment'], 'Principal accès colombien au Pacifique.'),
  p('barranquilla', 'COL', 'Port de Barranquilla', 'caribbean', -74.78, 10.97, [...river, 'bulk_export'], 'Port fluvio-maritime sur le Magdalena.'),
  p('covenas', 'COL', 'Terminal de Coveñas', 'caribbean', -75.69, 9.40, energy, 'Terminal d’exportation d’hydrocarbures.'),
  p('callao', 'PER', 'Port de Callao', 'lima-coast', -77.15, -12.05, [...gateway, 'naval'], 'Porte principale du Pérou et port de la capitale.'),
  p('paita', 'PER', 'Port de Paita', 'north-coast', -81.11, -5.09, [...gateway, 'bulk_export'], 'Desserte du nord et exportations agroalimentaires.'),
  p('matarani', 'PER', 'Port de Matarani', 'andes', -72.10, -17.00, ['bulk_export', 'naval'], 'Porte du sud minier et andin.'),
  p('guayaquil', 'ECU', 'Port de Guayaquil', 'guayaquil-coast', -79.90, -2.20, [...gateway, 'riverine'], 'Principal port commercial de l’Équateur.'),
  p('manta', 'ECU', 'Port de Manta', 'guayaquil-coast', -80.73, -0.95, [...gateway, 'naval'], 'Port en eau profonde et façade pacifique centrale.'),
  p('esmeraldas', 'ECU', 'Port d’Esmeraldas', 'guayaquil-coast', -79.65, 0.97, energy, 'Terminal pétrolier et port du Nord.'),
  p('puerto-cabello', 'VEN', 'Port de Puerto Cabello', 'caracas-coast', -68.01, 10.47, [...gateway, 'naval'], 'Principal port commercial et naval du Venezuela.'),
  p('la-guaira', 'VEN', 'Port de La Guaira', 'caracas-coast', -66.93, 10.60, multi, 'Port de la capitale et des importations.'),
  p('maracaibo', 'VEN', 'Port de Maracaibo', 'maracaibo', -71.60, 10.65, [...energy, 'riverine'], 'Nœud du bassin pétrolier occidental.'),
  p('jose-venezuela', 'VEN', 'Terminal de José', 'llanos', -64.68, 10.18, energy, 'Grand terminal pétrolier de la façade orientale.'),
  p('georgetown', 'GUY', 'Port de Georgetown', 'georgetown', -58.16, 6.80, [...river, 'multi_purpose'], 'Principal port fluvial et maritime du Guyana.'),
  p('paramaribo', 'SUR', 'Port de Paramaribo', 'paramaribo', -55.17, 5.83, [...river, 'multi_purpose'], 'Port fluvial et point d’entrée du Suriname.'),
  p('montevideo', 'URY', 'Port de Montevideo', 'montevideo', -56.18, -34.90, [...gateway, 'riverine'], 'Hub du Río de la Plata et port-capitale.'),
  p('nueva-palmira', 'URY', 'Port de Nueva Palmira', 'litoral', -58.42, -33.88, [...river, 'bulk_export'], 'Terminal fluvial des exportations du bassin du Paraná.'),
  p('asuncion', 'PRY', 'Port fluvial d’Asunción', 'asuncion', -57.63, -25.28, river, 'Accès fluvial du Paraguay au système Paraná–Paraguay.'),
  p('villeta', 'PRY', 'Port fluvial de Villeta', 'paraguay-east', -57.55, -25.50, [...river, 'bulk_export'], 'Plateforme fluviale et industrielle paraguayenne.'),
  p('puerto-quijarro', 'BOL', 'Puerto Quijarro–Canal Tamengo', 'lowlands', -58.17, -17.78, river, 'Accès fluvial bolivien au Paraguay–Paraná ; aucun littoral national.'),
];

/** Créé à l’initialisation, sans double compte économique ni capacité énergétique. */
export function addAmericasMajorPorts(state: TerritorialState): TerritorialState {
  const assets = { ...state.assets };
  for (const entry of americasMajorPorts) {
    if (!state.entities[entry.countryId]) continue;
    const regionalCandidates = [
      `${entry.countryId}:${entry.territorySuffix}`,
      `${entry.countryId}:macro-${entry.territorySuffix}`,
    ];
    const territoryId = regionalCandidates.find((id) => state.territories[id])
      ?? `${entry.countryId}:aggregate`;
    if (!state.territories[territoryId]) continue;
    const existing = assets[`asset:${entry.countryId}:${entry.id}`];
    if (existing) {
      // Migration douce des sauvegardes qui contiennent déjà le catalogue
      // historique sans le nouveau profil de capacité.
      if (existing.kind === 'port' && !existing.portProfile) assets[existing.id] = { ...existing, portProfile: profileForEntry(entry) };
      continue;
    }
    const asset: TerritorialAsset = {
      id: `asset:${entry.countryId}:${entry.id}`,
      name: entry.name,
      territoryId,
      kind: 'port',
      ownerEntityId: entry.countryId,
      operatorEntityId: null,
      anchor: entry.anchor,
      status: 'operating',
      capacity: null,
      portProfile: profileForEntry(entry),
      integration: 'inventory_only',
      sourceIds: ['unctad-lsci', 'world-bank-major-ports'],
      note: `Inventaire portuaire majeur de État-Nation. ${entry.note} La capacité disponible et l'état opérationnel peuvent évoluer ; le profil ne remplace pas le registre énergétique.`,
    };
    assets[asset.id] = asset;
  }
  return { ...state, assets };
}

export function americasPortsForCountry(state: TerritorialState, countryId: string) {
  return Object.values(state.assets)
    .filter((asset) => asset.kind === 'port' && state.territories[asset.territoryId]?.sovereignCountryId === countryId)
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}

/** Agrégat moteur : capacité portuaire de marchandises actuellement exploitable. */
export function portOperationalCapacityForCountry(state: TerritorialState, countryId: string) {
  return Number(americasPortsForCountry(state, countryId)
    .reduce((sum, asset) => sum + (asset.portProfile ? effectivePortGoodsCapacity(asset.portProfile) : 0), 0)
    .toFixed(2));
}
