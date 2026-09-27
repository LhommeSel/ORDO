import type {
  TerritorialAsset,
  TerritorialPortCapability,
  TerritorialPortClass,
  TerritorialPortProfile,
  TerritorialState,
} from './territory-types';
import { effectivePortGoodsCapacity } from './territory-data-americas-ports';

/**
 * Complément portuaire européen. Les ports déjà présents dans les fiches
 * européennes reçoivent le même profil que ceux de ce catalogue ; cette liste
 * ajoute seulement les façades et grands ports fluviaux encore absents.
 */
export type EuropePortEntry = {
  id: string;
  countryId: string;
  name: string;
  territorySuffix: string;
  anchor: [number, number];
  note: string;
  goodsCapacity?: number;
  infrastructureCapacity?: number;
  nationalReach?: number;
  governanceRisk?: number;
  laborFriction?: number;
  developmentPotential?: number;
  capabilities?: TerritorialPortCapability[];
};

const p = (id: string, countryId: string, name: string, territorySuffix: string, lon: number, lat: number, note: string, overrides: Omit<EuropePortEntry, 'id' | 'countryId' | 'name' | 'territorySuffix' | 'anchor' | 'note'> = {}): EuropePortEntry => ({
  id, countryId, name, territorySuffix, anchor: [lon, lat], note, ...overrides,
});

