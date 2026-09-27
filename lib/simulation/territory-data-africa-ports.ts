import type {
  TerritorialPortCapability,
  TerritorialPortClass,
  TerritorialPortProfile,
  TerritorialState,
} from './territory-types';
import { effectivePortGoodsCapacity } from './territory-data-americas-ports';

/**
 * Catalogue portuaire africain réduit. Il retient les nœuds qui peuvent
 * changer un approvisionnement, un corridor ou une crise ; il ne prétend pas
 * recenser chaque quai. Les capacités sont des indices de scénario 2000,
 * séparés du registre énergétique et évolutifs par les patches du moteur.
 */
export type AfricaPortEntry = {
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
  overrides: Omit<AfricaPortEntry, 'id' | 'countryId' | 'name' | 'territorySuffix' | 'anchor' | 'note'> = {},
): AfricaPortEntry => ({ id, countryId, name, territorySuffix, anchor: [lon, lat], note, ...overrides });

/** Ports maritimes, fluviaux et insulaires structurants. */
export const africaMajorPorts: AfricaPortEntry[] = [
  // Afrique du Nord et façade méditerranéenne
  p('algiers', 'DZA', 'Port d’Alger', 'aggregate', 3.06, 36.77, 'Porte capitale et principal débouché commercial algérien.', { goodsCapacity: 7, infrastructureCapacity: 8, nationalReach: 7, governanceRisk: 5 }),
  p('arzew', 'DZA', 'Port d’Arzew', 'aggregate', -0.3, 35.85, 'Terminal pétrolier et gazier de la façade oranaise.', { goodsCapacity: 6, infrastructureCapacity: 8, nationalReach: 6, governanceRisk: 5, capabilities: ['general_cargo', 'liquid_hydrocarbons', 'lng'] }),
  p('skikda', 'DZA', 'Port de Skikda', 'aggregate', 6.91, 36.88, 'Complexe industriel et énergétique de l’Est algérien.', { goodsCapacity: 6, infrastructureCapacity: 8, nationalReach: 6, governanceRisk: 5, capabilities: ['general_cargo', 'liquid_hydrocarbons', 'lng'] }),
  p('alexandria', 'EGY', 'Port d’Alexandrie', 'aggregate', 29.88, 31.2, 'Principal port commercial et industriel égyptien.', { goodsCapacity: 8, infrastructureCapacity: 9, nationalReach: 8, governanceRisk: 5 }),
  p('port-said', 'EGY', 'Port-Saïd', 'aggregate', 32.3, 31.26, 'Porte méditerranéenne du canal de Suez.', { goodsCapacity: 8, infrastructureCapacity: 9, nationalReach: 8, governanceRisk: 5, capabilities: ['general_cargo', 'liquid_hydrocarbons'] }),
  p('suez', 'EGY', 'Port de Suez', 'aggregate', 32.55, 29.97, 'Nœud de transit et d’hydrocarbures à l’entrée sud du canal.', { goodsCapacity: 7, infrastructureCapacity: 9, nationalReach: 8, governanceRisk: 5, capabilities: ['general_cargo', 'liquid_hydrocarbons'] }),
  p('damietta', 'EGY', 'Port de Damiette', 'aggregate', 31.81, 31.43, 'Port d’exportation et terminal gazier du delta.', { goodsCapacity: 6, infrastructureCapacity: 8, nationalReach: 7, governanceRisk: 5, capabilities: ['general_cargo', 'liquid_hydrocarbons', 'lng'] }),
  p('tripoli', 'LBY', 'Port de Tripoli', 'aggregate', 13.19, 32.89, 'Port-capitale et approvisionnement de la côte libyenne.', { goodsCapacity: 5, infrastructureCapacity: 7, nationalReach: 5, governanceRisk: 8, laborFriction: 4, developmentPotential: 4 }),
  p('misrata', 'LBY', 'Port de Misrata', 'aggregate', 15.09, 32.38, 'Port industriel et commercial du centre libyen.', { goodsCapacity: 5, infrastructureCapacity: 7, nationalReach: 5, governanceRisk: 8, laborFriction: 4, developmentPotential: 4 }),
  p('ras-lanuf', 'LBY', 'Terminal de Ras Lanouf', 'aggregate', 18.55, 30.47, 'Terminal d’exportation du croissant pétrolier.', { goodsCapacity: 5, infrastructureCapacity: 7, nationalReach: 4, governanceRisk: 8, laborFriction: 4, developmentPotential: 4, capabilities: ['general_cargo', 'liquid_hydrocarbons'] }),
  p('tanger-med', 'MAR', 'Port de Tanger', 'aggregate', -5.8, 35.79, 'Porte du détroit et plateforme de transbordement en développement.', { goodsCapacity: 8, infrastructureCapacity: 9, nationalReach: 8, governanceRisk: 4, laborFriction: 2, developmentPotential: 2 }),
  p('casablanca', 'MAR', 'Port de Casablanca', 'aggregate', -7.62, 33.6, 'Premier port commercial et industriel marocain.', { goodsCapacity: 8, infrastructureCapacity: 9, nationalReach: 8, governanceRisk: 4, laborFriction: 3, developmentPotential: 2 }),
  p('jorf-lasfar', 'MAR', 'Port de Jorf Lasfar', 'aggregate', -8.95, 33.11, 'Port de vrac, phosphates et industrie lourde.', { goodsCapacity: 7, infrastructureCapacity: 8, nationalReach: 7, governanceRisk: 4, laborFriction: 3, developmentPotential: 2, capabilities: ['general_cargo', 'solid_bulk', 'liquid_hydrocarbons'] }),
  p('agadir', 'MAR', 'Port d’Agadir', 'aggregate', -9.6, 30.42, 'Port régional, pêche et flux passagers du Sud marocain.', { goodsCapacity: 5, infrastructureCapacity: 7, nationalReach: 6, governanceRisk: 4, capabilities: ['general_cargo', 'solid_bulk', 'passengers_ferries'] }),
  p('rades', 'TUN', 'Port de Radès', 'aggregate', 10.28, 36.77, 'Principal port commercial et conteneurisé tunisien.', { goodsCapacity: 6, infrastructureCapacity: 8, nationalReach: 7, governanceRisk: 5, laborFriction: 3 }),
  p('bizerte', 'TUN', 'Port de Bizerte', 'aggregate', 9.87, 37.27, 'Port industriel de la façade nord tunisienne.', { goodsCapacity: 5, infrastructureCapacity: 7, nationalReach: 6, governanceRisk: 5 }),
  p('skhira', 'TUN', 'Terminal de Skhira', 'aggregate', 10.1, 34.3, 'Terminal pétrolier et énergétique du golfe de Gabès.', { goodsCapacity: 5, infrastructureCapacity: 7, nationalReach: 5, governanceRisk: 5, capabilities: ['general_cargo', 'liquid_hydrocarbons'] }),
  p('nouakchott', 'MRT', 'Port de Nouakchott', 'aggregate', -15.98, 18.1, 'Porte capitale et importations mauritaniennes.', { goodsCapacity: 3, infrastructureCapacity: 5, nationalReach: 4, governanceRisk: 7, developmentPotential: 4 }),
  p('nouadhibou', 'MRT', 'Port de Nouadhibou', 'aggregate', -17.03, 20.93, 'Port minéral, pêche et exportations de la côte nord.', { goodsCapacity: 4, infrastructureCapacity: 6, nationalReach: 4, governanceRisk: 7, developmentPotential: 4, capabilities: ['general_cargo', 'solid_bulk'] }),
  p('port-sudan', 'SDN', 'Port-Soudan', 'aggregate', 37.22, 19.62, 'Principal débouché maritime et corridor logistique du Soudan.', { goodsCapacity: 5, infrastructureCapacity: 7, nationalReach: 4, governanceRisk: 8, laborFriction: 4, developmentPotential: 4, capabilities: ['general_cargo', 'solid_bulk', 'liquid_hydrocarbons'] }),
  p('suakin', 'SDN', 'Port de Suakin', 'aggregate', 37.33, 19.1, 'Port historique de la mer Rouge et relais régional.', { goodsCapacity: 3, infrastructureCapacity: 5, nationalReach: 3, governanceRisk: 8, laborFriction: 4, developmentPotential: 5, capabilities: ['general_cargo', 'passengers_ferries'] }),

  // Golfe de Guinée et Afrique de l’Ouest
  p('dakar', 'SEN', 'Port de Dakar', 'aggregate', -17.43, 14.69, 'Hub ouest-africain et port-capitale.', { goodsCapacity: 6, infrastructureCapacity: 8, nationalReach: 6, governanceRisk: 5, capabilities: ['general_cargo', 'solid_bulk', 'passengers_ferries'] }),
  p('banjul', 'GMB', 'Port de Banjul', 'aggregate', -16.58, 13.45, 'Port fluvio-maritime et débouché gambien.', { goodsCapacity: 3, infrastructureCapacity: 5, nationalReach: 4, governanceRisk: 7, developmentPotential: 4 }),
  p('conakry', 'GIN', 'Port de Conakry', 'aggregate', -13.7, 9.51, 'Porte capitale et exportations minières guinéennes.', { goodsCapacity: 4, infrastructureCapacity: 6, nationalReach: 5, governanceRisk: 7, laborFriction: 4, developmentPotential: 4, capabilities: ['general_cargo', 'solid_bulk'] }),
  p('bissau', 'GNB', 'Port de Bissau', 'aggregate', -15.58, 11.86, 'Port fluvial et exportations agricoles.', { goodsCapacity: 2, infrastructureCapacity: 4, nationalReach: 3, governanceRisk: 8, laborFriction: 4, developmentPotential: 4 }),
  p('freetown', 'SLE', 'Port de Freetown', 'aggregate', -13.24, 8.49, 'Port-capitale et ravitaillement de la Sierra Leone.', { goodsCapacity: 3, infrastructureCapacity: 5, nationalReach: 4, governanceRisk: 7, laborFriction: 4, developmentPotential: 4 }),
  p('monrovia', 'LBR', 'Port de Monrovia', 'aggregate', -10.8, 6.31, 'Porte capitale et exportations de vrac.', { goodsCapacity: 4, infrastructureCapacity: 6, nationalReach: 4, governanceRisk: 7, laborFriction: 4, developmentPotential: 4, capabilities: ['general_cargo', 'solid_bulk'] }),
  p('abidjan', 'CIV', 'Port d’Abidjan', 'aggregate', -4.0, 5.32, 'Premier hub commercial et industriel de l’UEMOA.', { goodsCapacity: 7, infrastructureCapacity: 9, nationalReach: 7, governanceRisk: 5, laborFriction: 3 }),
  p('san-pedro', 'CIV', 'Port de San-Pédro', 'aggregate', -6.64, 4.75, 'Port de vrac et exportations agricoles du Sud-Ouest.', { goodsCapacity: 5, infrastructureCapacity: 7, nationalReach: 5, governanceRisk: 5, capabilities: ['general_cargo', 'solid_bulk'] }),
  p('tema', 'GHA', 'Port de Tema', 'aggregate', 0.0, 5.67, 'Principal port industriel et commercial du Ghana.', { goodsCapacity: 6, infrastructureCapacity: 8, nationalReach: 7, governanceRisk: 5, laborFriction: 3 }),
  p('takoradi', 'GHA', 'Port de Takoradi', 'aggregate', -1.75, 4.9, 'Port de vrac, minerais et industrie offshore.', { goodsCapacity: 5, infrastructureCapacity: 7, nationalReach: 6, governanceRisk: 5, capabilities: ['general_cargo', 'solid_bulk', 'liquid_hydrocarbons'] }),
  p('lome', 'TGO', 'Port de Lomé', 'aggregate', 1.29, 6.13, 'Porte régionale du golfe de Guinée.', { goodsCapacity: 5, infrastructureCapacity: 7, nationalReach: 6, governanceRisk: 6, laborFriction: 3 }),
  p('cotonou', 'BEN', 'Port de Cotonou', 'aggregate', 2.43, 6.35, 'Porte commerciale et corridor vers l’intérieur ouest-africain.', { goodsCapacity: 5, infrastructureCapacity: 7, nationalReach: 5, governanceRisk: 6, laborFriction: 3 }),
  p('lagos-apapa', 'NGA', 'Ports de Lagos–Apapa', 'aggregate', 3.37, 6.45, 'Principal nœud commercial et démographique du Nigeria.', { goodsCapacity: 8, infrastructureCapacity: 9, nationalReach: 7, governanceRisk: 7, laborFriction: 4 }),
  p('port-harcourt', 'NGA', 'Port Harcourt–Onne', 'aggregate', 7.02, 4.78, 'Complexe pétrolier et industriel du delta du Niger.', { goodsCapacity: 6, infrastructureCapacity: 8, nationalReach: 6, governanceRisk: 7, laborFriction: 4, capabilities: ['general_cargo', 'liquid_hydrocarbons'] }),
  p('bonny', 'NGA', 'Terminal de Bonny', 'aggregate', 7.17, 4.43, 'Terminal d’hydrocarbures et de GNL du delta.', { goodsCapacity: 5, infrastructureCapacity: 7, nationalReach: 5, governanceRisk: 7, laborFriction: 4, capabilities: ['general_cargo', 'liquid_hydrocarbons', 'lng'] }),
  p('douala', 'CMR', 'Port de Douala', 'aggregate', 9.7, 4.05, 'Principal port commercial et fluvio-maritime du Cameroun.', { goodsCapacity: 6, infrastructureCapacity: 8, nationalReach: 6, governanceRisk: 7, laborFriction: 4 }),
  p('kribi', 'CMR', 'Port en eau profonde de Kribi', 'aggregate', 9.91, 2.94, 'Porte en eau profonde et débouché minier en développement.', { goodsCapacity: 5, infrastructureCapacity: 7, nationalReach: 4, governanceRisk: 7, laborFriction: 4, developmentPotential: 4, capabilities: ['general_cargo', 'solid_bulk'] }),
  p('malabo', 'GNQ', 'Port de Malabo', 'aggregate', 8.78, 3.75, 'Port-capitale et exportations énergétiques insulaires.', { goodsCapacity: 4, infrastructureCapacity: 6, nationalReach: 4, governanceRisk: 7, laborFriction: 4, developmentPotential: 4, capabilities: ['general_cargo', 'liquid_hydrocarbons'] }),
  p('bata', 'GNQ', 'Port de Bata', 'aggregate', 9.77, 1.86, 'Port continental et appui aux hydrocarbures.', { goodsCapacity: 4, infrastructureCapacity: 6, nationalReach: 4, governanceRisk: 7, laborFriction: 4, developmentPotential: 4, capabilities: ['general_cargo', 'liquid_hydrocarbons'] }),
  p('owendo', 'GAB', 'Port d’Owendo–Libreville', 'aggregate', 9.45, 0.3, 'Porte capitale, bois et vrac gabonais.', { goodsCapacity: 5, infrastructureCapacity: 7, nationalReach: 5, governanceRisk: 6, laborFriction: 3, capabilities: ['general_cargo', 'solid_bulk'] }),
  p('port-gentil', 'GAB', 'Port-Gentil', 'aggregate', 8.78, -0.72, 'Port pétrolier et industriel de la côte gabonaise.', { goodsCapacity: 4, infrastructureCapacity: 6, nationalReach: 4, governanceRisk: 6, laborFriction: 3, capabilities: ['general_cargo', 'liquid_hydrocarbons'] }),
  p('pointe-noire', 'COG', 'Port de Pointe-Noire', 'aggregate', 11.86, -4.78, 'Principal port commercial et pétrolier du Congo.', { goodsCapacity: 6, infrastructureCapacity: 8, nationalReach: 5, governanceRisk: 7, laborFriction: 4, capabilities: ['general_cargo', 'liquid_hydrocarbons'] }),
  p('brazzaville', 'COG', 'Port fluvial de Brazzaville', 'aggregate', 15.28, -4.27, 'Nœud fluvial du Congo et corridor vers l’intérieur.', { goodsCapacity: 3, infrastructureCapacity: 5, nationalReach: 5, governanceRisk: 7, laborFriction: 4, developmentPotential: 4, capabilities: ['general_cargo', 'solid_bulk'] }),
  p('matadi', 'COD', 'Port de Matadi', 'aggregate', 13.45, -5.82, 'Principal accès fluvial et maritime de l’ouest congolais.', { goodsCapacity: 4, infrastructureCapacity: 6, nationalReach: 3, governanceRisk: 9, laborFriction: 4, developmentPotential: 5, capabilities: ['general_cargo', 'solid_bulk'] }),
  p('banana', 'COD', 'Port de Banana', 'aggregate', 12.35, -6.02, 'Débouché maritime à l’embouchure du Congo.', { goodsCapacity: 3, infrastructureCapacity: 5, nationalReach: 2, governanceRisk: 9, laborFriction: 4, developmentPotential: 5 }),
  p('luanda', 'AGO', 'Port de Luanda', 'aggregate', 13.23, -8.81, 'Port-capitale et principal centre commercial angolais.', { goodsCapacity: 7, infrastructureCapacity: 9, nationalReach: 7, governanceRisk: 6, laborFriction: 4 }),
  p('lobito', 'AGO', 'Port de Lobito', 'aggregate', 13.57, -12.35, 'Porte ferroviaire et minière de l’Angola central.', { goodsCapacity: 6, infrastructureCapacity: 8, nationalReach: 6, governanceRisk: 6, laborFriction: 4, capabilities: ['general_cargo', 'solid_bulk'] }),
  p('soyo', 'AGO', 'Terminal de Soyo', 'aggregate', 12.37, -6.13, 'Terminal pétrolier de l’embouchure du Congo.', { goodsCapacity: 5, infrastructureCapacity: 7, nationalReach: 5, governanceRisk: 6, laborFriction: 4, capabilities: ['general_cargo', 'liquid_hydrocarbons'] }),

  // Afrique orientale, australe et insulaire
  p('praia', 'CPV', 'Port de Praia', 'aggregate', -23.51, 14.92, 'Port-capitale et relais de l’archipel capverdien.', { goodsCapacity: 3, infrastructureCapacity: 5, nationalReach: 4, governanceRisk: 4, capabilities: ['general_cargo', 'passengers_ferries'] }),
  p('mindelo', 'CPV', 'Port de Mindelo', 'aggregate', -25.0, 16.89, 'Port en eau profonde et escale de l’Atlantique.', { goodsCapacity: 3, infrastructureCapacity: 5, nationalReach: 4, governanceRisk: 4, capabilities: ['general_cargo', 'passengers_ferries'] }),
  p('sao-tome', 'STP', 'Port de São Tomé', 'aggregate', 6.73, 0.34, 'Port-capitale et approvisionnement insulaire.', { goodsCapacity: 2, infrastructureCapacity: 4, nationalReach: 3, governanceRisk: 5, developmentPotential: 4, capabilities: ['general_cargo', 'passengers_ferries'] }),
  p('walvis-bay', 'NAM', 'Port de Walvis Bay', 'aggregate', 14.5, -22.96, 'Hub en eau profonde de la côte australe.', { goodsCapacity: 6, infrastructureCapacity: 8, nationalReach: 6, governanceRisk: 3, laborFriction: 2, developmentPotential: 2, capabilities: ['general_cargo', 'solid_bulk', 'passengers_ferries'] }),
  p('luderitz', 'NAM', 'Port de Lüderitz', 'aggregate', 15.16, -26.65, 'Port régional, pêche et vrac minier.', { goodsCapacity: 4, infrastructureCapacity: 6, nationalReach: 4, governanceRisk: 3, laborFriction: 2, capabilities: ['general_cargo', 'solid_bulk'] }),
  p('durban', 'ZAF', 'Port de Durban', 'aggregate', 31.03, -29.87, 'Premier hub commercial et conteneurisé d’Afrique australe.', { goodsCapacity: 8, infrastructureCapacity: 9, nationalReach: 8, governanceRisk: 3, laborFriction: 3, capabilities: ['general_cargo', 'liquid_hydrocarbons', 'passengers_ferries'] }),
  p('cape-town', 'ZAF', 'Port du Cap', 'aggregate', 18.42, -33.92, 'Porte atlantique, passagers et flux du Cap-Occidental.', { goodsCapacity: 7, infrastructureCapacity: 8, nationalReach: 8, governanceRisk: 3, laborFriction: 3, capabilities: ['general_cargo', 'solid_bulk', 'passengers_ferries'] }),
  p('richards-bay', 'ZAF', 'Port de Richards Bay', 'aggregate', 32.08, -28.8, 'Grand terminal de vrac et exportations minières.', { goodsCapacity: 7, infrastructureCapacity: 9, nationalReach: 7, governanceRisk: 3, laborFriction: 3, capabilities: ['general_cargo', 'solid_bulk'] }),
  p('port-elizabeth', 'ZAF', 'Port Elizabeth–Ngqura', 'aggregate', 25.6, -33.96, 'Port industriel et automobile de la façade sud.', { goodsCapacity: 6, infrastructureCapacity: 8, nationalReach: 7, governanceRisk: 3, laborFriction: 3 }),
  p('maputo', 'MOZ', 'Port de Maputo', 'aggregate', 32.57, -25.97, 'Porte capitale et corridor minier d’Afrique australe.', { goodsCapacity: 6, infrastructureCapacity: 8, nationalReach: 6, governanceRisk: 7, laborFriction: 4, capabilities: ['general_cargo', 'solid_bulk', 'liquid_hydrocarbons'] }),
  p('beira', 'MOZ', 'Port de Beira', 'aggregate', 34.84, -19.84, 'Corridor de transit vers le Zimbabwe et le Malawi.', { goodsCapacity: 5, infrastructureCapacity: 7, nationalReach: 5, governanceRisk: 7, laborFriction: 4, developmentPotential: 4 }),
  p('nacala', 'MOZ', 'Port de Nacala', 'aggregate', 40.68, -14.54, 'Port en eau profonde et débouché du Nord mozambicain.', { goodsCapacity: 4, infrastructureCapacity: 6, nationalReach: 4, governanceRisk: 7, laborFriction: 4, developmentPotential: 4 }),
  p('dar-es-salaam', 'TZA', 'Port de Dar es Salaam', 'aggregate', 39.28, -6.82, 'Hub de l’Afrique orientale et porte de l’hinterland.', { goodsCapacity: 6, infrastructureCapacity: 8, nationalReach: 6, governanceRisk: 6, laborFriction: 3 }),
  p('zanzibar', 'TZA', 'Port de Zanzibar', 'aggregate', 39.2, -6.16, 'Port insulaire, passagers et commerce régional.', { goodsCapacity: 4, infrastructureCapacity: 6, nationalReach: 4, governanceRisk: 6, capabilities: ['general_cargo', 'passengers_ferries'] }),
  p('mtwara', 'TZA', 'Port de Mtwara', 'aggregate', 40.18, -10.27, 'Port régional et exportations agricoles/minérales.', { goodsCapacity: 4, infrastructureCapacity: 6, nationalReach: 4, governanceRisk: 6, capabilities: ['general_cargo', 'solid_bulk'] }),
  p('mombasa', 'KEN', 'Port de Mombasa', 'aggregate', 39.67, -4.05, 'Principal hub maritime de l’Afrique orientale.', { goodsCapacity: 6, infrastructureCapacity: 8, nationalReach: 7, governanceRisk: 6, laborFriction: 3, capabilities: ['general_cargo', 'liquid_hydrocarbons', 'passengers_ferries'] }),
  p('mogadishu', 'SOM', 'Port de Mogadiscio', 'aggregate', 45.34, 2.03, 'Port-capitale soumis à une forte insécurité.', { goodsCapacity: 3, infrastructureCapacity: 5, nationalReach: 3, governanceRisk: 9, laborFriction: 5, developmentPotential: 5 }),
  p('djibouti', 'DJI', 'Port de Djibouti', 'aggregate', 43.14, 11.6, 'Nœud maritime et logistique de la mer Rouge.', { goodsCapacity: 5, infrastructureCapacity: 7, nationalReach: 4, governanceRisk: 6, laborFriction: 3, capabilities: ['general_cargo', 'liquid_hydrocarbons', 'passengers_ferries'] }),
  p('massawa', 'ERI', 'Port de Massawa', 'aggregate', 39.47, 15.61, 'Port de la mer Rouge et débouché érythréen.', { goodsCapacity: 3, infrastructureCapacity: 5, nationalReach: 3, governanceRisk: 8, laborFriction: 4, developmentPotential: 4 }),
  p('assab', 'ERI', 'Port d’Assab', 'aggregate', 42.73, 13.01, 'Port régional et terminal de la côte sud.', { goodsCapacity: 3, infrastructureCapacity: 5, nationalReach: 2, governanceRisk: 8, laborFriction: 4, developmentPotential: 4 }),
  p('toamasina', 'MDG', 'Port de Toamasina', 'aggregate', 49.4, -18.15, 'Principal port commercial de Madagascar.', { goodsCapacity: 4, infrastructureCapacity: 6, nationalReach: 4, governanceRisk: 7, laborFriction: 4, developmentPotential: 4, capabilities: ['general_cargo', 'solid_bulk', 'passengers_ferries'] }),
  p('mahajanga', 'MDG', 'Port de Mahajanga', 'aggregate', 46.32, -15.72, 'Port régional et pêche de la côte nord-ouest.', { goodsCapacity: 3, infrastructureCapacity: 5, nationalReach: 3, governanceRisk: 7, laborFriction: 4, developmentPotential: 4, capabilities: ['general_cargo', 'passengers_ferries'] }),
  p('port-louis', 'MUS', 'Port-Louis', 'aggregate', 57.5, -20.16, 'Hub insulaire, conteneurs, passagers et transbordement régional.', { goodsCapacity: 5, infrastructureCapacity: 7, nationalReach: 6, governanceRisk: 3, laborFriction: 2, capabilities: ['general_cargo', 'passengers_ferries'] }),
  p('victoria', 'SYC', 'Port de Victoria', 'aggregate', 55.45, -4.62, 'Port-capitale et plateforme insulaire de l’océan Indien.', { goodsCapacity: 3, infrastructureCapacity: 5, nationalReach: 4, governanceRisk: 2, laborFriction: 2, capabilities: ['general_cargo', 'passengers_ferries'] }),
  p('moroni', 'COM', 'Port de Moroni', 'aggregate', 43.25, -11.7, 'Port-capitale et liaisons interinsulaires.', { goodsCapacity: 2, infrastructureCapacity: 4, nationalReach: 2, governanceRisk: 7, laborFriction: 4, developmentPotential: 4, capabilities: ['general_cargo', 'passengers_ferries'] }),
];

