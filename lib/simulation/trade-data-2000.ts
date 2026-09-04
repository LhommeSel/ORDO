import type { BilateralTradeFlow, CountryId, EconomicProductFamily } from './types';

type Mix = Partial<Record<EconomicProductFamily, number>>;

const emptyMix = (): Record<EconomicProductFamily, number> => ({
  food: 0, energy: 0, raw_materials: 0, industrial_inputs: 0,
  manufactured_goods: 0, strategic_technology: 0,
});

function flow(exporterId: CountryId, importerId: CountryId, value: number, mix: Mix, friction = 8, reliability = 85): BilateralTradeFlow {
  const productMix = { ...emptyMix(), ...mix };
  const total = Object.values(productMix).reduce((sum, share) => sum + share, 0) || 1;
  for (const family of Object.keys(productMix) as EconomicProductFamily[]) productMix[family] /= total;
  return {
    id: `${exporterId}-${importerId}`, exporterId, importerId,
    annualValueBillion2000Usd: value, productMix, friction, reliability,
  };
}

/**
 * Réseau volontairement agrégé : les pays non encore modélisés restent contenus
 * dans les parts d'import/export macro. Ces liens donnent au moteur les principaux
 * canaux de contagion sans prétendre reconstituer chaque déclaration douanière.
 */
export function createTradeFlows2000(): Record<string, BilateralTradeFlow> {
  const industrial = { industrial_inputs: 0.3, manufactured_goods: 0.5, strategic_technology: 0.2 };
  const mixed = { food: 0.1, raw_materials: 0.12, industrial_inputs: 0.23, manufactured_goods: 0.4, strategic_technology: 0.15 };
  const energy = { energy: 0.78, raw_materials: 0.17, industrial_inputs: 0.05 };
  const values = [
    flow('FRA', 'DEU', 37, mixed), flow('DEU', 'FRA', 43, industrial),
    flow('FRA', 'ITA', 24, mixed), flow('ITA', 'FRA', 22, industrial),
    flow('DEU', 'ITA', 31, industrial), flow('ITA', 'DEU', 27, industrial),
    flow('DEU', 'POL', 12, industrial, 12, 82), flow('POL', 'DEU', 10, industrial, 12, 80),
    flow('FRA', 'GBR', 25, mixed, 10), flow('GBR', 'FRA', 24, mixed, 10),
    flow('DEU', 'GBR', 31, industrial, 10), flow('GBR', 'DEU', 25, mixed, 10),
    flow('USA', 'GBR', 34, { manufactured_goods: 0.42, strategic_technology: 0.38, industrial_inputs: 0.2 }, 9, 91),
    flow('GBR', 'USA', 29, { manufactured_goods: 0.38, strategic_technology: 0.42, industrial_inputs: 0.2 }, 9, 91),
    flow('USA', 'FRA', 24, mixed, 12, 88), flow('FRA', 'USA', 22, mixed, 12, 88),
    flow('USA', 'DEU', 29, mixed, 12, 88), flow('DEU', 'USA', 38, industrial, 12, 88),
    flow('CHN', 'USA', 100, { manufactured_goods: 0.58, industrial_inputs: 0.25, strategic_technology: 0.07, food: 0.04, raw_materials: 0.06 }, 18, 80),
    flow('USA', 'CHN', 16, { strategic_technology: 0.4, manufactured_goods: 0.25, industrial_inputs: 0.2, food: 0.15 }, 18, 80),
    flow('CHN', 'DEU', 15, industrial, 18, 78), flow('DEU', 'CHN', 18, industrial, 18, 78),
    flow('RUS', 'DEU', 14, energy, 16, 76), flow('RUS', 'ITA', 8, energy, 18, 72),
    flow('RUS', 'POL', 6, energy, 20, 68), flow('DEU', 'RUS', 7, industrial, 18, 73),
    flow('NOR', 'GBR', 12, energy, 7, 94), flow('NOR', 'DEU', 9, energy, 7, 94), flow('NOR', 'FRA', 5, energy, 8, 93),
    flow('DZA', 'FRA', 5, energy, 17, 79), flow('FRA', 'DZA', 4, industrial, 17, 76),
    flow('DZA', 'ITA', 4, energy, 18, 77), flow('LBY', 'ITA', 5, energy, 24, 62),
    flow('SAU', 'USA', 15, energy, 14, 84), flow('USA', 'SAU', 8, { strategic_technology: 0.42, manufactured_goods: 0.38, industrial_inputs: 0.2 }, 16, 80),
  ];
  return Object.fromEntries(values.map((item) => [item.id, item]));
}