/** Ports maritimes ou fluviaux structurants manquants du premier catalogue. */
export const europeAdditionalMajorPorts: EuropePortEntry[] = [
  p('durres', 'ALB', 'Port de Durrës', 'macro-tirana', 19.45, 41.32, 'Principal débouché maritime de l’Albanie.'),
  p('baku', 'AZE', 'Port de Bakou–Alat', 'macro-baku', 49.95, 40.35, 'Nœud caspien et interface du corridor transcaspien.', { goodsCapacity: 6, infrastructureCapacity: 8, nationalReach: 7, governanceRisk: 6 }),
  p('varna', 'BGR', 'Port de Varna', 'macro-black-sea', 27.46, 43.2, 'Grand port bulgare de la mer Noire.', { goodsCapacity: 6, infrastructureCapacity: 8, nationalReach: 7 }),
  p('burgas', 'BGR', 'Port de Bourgas', 'macro-black-sea', 27.47, 42.5, 'Port pétrolier et commercial de la façade bulgare.', { goodsCapacity: 6, infrastructureCapacity: 8, nationalReach: 6, capabilities: ['general_cargo', 'solid_bulk', 'liquid_hydrocarbons'] }),
  p('limassol', 'CYP', 'Port de Limassol', 'macro-south-west', 33.0, 34.67, 'Principal port commercial de Chypre.', { goodsCapacity: 5, infrastructureCapacity: 7, nationalReach: 6 }),
  p('tallinn', 'EST', 'Port de Tallinn–Muuga', 'macro-tallinn', 24.75, 59.45, 'Porte baltique et plateforme de vrac.', { goodsCapacity: 6, infrastructureCapacity: 8, nationalReach: 7 }),
  p('poti', 'GEO', 'Port de Poti', 'macro-black-sea', 41.65, 42.15, 'Porte géorgienne de la mer Noire et du Caucase.', { goodsCapacity: 5, infrastructureCapacity: 7, nationalReach: 6 }),
  p('batumi', 'GEO', 'Port de Batoumi', 'macro-black-sea', 41.65, 41.65, 'Port de la façade sud-ouest et terminal énergétique.', { goodsCapacity: 5, infrastructureCapacity: 7, nationalReach: 5, capabilities: ['general_cargo', 'liquid_hydrocarbons', 'passengers_ferries'] }),
  p('rijeka', 'HRV', 'Port de Rijeka', 'macro-adriatic-north', 14.44, 45.33, 'Principal port en eau profonde de Croatie.', { goodsCapacity: 6, infrastructureCapacity: 8, nationalReach: 7 }),
  p('dublin', 'IRL', 'Port de Dublin', 'macro-dublin', -6.22, 53.35, 'Porte commerciale et passagers de l’Irlande.', { goodsCapacity: 6, infrastructureCapacity: 8, nationalReach: 8, capabilities: ['general_cargo', 'passengers_ferries'] }),
  p('cork', 'IRL', 'Port de Cork–Ringaskiddy', 'macro-south', -8.3, 51.85, 'Port industriel et énergétique du sud irlandais.', { goodsCapacity: 5, infrastructureCapacity: 7, nationalReach: 6, capabilities: ['general_cargo', 'liquid_hydrocarbons', 'passengers_ferries'] }),
  p('reykjavik', 'ISL', 'Port de Reykjavík', 'macro-capital', -21.95, 64.15, 'Port-capitale et principal nœud de ravitaillement islandais.', { goodsCapacity: 5, infrastructureCapacity: 7, nationalReach: 8, capabilities: ['general_cargo', 'passengers_ferries'] }),
  p('aktau', 'KAZ', 'Port d’Aktau', 'macro-caspian', 51.17, 43.65, 'Port caspien et exportations énergétiques du Kazakhstan.', { goodsCapacity: 5, infrastructureCapacity: 7, nationalReach: 5, capabilities: ['general_cargo', 'liquid_hydrocarbons'] }),
  p('klaipeda', 'LTU', 'Port de Klaipėda', 'macro-klaipeda', 21.12, 55.7, 'Principal port baltique de la Lituanie.', { goodsCapacity: 6, infrastructureCapacity: 8, nationalReach: 7 }),
  p('riga', 'LVA', 'Port de Riga', 'macro-riga', 24.1, 56.95, 'Port-capitale et plateforme de vrac de la Baltique.', { goodsCapacity: 6, infrastructureCapacity: 8, nationalReach: 7 }),
  p('ventspils', 'LVA', 'Port de Ventspils', 'macro-coast', 21.55, 57.4, 'Port d’exportation énergétique et de vrac.', { goodsCapacity: 5, infrastructureCapacity: 7, nationalReach: 5, capabilities: ['general_cargo', 'solid_bulk', 'liquid_hydrocarbons'] }),
  p('giurgiulesti', 'MDA', 'Port de Giurgiulești', 'macro-dniestr', 28.2, 45.48, 'Accès fluvial et maritime de la Moldavie au Danube.', { goodsCapacity: 3, infrastructureCapacity: 5, nationalReach: 5, governanceRisk: 6, developmentPotential: 4 }),
  p('monaco', 'MCO', 'Port de Monaco', 'macro-urban', 7.42, 43.73, 'Port urbain de la principauté, principalement passagers.', { goodsCapacity: 2, infrastructureCapacity: 4, nationalReach: 5, governanceRisk: 1, capabilities: ['general_cargo', 'passengers_ferries'] }),
  p('marsaxlokk', 'MLT', 'Port de Marsaxlokk', 'macro-grand-harbour', 14.55, 35.82, 'Grand terminal commercial et énergétique de Malte.', { goodsCapacity: 6, infrastructureCapacity: 8, nationalReach: 7, capabilities: ['general_cargo', 'liquid_hydrocarbons', 'passengers_ferries'] }),
  p('bar', 'MNE', 'Port de Bar', 'macro-coast', 19.1, 42.1, 'Principal port maritime du Monténégro.', { goodsCapacity: 4, infrastructureCapacity: 6, nationalReach: 5 }),
  p('koper', 'SVN', 'Port de Koper', 'macro-littoral', 13.73, 45.55, 'Porte adriatique de la Slovénie et de son hinterland industriel.', { goodsCapacity: 6, infrastructureCapacity: 8, nationalReach: 8 }),
  p('belgrade', 'SRB', 'Port fluvial de Belgrade', 'macro-belgrade', 20.45, 44.82, 'Nœud du Danube et de la Save.', { goodsCapacity: 4, infrastructureCapacity: 6, nationalReach: 7, capabilities: ['general_cargo', 'solid_bulk', 'passengers_ferries'] }),
  p('bratislava', 'SVK', 'Port fluvial de Bratislava', 'macro-bratislava', 17.12, 48.14, 'Nœud danubien et logistique de la Slovaquie.', { goodsCapacity: 4, infrastructureCapacity: 6, nationalReach: 7, capabilities: ['general_cargo', 'solid_bulk'] }),
  p('basel-rhine-port', 'CHE', 'Ports rhénans de Bâle', 'macro-basel', 7.59, 47.56, 'Port fluvial suisse relié aux corridors rhénans.', { goodsCapacity: 5, infrastructureCapacity: 7, nationalReach: 8, governanceRisk: 1, capabilities: ['general_cargo', 'solid_bulk'] }),
  p('budapest-danube', 'HUN', 'Port fluvial de Budapest', 'macro-budapest', 19.05, 47.5, 'Nœud danubien et distribution de la Hongrie.', { goodsCapacity: 4, infrastructureCapacity: 6, nationalReach: 7, capabilities: ['general_cargo', 'solid_bulk'] }),
  p('mertert', 'LUX', 'Port fluvial de Mertert', 'macro-south', 6.5, 49.7, 'Port mosellan du Luxembourg, raccordé au Rhin.', { goodsCapacity: 3, infrastructureCapacity: 5, nationalReach: 7, governanceRisk: 1, capabilities: ['general_cargo', 'solid_bulk'] }),
];

