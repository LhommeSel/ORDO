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

export type TerritorialAsset = {
  id: string;
  name: string;
  territoryId: string;
  kind: 'port' | 'nuclear' | 'lng_terminal' | 'thermal' | 'hydro' | 'refinery' | 'oil_field' | 'gas_field' | 'storage' | 'airport' | 'passage' | 'logistics' | 'industrial' | 'naval_base' | 'spaceport';
  ownerEntityId: string | null;
  operatorEntityId: string | null;
  anchor: [number, number];
  status: 'operating' | 'closed' | 'damaged';
  capacity: { value: number; unit: 'MW' | 'bcm_per_year' | 'million_tonnes_per_year' } | null;
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
