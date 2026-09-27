import type {
  TerritorialPortCapability,
  TerritorialPortClass,
  TerritorialPortProfile,
  TerritorialState,
} from './territory-types';
import { effectivePortGoodsCapacity } from './territory-data-americas-ports';

/**
 * Catalogue réduit de l’Océanie. Les indices décrivent le scénario 2000 et
 * distinguent la capacité disponible du plafond d’infrastructure ; les
 * installations énergétiques restent dans le registre énergie.
 */
export type OceaniaPortEntry = {
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

const p = (
  id: string, countryId: string, name: string, territorySuffix: string,
  lon: number, lat: number, note: string,
  overrides: Omit<OceaniaPortEntry, 'id' | 'countryId' | 'name' | 'territorySuffix' | 'anchor' | 'note'> = {},
): OceaniaPortEntry => ({ id, countryId, name, territorySuffix, anchor: [lon, lat], note, ...overrides });

export const oceaniaMajorPorts: OceaniaPortEntry[] = [
  // Australie
  p('sydney-botany', 'AUS', 'Port Botany–Sydney', 'aggregate', 151.2, -33.95, 'Principal hub conteneurisé de la côte Est australienne.', { goodsCapacity: 8, infrastructureCapacity: 9, nationalReach: 9, governanceRisk: 1, laborFriction: 2, capabilities: ['general_cargo', 'liquid_hydrocarbons', 'passengers_ferries'] }),
  p('melbourne', 'AUS', 'Port de Melbourne', 'aggregate', 144.9, -37.84, 'Premier port commercial et industriel d’Australie.', { goodsCapacity: 8, infrastructureCapacity: 9, nationalReach: 9, governanceRisk: 1, laborFriction: 2 }),
  p('brisbane', 'AUS', 'Port de Brisbane', 'aggregate', 153.17, -27.37, 'Porte du Queensland et des flux du nord-est.', { goodsCapacity: 7, infrastructureCapacity: 8, nationalReach: 8, governanceRisk: 1, laborFriction: 2, capabilities: ['general_cargo', 'solid_bulk', 'liquid_hydrocarbons'] }),
  p('fremantle', 'AUS', 'Port de Fremantle–Perth', 'aggregate', 115.73, -32.05, 'Principal débouché de l’Australie-Occidentale.', { goodsCapacity: 7, infrastructureCapacity: 8, nationalReach: 7, governanceRisk: 1, laborFriction: 2, capabilities: ['general_cargo', 'solid_bulk', 'passengers_ferries'] }),
  p('port-hedland', 'AUS', 'Port Hedland', 'aggregate', 118.58, -20.31, 'Grand terminal d’exportation de minerai de fer.', { goodsCapacity: 7, infrastructureCapacity: 9, nationalReach: 6, governanceRisk: 1, laborFriction: 2, capabilities: ['general_cargo', 'solid_bulk'] }),
  p('newcastle-aus', 'AUS', 'Port de Newcastle', 'aggregate', 151.78, -32.93, 'Premier port charbonnier et vrac de Nouvelle-Galles du Sud.', { goodsCapacity: 7, infrastructureCapacity: 8, nationalReach: 7, governanceRisk: 1, laborFriction: 2, capabilities: ['general_cargo', 'solid_bulk'] }),
  p('gladstone', 'AUS', 'Port de Gladstone', 'aggregate', 151.27, -23.84, 'Port industriel, charbonnier et énergétique du Queensland.', { goodsCapacity: 6, infrastructureCapacity: 8, nationalReach: 6, governanceRisk: 1, laborFriction: 2, capabilities: ['general_cargo', 'solid_bulk', 'liquid_hydrocarbons'] }),

  // Nouvelle-Zélande
  p('auckland', 'NZL', 'Ports d’Auckland', 'aggregate', 174.77, -36.84, 'Principal port commercial et passagers de Nouvelle-Zélande.', { goodsCapacity: 6, infrastructureCapacity: 8, nationalReach: 8, governanceRisk: 1, laborFriction: 2, capabilities: ['general_cargo', 'passengers_ferries'] }),
  p('tauranga', 'NZL', 'Port de Tauranga', 'aggregate', 176.2, -37.65, 'Porte d’exportation agricole et forestière de l’île du Nord.', { goodsCapacity: 6, infrastructureCapacity: 8, nationalReach: 7, governanceRisk: 1, laborFriction: 2, capabilities: ['general_cargo', 'solid_bulk'] }),
  p('lyttelton', 'NZL', 'Port de Lyttelton–Christchurch', 'aggregate', 172.72, -43.6, 'Principal port de l’île du Sud.', { goodsCapacity: 5, infrastructureCapacity: 7, nationalReach: 6, governanceRisk: 1, laborFriction: 2, capabilities: ['general_cargo', 'solid_bulk'] }),
  p('wellington', 'NZL', 'Port de Wellington', 'aggregate', 174.78, -41.28, 'Port-capitale et liaison interinsulaire.', { goodsCapacity: 5, infrastructureCapacity: 7, nationalReach: 7, governanceRisk: 1, laborFriction: 2, capabilities: ['general_cargo', 'passengers_ferries'] }),
  p('napier', 'NZL', 'Port de Napier', 'aggregate', 176.92, -39.48, 'Port régional agricole et forestier de Hawke’s Bay.', { goodsCapacity: 4, infrastructureCapacity: 6, nationalReach: 5, governanceRisk: 1, laborFriction: 2, capabilities: ['general_cargo', 'solid_bulk'] }),

  // États insulaires du Pacifique
  p('suva', 'FJI', 'Port de Suva', 'aggregate', 178.44, -18.14, 'Principal port commercial et institutionnel des Fidji.', { goodsCapacity: 4, infrastructureCapacity: 6, nationalReach: 5, governanceRisk: 3, laborFriction: 3, developmentPotential: 3, capabilities: ['general_cargo', 'passengers_ferries'] }),
  p('lautoka', 'FJI', 'Port de Lautoka', 'aggregate', 177.45, -17.62, 'Port sucrier et industriel de Viti Levu.', { goodsCapacity: 3, infrastructureCapacity: 5, nationalReach: 4, governanceRisk: 3, laborFriction: 3, capabilities: ['general_cargo', 'solid_bulk'] }),
  p('pohnpei', 'FSM', 'Port de Pohnpei', 'aggregate', 158.21, 6.97, 'Port-capitale et relais régional de Micronésie.', { goodsCapacity: 2, infrastructureCapacity: 4, nationalReach: 3, governanceRisk: 3, laborFriction: 2, developmentPotential: 4, capabilities: ['general_cargo', 'passengers_ferries'] }),
  p('majuro', 'MHL', 'Port de Majuro', 'aggregate', 171.38, 7.09, 'Port-capitale et approvisionnement de l’archipel.', { goodsCapacity: 2, infrastructureCapacity: 4, nationalReach: 3, governanceRisk: 3, laborFriction: 2, developmentPotential: 4, capabilities: ['general_cargo', 'passengers_ferries'] }),
  p('betio', 'KIR', 'Port de Betio–Tarawa', 'aggregate', 172.93, 1.36, 'Principal quai commercial des Kiribati.', { goodsCapacity: 2, infrastructureCapacity: 4, nationalReach: 3, governanceRisk: 4, laborFriction: 2, developmentPotential: 4, capabilities: ['general_cargo', 'passengers_ferries'] }),
  p('aiwo', 'NRU', 'Port d’Aiwo', 'aggregate', 166.91, -0.52, 'Ancien terminal de phosphate et accès principal de Nauru.', { goodsCapacity: 2, infrastructureCapacity: 4, nationalReach: 2, governanceRisk: 4, laborFriction: 3, developmentPotential: 4, capabilities: ['general_cargo', 'solid_bulk'] }),
  p('malakal', 'PLW', 'Port de Malakal', 'aggregate', 134.46, 7.34, 'Port commercial et touristique de Palaos.', { goodsCapacity: 2, infrastructureCapacity: 4, nationalReach: 3, governanceRisk: 2, laborFriction: 2, developmentPotential: 3, capabilities: ['general_cargo', 'passengers_ferries'] }),
  p('honiara', 'SLB', 'Port de Honiara', 'aggregate', 159.95, -9.43, 'Port-capitale et principal point d’entrée des Salomon.', { goodsCapacity: 2, infrastructureCapacity: 4, nationalReach: 3, governanceRisk: 5, laborFriction: 3, developmentPotential: 4, capabilities: ['general_cargo', 'passengers_ferries'] }),
  p('nukualofa', 'TON', 'Port de Nuku’alofa', 'aggregate', -175.2, -21.14, 'Port-capitale et liaisons interinsulaires des Tonga.', { goodsCapacity: 2, infrastructureCapacity: 4, nationalReach: 3, governanceRisk: 3, laborFriction: 2, developmentPotential: 4, capabilities: ['general_cargo', 'passengers_ferries'] }),
  p('funafuti', 'TUV', 'Port de Funafuti', 'aggregate', 179.2, -8.52, 'Unique porte d’approvisionnement de Tuvalu.', { goodsCapacity: 1, infrastructureCapacity: 3, nationalReach: 2, governanceRisk: 3, laborFriction: 2, developmentPotential: 5, capabilities: ['general_cargo', 'passengers_ferries'] }),
  p('port-vila', 'VUT', 'Port Vila', 'aggregate', 168.32, -17.73, 'Port-capitale et plateforme touristique du Vanuatu.', { goodsCapacity: 3, infrastructureCapacity: 5, nationalReach: 4, governanceRisk: 4, laborFriction: 3, developmentPotential: 3, capabilities: ['general_cargo', 'passengers_ferries'] }),
  p('luganville', 'VUT', 'Port de Luganville', 'aggregate', 167.17, -15.51, 'Port régional et débouché de Santo.', { goodsCapacity: 2, infrastructureCapacity: 4, nationalReach: 3, governanceRisk: 4, laborFriction: 3, developmentPotential: 4, capabilities: ['general_cargo', 'passengers_ferries'] }),
  p('apia', 'WSM', 'Port d’Apia', 'aggregate', -171.75, -13.83, 'Port-capitale et principal relais des Samoa.', { goodsCapacity: 3, infrastructureCapacity: 5, nationalReach: 4, governanceRisk: 2, laborFriction: 2, developmentPotential: 3, capabilities: ['general_cargo', 'passengers_ferries'] }),
];

const countryDefaults: Record<string, Pick<TerritorialPortProfile, 'nationalReach' | 'governanceRisk' | 'laborFriction' | 'developmentPotential'>> = {
  AUS: { nationalReach: 9, governanceRisk: 1, laborFriction: 2, developmentPotential: 2 }, FJI: { nationalReach: 5, governanceRisk: 3, laborFriction: 3, developmentPotential: 3 },
  FSM: { nationalReach: 3, governanceRisk: 3, laborFriction: 2, developmentPotential: 4 }, KIR: { nationalReach: 3, governanceRisk: 4, laborFriction: 2, developmentPotential: 4 },
  MHL: { nationalReach: 3, governanceRisk: 3, laborFriction: 2, developmentPotential: 4 }, NRU: { nationalReach: 2, governanceRisk: 4, laborFriction: 3, developmentPotential: 4 },
  NZL: { nationalReach: 8, governanceRisk: 1, laborFriction: 2, developmentPotential: 2 }, PLW: { nationalReach: 3, governanceRisk: 2, laborFriction: 2, developmentPotential: 3 },
  SLB: { nationalReach: 3, governanceRisk: 5, laborFriction: 3, developmentPotential: 4 }, TON: { nationalReach: 3, governanceRisk: 3, laborFriction: 2, developmentPotential: 4 },
  TUV: { nationalReach: 2, governanceRisk: 3, laborFriction: 2, developmentPotential: 5 }, VUT: { nationalReach: 4, governanceRisk: 4, laborFriction: 3, developmentPotential: 3 },
  WSM: { nationalReach: 4, governanceRisk: 2, laborFriction: 2, developmentPotential: 3 },
};

function classify(goodsCapacity: number, nationalReach: number): TerritorialPortClass {
  const score = goodsCapacity * 0.7 + nationalReach * 0.3;
  if (score >= 9.2) return 'megahub';
  if (score >= 7.6) return 'global_hub';
  if (score >= 6.2) return 'major';
  if (score >= 4.4) return 'national';
  if (score >= 2.5) return 'regional';
  return 'local';
}

function profileFor(entry: OceaniaPortEntry): TerritorialPortProfile {
  const defaults = countryDefaults[entry.countryId] ?? { nationalReach: 5, governanceRisk: 4, laborFriction: 3, developmentPotential: 4 };
  const goodsCapacity = entry.goodsCapacity ?? 3;
  const nationalReach = entry.nationalReach ?? defaults.nationalReach;
  const infrastructureCapacity = Math.max(goodsCapacity, entry.infrastructureCapacity ?? Math.min(10, goodsCapacity + (defaults.developmentPotential > 3 ? 2 : 1)));
  const profile: TerritorialPortProfile = {
    classification: classify(goodsCapacity, nationalReach), goodsCapacity, infrastructureCapacity, nationalReach,
    governanceRisk: entry.governanceRisk ?? defaults.governanceRisk, laborFriction: entry.laborFriction ?? defaults.laborFriction,
    capabilities: entry.capabilities ? [...new Set(entry.capabilities)] : ['general_cargo'],
    developmentPotential: entry.developmentPotential ?? defaults.developmentPotential, operationalState: 'operating',
  };
  return { ...profile, classification: classify(profile.goodsCapacity, profile.nationalReach) };
}

function territoryForEntry(state: TerritorialState, entry: OceaniaPortEntry) {
  const candidates = [`${entry.countryId}:${entry.territorySuffix}`, `${entry.countryId}:macro-${entry.territorySuffix}`, `${entry.countryId}:aggregate`];
  return candidates.find((id) => state.territories[id]);
}

export function addOceaniaMajorPorts(state: TerritorialState): TerritorialState {
  const assets = { ...state.assets };
  for (const entry of oceaniaMajorPorts) {
    if (!state.entities[entry.countryId]) continue;
    const territoryId = territoryForEntry(state, entry);
    if (!territoryId) continue;
    const id = `asset:${entry.countryId}:${entry.id}`;
    if (!assets[id]) {
      assets[id] = {
        id, name: entry.name, territoryId, kind: 'port', ownerEntityId: entry.countryId, operatorEntityId: null, anchor: entry.anchor,
        status: 'operating', capacity: null, portProfile: profileFor(entry), integration: 'inventory_only', sourceIds: ['unctad-lsci', 'world-port-index'],
        note: `Inventaire portuaire majeur de État-Nation. ${entry.note} Profil abstrait évolutif ; aucun actif énergétique n’est créé ici.`,
      };
    } else if (assets[id].kind === 'port' && !assets[id].portProfile) {
      assets[id] = { ...assets[id], portProfile: profileFor(entry) };
    }
  }
  return { ...state, assets };
}

export function oceaniaPortsForCountry(state: TerritorialState, countryId: string) {
  return Object.values(state.assets)
    .filter((asset) => asset.kind === 'port' && state.territories[asset.territoryId]?.sovereignCountryId === countryId)
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}

export function oceaniaPortOperationalCapacityForCountry(state: TerritorialState, countryId: string) {
  return Number(oceaniaPortsForCountry(state, countryId).reduce((sum, asset) => sum + (asset.portProfile ? effectivePortGoodsCapacity(asset.portProfile) : 0), 0).toFixed(2));
}