const countryDefaults: Record<string, Pick<TerritorialPortProfile, 'nationalReach' | 'governanceRisk' | 'laborFriction' | 'developmentPotential'>> = {
  AUT: { nationalReach: 7, governanceRisk: 1, laborFriction: 2, developmentPotential: 2 }, BEL: { nationalReach: 9, governanceRisk: 2, laborFriction: 2, developmentPotential: 1 }, CHE: { nationalReach: 8, governanceRisk: 1, laborFriction: 2, developmentPotential: 2 }, DEU: { nationalReach: 9, governanceRisk: 1, laborFriction: 2, developmentPotential: 1 }, DNK: { nationalReach: 8, governanceRisk: 1, laborFriction: 2, developmentPotential: 2 }, ESP: { nationalReach: 8, governanceRisk: 3, laborFriction: 3, developmentPotential: 2 }, FIN: { nationalReach: 7, governanceRisk: 1, laborFriction: 2, developmentPotential: 2 }, FRA: { nationalReach: 8, governanceRisk: 2, laborFriction: 3, developmentPotential: 2 }, GBR: { nationalReach: 9, governanceRisk: 1, laborFriction: 2, developmentPotential: 2 }, GRC: { nationalReach: 7, governanceRisk: 4, laborFriction: 3, developmentPotential: 3 }, HRV: { nationalReach: 6, governanceRisk: 4, laborFriction: 3, developmentPotential: 3 }, IRL: { nationalReach: 7, governanceRisk: 2, laborFriction: 2, developmentPotential: 2 }, ISL: { nationalReach: 6, governanceRisk: 1, laborFriction: 2, developmentPotential: 2 }, ITA: { nationalReach: 8, governanceRisk: 4, laborFriction: 3, developmentPotential: 2 }, NLD: { nationalReach: 10, governanceRisk: 1, laborFriction: 2, developmentPotential: 1 }, NOR: { nationalReach: 8, governanceRisk: 1, laborFriction: 2, developmentPotential: 2 }, POL: { nationalReach: 7, governanceRisk: 4, laborFriction: 3, developmentPotential: 3 }, PRT: { nationalReach: 7, governanceRisk: 3, laborFriction: 3, developmentPotential: 2 }, ROU: { nationalReach: 6, governanceRisk: 5, laborFriction: 3, developmentPotential: 3 }, RUS: { nationalReach: 6, governanceRisk: 6, laborFriction: 4, developmentPotential: 3 }, SWE: { nationalReach: 8, governanceRisk: 1, laborFriction: 2, developmentPotential: 2 }, TUR: { nationalReach: 7, governanceRisk: 6, laborFriction: 4, developmentPotential: 3 }, UKR: { nationalReach: 6, governanceRisk: 6, laborFriction: 4, developmentPotential: 3 }, ALB: { nationalReach: 5, governanceRisk: 6, laborFriction: 3, developmentPotential: 4 }, AZE: { nationalReach: 6, governanceRisk: 7, laborFriction: 4, developmentPotential: 3 }, BGR: { nationalReach: 6, governanceRisk: 5, laborFriction: 3, developmentPotential: 3 }, CYP: { nationalReach: 5, governanceRisk: 4, laborFriction: 3, developmentPotential: 3 }, EST: { nationalReach: 7, governanceRisk: 3, laborFriction: 2, developmentPotential: 2 }, GEO: { nationalReach: 5, governanceRisk: 6, laborFriction: 3, developmentPotential: 4 }, KAZ: { nationalReach: 5, governanceRisk: 6, laborFriction: 4, developmentPotential: 4 }, LTU: { nationalReach: 7, governanceRisk: 3, laborFriction: 2, developmentPotential: 2 }, LVA: { nationalReach: 7, governanceRisk: 3, laborFriction: 2, developmentPotential: 2 }, MDA: { nationalReach: 5, governanceRisk: 6, laborFriction: 4, developmentPotential: 4 }, MCO: { nationalReach: 5, governanceRisk: 1, laborFriction: 2, developmentPotential: 1 }, MLT: { nationalReach: 6, governanceRisk: 3, laborFriction: 2, developmentPotential: 2 }, MNE: { nationalReach: 5, governanceRisk: 5, laborFriction: 3, developmentPotential: 3 }, SRB: { nationalReach: 6, governanceRisk: 5, laborFriction: 3, developmentPotential: 3 }, SVK: { nationalReach: 7, governanceRisk: 3, laborFriction: 2, developmentPotential: 2 }, SVN: { nationalReach: 8, governanceRisk: 2, laborFriction: 2, developmentPotential: 2 }, HUN: { nationalReach: 7, governanceRisk: 3, laborFriction: 2, developmentPotential: 2 }, LUX: { nationalReach: 7, governanceRisk: 1, laborFriction: 2, developmentPotential: 1 },
};

