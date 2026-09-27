/** Stable IDs describe land, never its current government or owner. No geometry in saves. */
export type Territory = {
  id: string;
  name: string;
  kind: 'region' | 'overseas' | 'aggregate';
  sovereignCountryId: string;
  controllerEntityId: string;
  administratorEntityId: string;
  claimantEntityIds: string[];
  /** Statistical perimeter, distinct from sovereignty. null = separate, unmodeled accounts. */
  accountingCountryId: string | null;
  population: number | null;
  realGdpBillion2000Usd: number | null;
  populationWeight: number;
  economicWeight: number;
  referencePopulation: number | null;
  referenceYear: number | null;
  provenance: 'calibrated' | 'national_aggregate' | 'not_calibrated';
  sourceIds: string[];
  note: string;
  mapGroup: string;
  /** Approximate label/locator, not a boundary or an asset's precise coordinates. */
  anchor: [number, number] | null;
};

export type TerritorialAssetCapacityUnit = 'MW' | 'bcm_per_year' | 'million_tonnes_per_year';

/**
 * Anciennes étiquettes internes conservées pour relire les premiers états
 * sauvegardés. Elles ne sont plus affichées au joueur : les ports exposent
 * désormais un profil large et stable (voir TerritorialPortProfile).
 */
export type TerritorialAssetRole =
  | 'container_gateway'
  | 'bulk_export'
  | 'hydrocarbon'
  | 'naval'
  | 'canal'
  | 'riverine'
  | 'transshipment'
  | 'multi_purpose';

/** Niveau qualitatif de desserte d'un port, indépendant de sa capacité courante. */
export type TerritorialPortClass = 'local' | 'regional' | 'national' | 'major' | 'global_hub' | 'megahub';

/** Capacités portuaires volontairement larges, utilisables par le moteur. */
export type TerritorialPortCapability =
  | 'general_cargo'
  | 'solid_bulk'
  | 'liquid_hydrocarbons'
  | 'lng'
  | 'passengers_ferries';

export type TerritorialPortOperationalState = 'operating' | 'congested' | 'damaged' | 'blockaded' | 'closed';

/**
 * Profil léger d'un port. Les notes 0–10 n'imitent pas un tonnage réel : elles
 * servent de curseurs cohérents pour les règles du moteur et peuvent évoluer.
 * `infrastructureCapacity` est le plafond installé ; `goodsCapacity` est la
 * capacité de marchandises actuellement disponible.
 */
export type TerritorialPortProfile = {
  classification: TerritorialPortClass;
  goodsCapacity: number;
  infrastructureCapacity: number;
  nationalReach: number;
  governanceRisk: number;
  laborFriction: number;
  capabilities: TerritorialPortCapability[];
  developmentPotential: number;
  operationalState: TerritorialPortOperationalState;
};

/**
 * Couche opérationnelle légère des actifs énergétiques.
 *
 * `maximum` est la capacité installée ou mobilisable, `deployed` la part
 * effectivement déployée au lancement et `availabilityPct` les indisponibilités
 * ordinaires. Aucun de ces champs ne remplace le registre énergétique : un
 * `ledgerNodeId` explicite le seul raccord autorisé avec ce registre.
 */
export type TerritorialAssetOperation = {
  maximum: number;
  deployed: number;
  availabilityPct: number;
  unit: TerritorialAssetCapacityUnit;
  resource?: 'oil' | 'gas';
  ledgerNodeId?: string;
};

export type TerritorialAsset = {
  id: string;
  name: string;
  territoryId: string;
  kind: 'port' | 'nuclear' | 'lng_terminal' | 'thermal' | 'hydro' | 'refinery' | 'oil_field' | 'gas_field' | 'storage' | 'airport' | 'passage' | 'logistics' | 'industrial' | 'naval_base' | 'spaceport';
  ownerEntityId: string | null;
  operatorEntityId: string | null;
  anchor: [number, number];
  status: 'operating' | 'closed' | 'damaged';
  capacity: { value: number; unit: TerritorialAssetCapacityUnit } | null;
  /** Présent pour les actifs énergétiques calibrés ; absent = inventaire seul. */
  operation?: TerritorialAssetOperation;
  /** Profil présent uniquement pour les actifs de type `port`. */
  portProfile?: TerritorialPortProfile;
  /** Rôle stratégique indicatif, surtout utilisé pour les ports du catalogue réduit. */
  roles?: TerritorialAssetRole[];
  /** Initial catalogue is NOT a second production ledger. */
  integration: 'inventory_only';
  sourceIds: string[];
  note: string;
};

export type TerritorialEntity = { id: string; name: string; kind: 'state' | 'public_operator' };

export type TerritorialState = {
  schemaVersion: 1;
  territories: Record<string, Territory>;
  accountingTerritoryIds: Record<string, string[]>;
  assets: Record<string, TerritorialAsset>;
  entities: Record<string, TerritorialEntity>;
};

export type TerritorySeed = Pick<Territory, 'id' | 'name' | 'kind' | 'referencePopulation' | 'referenceYear' | 'anchor' | 'mapGroup' | 'note' | 'sourceIds'> & {
  inNationalAccounts: boolean;
  economicWeight: number;
};

export type TerritoryDataset = {
  countryId: string;
  territories: TerritorySeed[];
  assets: TerritorialAsset[];
  entities: TerritorialEntity[];
};