const countryDefaults: Record<string, Pick<TerritorialPortProfile, 'nationalReach' | 'governanceRisk' | 'laborFriction' | 'developmentPotential'>> = {
  AGO: { nationalReach: 6, governanceRisk: 6, laborFriction: 4, developmentPotential: 4 }, DZA: { nationalReach: 7, governanceRisk: 5, laborFriction: 3, developmentPotential: 3 },
  BEN: { nationalReach: 5, governanceRisk: 6, laborFriction: 3, developmentPotential: 4 }, BWA: { nationalReach: 4, governanceRisk: 3, laborFriction: 2, developmentPotential: 3 },
  CIV: { nationalReach: 6, governanceRisk: 5, laborFriction: 3, developmentPotential: 3 }, CMR: { nationalReach: 5, governanceRisk: 7, laborFriction: 4, developmentPotential: 4 },
  COD: { nationalReach: 3, governanceRisk: 9, laborFriction: 4, developmentPotential: 5 }, COG: { nationalReach: 5, governanceRisk: 7, laborFriction: 4, developmentPotential: 4 },
  CPV: { nationalReach: 4, governanceRisk: 4, laborFriction: 2, developmentPotential: 3 }, DJI: { nationalReach: 4, governanceRisk: 6, laborFriction: 3, developmentPotential: 3 },
  EGY: { nationalReach: 8, governanceRisk: 5, laborFriction: 3, developmentPotential: 2 }, ERI: { nationalReach: 3, governanceRisk: 8, laborFriction: 4, developmentPotential: 4 },
  GAB: { nationalReach: 5, governanceRisk: 6, laborFriction: 3, developmentPotential: 3 }, GHA: { nationalReach: 7, governanceRisk: 5, laborFriction: 3, developmentPotential: 3 },
  GMB: { nationalReach: 4, governanceRisk: 7, laborFriction: 4, developmentPotential: 4 }, GIN: { nationalReach: 5, governanceRisk: 7, laborFriction: 4, developmentPotential: 4 },
  GNB: { nationalReach: 3, governanceRisk: 8, laborFriction: 4, developmentPotential: 5 }, GNQ: { nationalReach: 4, governanceRisk: 7, laborFriction: 4, developmentPotential: 4 },
  KEN: { nationalReach: 7, governanceRisk: 6, laborFriction: 3, developmentPotential: 3 }, LBR: { nationalReach: 4, governanceRisk: 7, laborFriction: 4, developmentPotential: 5 },
  LBY: { nationalReach: 5, governanceRisk: 8, laborFriction: 4, developmentPotential: 4 }, MAR: { nationalReach: 8, governanceRisk: 4, laborFriction: 3, developmentPotential: 2 },
  MDG: { nationalReach: 4, governanceRisk: 7, laborFriction: 4, developmentPotential: 4 }, MLI: { nationalReach: 2, governanceRisk: 8, laborFriction: 4, developmentPotential: 5 },
  MRT: { nationalReach: 4, governanceRisk: 7, laborFriction: 4, developmentPotential: 4 }, MOZ: { nationalReach: 5, governanceRisk: 7, laborFriction: 4, developmentPotential: 4 },
  MUS: { nationalReach: 6, governanceRisk: 3, laborFriction: 2, developmentPotential: 2 }, NAM: { nationalReach: 6, governanceRisk: 3, laborFriction: 2, developmentPotential: 2 },
  NGA: { nationalReach: 7, governanceRisk: 7, laborFriction: 4, developmentPotential: 4 }, SEN: { nationalReach: 6, governanceRisk: 5, laborFriction: 3, developmentPotential: 3 },
  SDN: { nationalReach: 3, governanceRisk: 8, laborFriction: 4, developmentPotential: 5 }, SLE: { nationalReach: 4, governanceRisk: 7, laborFriction: 4, developmentPotential: 5 },
  SOM: { nationalReach: 3, governanceRisk: 9, laborFriction: 5, developmentPotential: 5 }, STP: { nationalReach: 3, governanceRisk: 5, laborFriction: 3, developmentPotential: 4 },
  SWZ: { nationalReach: 3, governanceRisk: 5, laborFriction: 3, developmentPotential: 4 }, SYC: { nationalReach: 4, governanceRisk: 2, laborFriction: 2, developmentPotential: 2 },
  TGO: { nationalReach: 6, governanceRisk: 6, laborFriction: 3, developmentPotential: 4 }, TUN: { nationalReach: 7, governanceRisk: 5, laborFriction: 3, developmentPotential: 3 },
  TZA: { nationalReach: 6, governanceRisk: 6, laborFriction: 3, developmentPotential: 4 }, ZAF: { nationalReach: 8, governanceRisk: 3, laborFriction: 3, developmentPotential: 2 },
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

function profileFor(entry: AfricaPortEntry): TerritorialPortProfile {
  const defaults = countryDefaults[entry.countryId] ?? { nationalReach: 5, governanceRisk: 6, laborFriction: 3, developmentPotential: 4 };
  const goodsCapacity = entry.goodsCapacity ?? 4;
  const nationalReach = entry.nationalReach ?? defaults.nationalReach;
  const infrastructureCapacity = Math.max(goodsCapacity, entry.infrastructureCapacity ?? Math.min(10, goodsCapacity + (defaults.developmentPotential > 3 ? 2 : 1)));
  const base: TerritorialPortProfile = {
    classification: classify(goodsCapacity, nationalReach), goodsCapacity, infrastructureCapacity, nationalReach,
    governanceRisk: entry.governanceRisk ?? defaults.governanceRisk, laborFriction: entry.laborFriction ?? defaults.laborFriction,
    capabilities: entry.capabilities ? [...new Set(entry.capabilities)] : ['general_cargo'],
    developmentPotential: entry.developmentPotential ?? defaults.developmentPotential, operationalState: 'operating',
  };
  return { ...base, classification: classify(base.goodsCapacity, base.nationalReach) };
}

function territoryForEntry(state: TerritorialState, entry: AfricaPortEntry) {
  const candidates = [`${entry.countryId}:${entry.territorySuffix}`, `${entry.countryId}:macro-${entry.territorySuffix}`, `${entry.countryId}:aggregate`];
  return candidates.find((id) => state.territories[id]);
}

/** Ajoute les ports et migre les éventuels profils déjà présents. */
export function addAfricaMajorPorts(state: TerritorialState): TerritorialState {
  const assets = { ...state.assets };
  for (const entry of africaMajorPorts) {
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

export function africaPortsForCountry(state: TerritorialState, countryId: string) {
  return Object.values(state.assets)
    .filter((asset) => asset.kind === 'port' && state.territories[asset.territoryId]?.sovereignCountryId === countryId)
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}

export function africaPortOperationalCapacityForCountry(state: TerritorialState, countryId: string) {
  return Number(africaPortsForCountry(state, countryId).reduce((sum, asset) => sum + (asset.portProfile ? effectivePortGoodsCapacity(asset.portProfile) : 0), 0).toFixed(2));
}