const overrideByAssetId: Record<string, Partial<TerritorialPortProfile>> = {
  rotterdam: { goodsCapacity: 10, infrastructureCapacity: 10, nationalReach: 10, capabilities: ['general_cargo', 'solid_bulk', 'liquid_hydrocarbons', 'lng'] },
  antwerp: { goodsCapacity: 9, infrastructureCapacity: 10, nationalReach: 9, capabilities: ['general_cargo', 'solid_bulk', 'liquid_hydrocarbons'] },
  hamburg: { goodsCapacity: 9, infrastructureCapacity: 10, nationalReach: 9, capabilities: ['general_cargo', 'solid_bulk', 'liquid_hydrocarbons'] },
  bremerhaven: { goodsCapacity: 8, infrastructureCapacity: 9, nationalReach: 8 },
  felixstowe: { goodsCapacity: 8, infrastructureCapacity: 9, nationalReach: 9 },
  southampton: { goodsCapacity: 8, infrastructureCapacity: 9, nationalReach: 9 },
  'algeciras': { goodsCapacity: 8, infrastructureCapacity: 9, nationalReach: 8 },
  valencia: { goodsCapacity: 8, infrastructureCapacity: 9, nationalReach: 8 },
  barcelona: { goodsCapacity: 8, infrastructureCapacity: 9, nationalReach: 8 },
  marseille: { goodsCapacity: 8, infrastructureCapacity: 9, nationalReach: 8, capabilities: ['general_cargo', 'solid_bulk', 'liquid_hydrocarbons', 'lng'] },
  genoa: { goodsCapacity: 8, infrastructureCapacity: 9, nationalReach: 8 },
  'gioia-tauro': { goodsCapacity: 7, infrastructureCapacity: 8, nationalReach: 6 },
  piraeus: { goodsCapacity: 8, infrastructureCapacity: 9, nationalReach: 8 },
  gdansk: { goodsCapacity: 7, infrastructureCapacity: 8, nationalReach: 8, capabilities: ['general_cargo', 'solid_bulk', 'liquid_hydrocarbons'] },
  constanta: { goodsCapacity: 7, infrastructureCapacity: 8, nationalReach: 7 },
  'st-petersburg-port': { goodsCapacity: 8, infrastructureCapacity: 9, nationalReach: 8 },
  novorossiysk: { goodsCapacity: 8, infrastructureCapacity: 9, nationalReach: 7, capabilities: ['general_cargo', 'solid_bulk', 'liquid_hydrocarbons'] },
  'istanbul-port': { goodsCapacity: 8, infrastructureCapacity: 9, nationalReach: 8 },
  izmir: { goodsCapacity: 7, infrastructureCapacity: 8, nationalReach: 7 },
  odesa: { goodsCapacity: 7, infrastructureCapacity: 8, nationalReach: 7 },
  'dunkerque': { goodsCapacity: 7, infrastructureCapacity: 8, nationalReach: 8 },
  'le-havre': { goodsCapacity: 8, infrastructureCapacity: 9, nationalReach: 8, capabilities: ['general_cargo', 'solid_bulk', 'liquid_hydrocarbons'] },
  nantes: { goodsCapacity: 6, infrastructureCapacity: 8, nationalReach: 7 },
  bordeaux: { goodsCapacity: 6, infrastructureCapacity: 8, nationalReach: 7 },
};

const passengerPortIds = new Set([
  'southampton', 'dover', 'dublin', 'cork', 'reykjavik', 'helsinki-port', 'copenhagen-port', 'oslo-port', 'bergen-port',
  'stockholm-port', 'gothenburg', 'trelleborg', 'piraeus', 'genoa', 'venice', 'barcelona', 'lisbon-port', 'monaco', 'limassol',
]);

function classify(goodsCapacity: number, nationalReach: number): TerritorialPortClass {
  const score = goodsCapacity * 0.7 + nationalReach * 0.3;
  if (score >= 9.2) return 'megahub';
  if (score >= 7.6) return 'global_hub';
  if (score >= 6.2) return 'major';
  if (score >= 4.4) return 'national';
  if (score >= 2.5) return 'regional';
  return 'local';
}

function capabilitiesFor(asset: TerritorialAsset, entry?: EuropePortEntry): TerritorialPortCapability[] {
  if (entry?.capabilities) return [...new Set(entry.capabilities)];
  const value = `${asset.id} ${asset.name}`.toLocaleLowerCase('fr');
  const capabilities: TerritorialPortCapability[] = ['general_cargo'];
  if (/vrac|minerai|charbon|céréale|steel|sidér|bulk/.test(value)) capabilities.push('solid_bulk');
  if (/pétrol|petrol|hydrocarb|raffin|oil|énerg/.test(value)) capabilities.push('liquid_hydrocarbons');
  if (passengerPortIds.has(asset.id.split(':').at(-1) ?? '')) capabilities.push('passengers_ferries');
  return capabilities;
}

function profileFor(asset: TerritorialAsset, countryId: string, entry?: EuropePortEntry): TerritorialPortProfile {
  const defaults = countryDefaults[countryId] ?? { nationalReach: 6, governanceRisk: 4, laborFriction: 3, developmentPotential: 3 };
  const localId = entry?.id ?? asset.id.split(':').at(-1) ?? asset.id;
  const baseGoods = entry?.goodsCapacity ?? (asset.kind === 'port' ? 5 : 0);
  const baseInfrastructure = entry?.infrastructureCapacity ?? Math.min(10, baseGoods + (defaults.developmentPotential > 2 ? 2 : 1));
  const baseReach = entry?.nationalReach ?? defaults.nationalReach;
  const base: TerritorialPortProfile = {
    classification: classify(baseGoods, baseReach), goodsCapacity: baseGoods, infrastructureCapacity: Math.max(baseGoods, baseInfrastructure), nationalReach: baseReach,
    governanceRisk: entry?.governanceRisk ?? defaults.governanceRisk, laborFriction: entry?.laborFriction ?? defaults.laborFriction,
    capabilities: capabilitiesFor(asset, entry), developmentPotential: entry?.developmentPotential ?? defaults.developmentPotential, operationalState: 'operating',
  };
  const override = overrideByAssetId[localId];
  const merged = { ...base, ...override, capabilities: override?.capabilities ?? base.capabilities };
  return { ...merged, classification: classify(merged.goodsCapacity, merged.nationalReach) };
}

function territoryForEntry(state: TerritorialState, entry: EuropePortEntry) {
  const candidates = [`${entry.countryId}:${entry.territorySuffix}`, `${entry.countryId}:macro-${entry.territorySuffix}`, `${entry.countryId}:aggregate`];
  return candidates.find((id) => state.territories[id]);
}

/** Ajoute les ports absents et migre les ports européens existants vers le profil commun. */
export function addEuropeMajorPorts(state: TerritorialState): TerritorialState {
  const assets = { ...state.assets };
  for (const entry of europeAdditionalMajorPorts) {
    if (!state.entities[entry.countryId]) continue;
    const territoryId = territoryForEntry(state, entry);
    if (!territoryId) continue;
    const id = `asset:${entry.countryId}:${entry.id}`;
    if (!assets[id]) {
      assets[id] = {
        id, name: entry.name, territoryId, kind: 'port', ownerEntityId: entry.countryId, operatorEntityId: null, anchor: entry.anchor,
        status: 'operating', capacity: null, portProfile: profileFor({ id, name: entry.name, territoryId, kind: 'port', ownerEntityId: entry.countryId, operatorEntityId: null, anchor: entry.anchor, status: 'operating', capacity: null, integration: 'inventory_only', sourceIds: ['eurostat-major-ports', 'world-port-index'], note: entry.note }, entry.countryId, entry),
        integration: 'inventory_only', sourceIds: ['eurostat-major-ports', 'world-port-index'], note: `Inventaire portuaire majeur de État-Nation. ${entry.note} Profil de capacité abstrait et évolutif ; aucune production énergétique ajoutée.`,
      };
    }
  }
  for (const asset of Object.values(assets)) {
    const territory = state.territories[asset.territoryId];
    if (asset.kind !== 'port' || !territory || !countryDefaults[territory.sovereignCountryId]) continue;
    if (!asset.portProfile) assets[asset.id] = { ...asset, portProfile: profileFor(asset, territory.sovereignCountryId) };
  }
  return { ...state, assets };
}

export function europePortsForCountry(state: TerritorialState, countryId: string) {
  return Object.values(state.assets)
    .filter((asset) => asset.kind === 'port' && state.territories[asset.territoryId]?.sovereignCountryId === countryId)
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}

export function europePortOperationalCapacityForCountry(state: TerritorialState, countryId: string) {
  return Number(europePortsForCountry(state, countryId).reduce((sum, asset) => sum + (asset.portProfile ? effectivePortGoodsCapacity(asset.portProfile) : 0), 0).toFixed(2));
}
