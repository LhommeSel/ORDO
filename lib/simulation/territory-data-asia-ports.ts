import type {
  TerritorialPortCapability,
  TerritorialPortClass,
  TerritorialPortProfile,
  TerritorialState,
} from './territory-types';
import { effectivePortGoodsCapacity } from './territory-data-americas-ports';

/**
 * Catalogue portuaire asiatique réduit. Les valeurs sont des indices de
 * scénario au 1er janvier 2000 : la classe décrit le rang du port, tandis que
 * la capacité disponible et le plafond d'infrastructure peuvent évoluer
 * séparément. Les terminaux énergétiques restent dans le registre énergie.
 */
export type AsiaPortEntry = {
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
  overrides: Omit<AsiaPortEntry, 'id' | 'countryId' | 'name' | 'territorySuffix' | 'anchor' | 'note'> = {},
): AsiaPortEntry => ({ id, countryId, name, territorySuffix, anchor: [lon, lat], note, ...overrides });

export const asiaMajorPorts: AsiaPortEntry[] = [
  // Moyen-Orient et Asie occidentale (Turquie, Caucase et Kazakhstan sont
  // déjà couverts par le catalogue européen).
  p('jeddah', 'SAU', 'Port de Djeddah', 'aggregate', 39.17, 21.49, 'Porte de la mer Rouge et principal débouché commercial saoudien.', { goodsCapacity: 7, infrastructureCapacity: 9, nationalReach: 7, governanceRisk: 5, capabilities: ['general_cargo', 'passengers_ferries'] }),
  p('ras-tanura', 'SAU', 'Terminal de Ras Tanura', 'aggregate', 50.16, 26.64, 'Grand terminal d’exportation pétrolière du Golfe.', { goodsCapacity: 6, infrastructureCapacity: 8, nationalReach: 6, governanceRisk: 5, capabilities: ['general_cargo', 'liquid_hydrocarbons'] }),
  p('yanbu', 'SAU', 'Port de Yanbu', 'aggregate', 38.06, 24.09, 'Port industriel et pétrochimique de la mer Rouge.', { goodsCapacity: 6, infrastructureCapacity: 8, nationalReach: 6, governanceRisk: 5, capabilities: ['general_cargo', 'liquid_hydrocarbons'] }),
  p('jebel-ali', 'ARE', 'Port de Jebel Ali', 'aggregate', 55.06, 25.0, 'Hub mondial de transbordement et zone industrielle de Dubaï.', { goodsCapacity: 9, infrastructureCapacity: 10, nationalReach: 9, governanceRisk: 3, laborFriction: 2 }),
  p('abu-dhabi', 'ARE', 'Port de Mina Zayed–Khalifa', 'aggregate', 54.37, 24.52, 'Port commercial et industriel de l’émirat d’Abou Dabi.', { goodsCapacity: 7, infrastructureCapacity: 9, nationalReach: 8, governanceRisk: 3, laborFriction: 2, capabilities: ['general_cargo', 'liquid_hydrocarbons'] }),
  p('fujairah', 'ARE', 'Port de Fujairah', 'aggregate', 56.36, 25.13, 'Relais pétrolier hors détroit d’Ormuz.', { goodsCapacity: 6, infrastructureCapacity: 8, nationalReach: 7, governanceRisk: 3, laborFriction: 2, capabilities: ['general_cargo', 'liquid_hydrocarbons'] }),
  p('doha', 'QAT', 'Port de Doha', 'aggregate', 51.53, 25.29, 'Port-capitale et approvisionnement du Qatar.', { goodsCapacity: 5, infrastructureCapacity: 7, nationalReach: 6, governanceRisk: 4, laborFriction: 3, capabilities: ['general_cargo', 'passengers_ferries'] }),
  p('ras-laffan', 'QAT', 'Port de Ras Laffan', 'aggregate', 51.52, 25.91, 'Terminal gazier et point d’exportation du Nord qatari.', { goodsCapacity: 6, infrastructureCapacity: 8, nationalReach: 5, governanceRisk: 4, laborFriction: 3, capabilities: ['general_cargo', 'liquid_hydrocarbons', 'lng'] }),
  p('shuwaikh', 'KWT', 'Port de Shuwaikh', 'aggregate', 47.92, 29.35, 'Principal port commercial du Koweït.', { goodsCapacity: 5, infrastructureCapacity: 7, nationalReach: 7, governanceRisk: 5, capabilities: ['general_cargo', 'liquid_hydrocarbons'] }),
  p('mina-ahmadi', 'KWT', 'Port de Mina Al-Ahmadi', 'aggregate', 48.1, 29.07, 'Terminal pétrolier et raffinerie du Koweït.', { goodsCapacity: 6, infrastructureCapacity: 8, nationalReach: 6, governanceRisk: 5, capabilities: ['general_cargo', 'liquid_hydrocarbons'] }),
  p('khalifa-bin-salman', 'BHR', 'Port de Khalifa Bin Salman', 'aggregate', 50.62, 26.2, 'Port commercial et industriel de Bahreïn.', { goodsCapacity: 4, infrastructureCapacity: 6, nationalReach: 6, governanceRisk: 5, capabilities: ['general_cargo', 'liquid_hydrocarbons'] }),
  p('sohar', 'OMN', 'Port de Sohar', 'aggregate', 56.63, 24.5, 'Port industriel et minéral du nord omanais.', { goodsCapacity: 5, infrastructureCapacity: 7, nationalReach: 6, governanceRisk: 4, developmentPotential: 3, capabilities: ['general_cargo', 'solid_bulk', 'liquid_hydrocarbons'] }),
  p('salalah', 'OMN', 'Port de Salalah', 'aggregate', 54.0, 16.95, 'Hub de transbordement de la mer d’Arabie.', { goodsCapacity: 7, infrastructureCapacity: 8, nationalReach: 5, governanceRisk: 4, capabilities: ['general_cargo', 'solid_bulk', 'passengers_ferries'] }),
  p('aden', 'YEM', 'Port d’Aden', 'aggregate', 45.03, 12.78, 'Port stratégique de la mer Rouge et du golfe d’Aden.', { goodsCapacity: 5, infrastructureCapacity: 7, nationalReach: 4, governanceRisk: 8, laborFriction: 4, developmentPotential: 4, capabilities: ['general_cargo', 'liquid_hydrocarbons', 'passengers_ferries'] }),
  p('hodeidah', 'YEM', 'Port de Hodeïda', 'aggregate', 42.95, 14.8, 'Principal port d’approvisionnement de la côte ouest yéménite.', { goodsCapacity: 4, infrastructureCapacity: 6, nationalReach: 4, governanceRisk: 8, laborFriction: 4, developmentPotential: 4 }),
  p('umm-qasr', 'IRQ', 'Port d’Oumm Qasr', 'aggregate', 47.92, 30.04, 'Principal accès maritime irakien.', { goodsCapacity: 4, infrastructureCapacity: 6, nationalReach: 3, governanceRisk: 8, laborFriction: 4, developmentPotential: 4 }),
  p('basra-khor', 'IRQ', 'Ports de Bassora–Khor al-Zubair', 'aggregate', 47.93, 30.37, 'Complexe pétrolier et industriel du Chatt-el-Arab.', { goodsCapacity: 5, infrastructureCapacity: 7, nationalReach: 4, governanceRisk: 8, laborFriction: 4, capabilities: ['general_cargo', 'liquid_hydrocarbons'] }),
  p('bandar-abbas', 'IRN', 'Port de Bandar Abbas', 'aggregate', 56.27, 27.18, 'Principal hub maritime iranien et accès au détroit d’Ormuz.', { goodsCapacity: 7, infrastructureCapacity: 9, nationalReach: 7, governanceRisk: 6, laborFriction: 3, capabilities: ['general_cargo', 'liquid_hydrocarbons'] }),
  p('kharg', 'IRN', 'Terminal de Kharg', 'aggregate', 50.32, 29.23, 'Terminal majeur d’exportation pétrolière iranienne.', { goodsCapacity: 6, infrastructureCapacity: 8, nationalReach: 5, governanceRisk: 6, laborFriction: 3, capabilities: ['general_cargo', 'liquid_hydrocarbons'] }),
  p('bandar-imam', 'IRN', 'Port de Bandar Imam Khomeini', 'aggregate', 49.08, 30.43, 'Port de vrac et complexe pétrochimique du Khuzistan.', { goodsCapacity: 6, infrastructureCapacity: 8, nationalReach: 6, governanceRisk: 6, laborFriction: 3, capabilities: ['general_cargo', 'solid_bulk', 'liquid_hydrocarbons'] }),
  p('haifa', 'ISR', 'Port de Haïfa', 'aggregate', 35.0, 32.82, 'Principal port commercial et naval du nord israélien.', { goodsCapacity: 6, infrastructureCapacity: 8, nationalReach: 8, governanceRisk: 3, laborFriction: 3, capabilities: ['general_cargo', 'liquid_hydrocarbons', 'passengers_ferries'] }),
  p('ashdod', 'ISR', 'Port d’Ashdod', 'aggregate', 34.65, 31.8, 'Grand port commercial de la façade méditerranéenne.', { goodsCapacity: 6, infrastructureCapacity: 8, nationalReach: 8, governanceRisk: 3, laborFriction: 3 }),
  p('aqaba', 'JOR', 'Port d’Aqaba', 'aggregate', 35.0, 29.53, 'Unique débouché maritime jordanien.', { goodsCapacity: 4, infrastructureCapacity: 6, nationalReach: 5, governanceRisk: 5, capabilities: ['general_cargo', 'solid_bulk', 'passengers_ferries'] }),
  p('beirut', 'LBN', 'Port de Beyrouth', 'aggregate', 35.51, 33.9, 'Port-capitale et centre commercial levantin.', { goodsCapacity: 5, infrastructureCapacity: 7, nationalReach: 6, governanceRisk: 7, laborFriction: 4, developmentPotential: 4 }),
  p('latakia', 'SYR', 'Port de Lattaquié', 'aggregate', 35.78, 35.52, 'Principal port commercial syrien.', { goodsCapacity: 4, infrastructureCapacity: 6, nationalReach: 5, governanceRisk: 7, laborFriction: 4, developmentPotential: 4 }),
  p('tartus', 'SYR', 'Port de Tartous', 'aggregate', 35.89, 34.89, 'Port industriel et naval de la côte syrienne.', { goodsCapacity: 4, infrastructureCapacity: 6, nationalReach: 4, governanceRisk: 7, laborFriction: 4, capabilities: ['general_cargo', 'liquid_hydrocarbons'] }),

  // Asie du Sud
  p('mumbai-jnp', 'IND', 'Complexe Mumbai–Jawaharlal Nehru', 'aggregate', 72.95, 18.95, 'Principal hub conteneurisé et financier de l’Inde.', { goodsCapacity: 9, infrastructureCapacity: 10, nationalReach: 9, governanceRisk: 5, laborFriction: 3 }),
  p('kandla', 'IND', 'Port de Kandla', 'aggregate', 70.22, 23.0, 'Porte de vrac et d’hydrocarbures de la côte du Gujarat.', { goodsCapacity: 7, infrastructureCapacity: 8, nationalReach: 7, governanceRisk: 5, capabilities: ['general_cargo', 'solid_bulk', 'liquid_hydrocarbons'] }),
  p('chennai', 'IND', 'Port de Chennai', 'aggregate', 80.3, 13.1, 'Grand port industriel de la côte orientale.', { goodsCapacity: 7, infrastructureCapacity: 9, nationalReach: 8, governanceRisk: 5, laborFriction: 3 }),
  p('kolkata', 'IND', 'Port de Kolkata–Haldia', 'aggregate', 88.3, 22.55, 'Port fluvial et accès au Bengale.', { goodsCapacity: 6, infrastructureCapacity: 8, nationalReach: 7, governanceRisk: 6, laborFriction: 4, capabilities: ['general_cargo', 'solid_bulk'] }),
  p('visakhapatnam', 'IND', 'Port de Visakhapatnam', 'aggregate', 83.3, 17.7, 'Port minéral, sidérurgique et naval de la côte est.', { goodsCapacity: 7, infrastructureCapacity: 8, nationalReach: 7, governanceRisk: 5, capabilities: ['general_cargo', 'solid_bulk', 'liquid_hydrocarbons'] }),
  p('karachi', 'PAK', 'Port de Karachi', 'aggregate', 67.0, 24.8, 'Principal port commercial et naval du Pakistan.', { goodsCapacity: 7, infrastructureCapacity: 8, nationalReach: 7, governanceRisk: 6, laborFriction: 4, capabilities: ['general_cargo', 'liquid_hydrocarbons', 'passengers_ferries'] }),
  p('port-qasim', 'PAK', 'Port Qasim', 'aggregate', 67.33, 24.77, 'Port industriel et énergétique de Karachi.', { goodsCapacity: 6, infrastructureCapacity: 8, nationalReach: 6, governanceRisk: 6, laborFriction: 4, capabilities: ['general_cargo', 'solid_bulk', 'liquid_hydrocarbons'] }),
  p('gwadar', 'PAK', 'Port de Gwadar', 'aggregate', 62.33, 25.13, 'Port en développement sur la mer d’Oman.', { goodsCapacity: 2, infrastructureCapacity: 4, nationalReach: 2, governanceRisk: 7, laborFriction: 4, developmentPotential: 5 }),
  p('chittagong', 'BGD', 'Port de Chittagong', 'aggregate', 91.8, 22.32, 'Principal port commercial et industriel du Bangladesh.', { goodsCapacity: 6, infrastructureCapacity: 8, nationalReach: 6, governanceRisk: 7, laborFriction: 4, capabilities: ['general_cargo', 'solid_bulk', 'liquid_hydrocarbons'] }),
  p('mongla', 'BGD', 'Port de Mongla', 'aggregate', 89.6, 22.48, 'Port régional et débouché du sud-ouest bangladais.', { goodsCapacity: 3, infrastructureCapacity: 5, nationalReach: 4, governanceRisk: 7, laborFriction: 4 }),
  p('colombo', 'LKA', 'Port de Colombo', 'aggregate', 79.85, 6.95, 'Hub de transbordement de l’océan Indien.', { goodsCapacity: 7, infrastructureCapacity: 9, nationalReach: 7, governanceRisk: 5, laborFriction: 3, capabilities: ['general_cargo', 'passengers_ferries'] }),
  p('trincomalee', 'LKA', 'Port de Trincomalee', 'aggregate', 81.23, 8.57, 'Port naturel, vrac et fonctions navales.', { goodsCapacity: 4, infrastructureCapacity: 6, nationalReach: 5, governanceRisk: 5, capabilities: ['general_cargo', 'solid_bulk', 'liquid_hydrocarbons'] }),
  p('male', 'MDV', 'Port de Malé', 'aggregate', 73.51, 4.18, 'Port-capitale et approvisionnement de l’archipel.', { goodsCapacity: 3, infrastructureCapacity: 5, nationalReach: 4, governanceRisk: 4, capabilities: ['general_cargo', 'passengers_ferries'] }),

  // Chine, Japon, Corées et Taïwan
  p('shanghai', 'CHN', 'Port de Shanghai', 'aggregate', 121.5, 31.23, 'Grand hub du delta du Yangzi et de l’industrie chinoise.', { goodsCapacity: 10, infrastructureCapacity: 10, nationalReach: 10, governanceRisk: 4, laborFriction: 2 }),
  p('ningbo-zhoushan', 'CHN', 'Port de Ningbo–Zhoushan', 'aggregate', 121.9, 29.95, 'Hub de vrac, conteneurs et industrie lourde de la façade est.', { goodsCapacity: 9, infrastructureCapacity: 10, nationalReach: 9, governanceRisk: 4, laborFriction: 2, capabilities: ['general_cargo', 'solid_bulk', 'liquid_hydrocarbons'] }),
  p('shenzhen-yantian', 'CHN', 'Ports de Shenzhen–Yantian', 'aggregate', 114.27, 22.58, 'Porte exportatrice du delta de la rivière des Perles.', { goodsCapacity: 9, infrastructureCapacity: 10, nationalReach: 9, governanceRisk: 4, laborFriction: 2 }),
  p('guangzhou', 'CHN', 'Port de Guangzhou–Nansha', 'aggregate', 113.5, 22.8, 'Port industriel et fluvial de la Chine méridionale.', { goodsCapacity: 8, infrastructureCapacity: 9, nationalReach: 9, governanceRisk: 4, laborFriction: 2, capabilities: ['general_cargo', 'solid_bulk', 'liquid_hydrocarbons'] }),
  p('qingdao', 'CHN', 'Port de Qingdao', 'aggregate', 120.32, 36.07, 'Grand port du Shandong et de la mer Jaune.', { goodsCapacity: 8, infrastructureCapacity: 9, nationalReach: 8, governanceRisk: 4, laborFriction: 2, capabilities: ['general_cargo', 'solid_bulk', 'liquid_hydrocarbons'] }),
  p('tianjin', 'CHN', 'Port de Tianjin', 'aggregate', 117.7, 38.98, 'Porte maritime de Pékin et du nord industriel.', { goodsCapacity: 8, infrastructureCapacity: 9, nationalReach: 9, governanceRisk: 4, laborFriction: 2 }),
  p('dalian', 'CHN', 'Port de Dalian', 'aggregate', 121.65, 38.92, 'Port industriel, pétrolier et naval du Liaoning.', { goodsCapacity: 7, infrastructureCapacity: 9, nationalReach: 8, governanceRisk: 4, laborFriction: 2, capabilities: ['general_cargo', 'liquid_hydrocarbons'] }),
  p('tokyo-yokohama', 'JPN', 'Complexe Tokyo–Yokohama', 'aggregate', 139.67, 35.45, 'Principal ensemble portuaire et économique japonais.', { goodsCapacity: 9, infrastructureCapacity: 10, nationalReach: 10, governanceRisk: 1, laborFriction: 2 }),
  p('nagoya', 'JPN', 'Port de Nagoya', 'aggregate', 136.88, 35.08, 'Port industriel et automobile du Chūbu.', { goodsCapacity: 8, infrastructureCapacity: 9, nationalReach: 9, governanceRisk: 1, laborFriction: 2 }),
  p('osaka-kobe', 'JPN', 'Complexe Osaka–Kobe', 'aggregate', 135.2, 34.67, 'Port industriel et commercial du Kansai.', { goodsCapacity: 8, infrastructureCapacity: 9, nationalReach: 9, governanceRisk: 1, laborFriction: 2, capabilities: ['general_cargo', 'liquid_hydrocarbons', 'passengers_ferries'] }),
  p('chiba', 'JPN', 'Port de Chiba', 'aggregate', 140.1, 35.58, 'Port énergétique et industriel de la baie de Tokyo.', { goodsCapacity: 7, infrastructureCapacity: 8, nationalReach: 9, governanceRisk: 1, laborFriction: 2, capabilities: ['general_cargo', 'liquid_hydrocarbons'] }),
  p('busan', 'KOR', 'Port de Busan', 'aggregate', 129.07, 35.1, 'Hub mondial de transbordement et principal port sud-coréen.', { goodsCapacity: 9, infrastructureCapacity: 10, nationalReach: 9, governanceRisk: 3, laborFriction: 3 }),
  p('incheon', 'KOR', 'Port d’Incheon', 'aggregate', 126.62, 37.45, 'Porte de Séoul et de la façade ouest.', { goodsCapacity: 7, infrastructureCapacity: 8, nationalReach: 9, governanceRisk: 3, laborFriction: 3 }),
  p('gwangyang', 'KOR', 'Port de Gwangyang', 'aggregate', 127.7, 34.9, 'Port sidérurgique et industriel du Sud.', { goodsCapacity: 7, infrastructureCapacity: 8, nationalReach: 8, governanceRisk: 3, laborFriction: 3, capabilities: ['general_cargo', 'solid_bulk', 'liquid_hydrocarbons'] }),
  p('ulsan', 'KOR', 'Port d’Ulsan', 'aggregate', 129.38, 35.53, 'Complexe automobile, pétrochimique et naval.', { goodsCapacity: 7, infrastructureCapacity: 8, nationalReach: 8, governanceRisk: 3, laborFriction: 3, capabilities: ['general_cargo', 'liquid_hydrocarbons'] }),
  p('nampo', 'PRK', 'Port de Nampo', 'aggregate', 125.4, 38.73, 'Principal port de la côte ouest nord-coréenne.', { goodsCapacity: 4, infrastructureCapacity: 6, nationalReach: 4, governanceRisk: 8, laborFriction: 4, developmentPotential: 4, capabilities: ['general_cargo', 'solid_bulk'] }),
  p('chongjin', 'PRK', 'Port de Chongjin', 'aggregate', 129.75, 41.8, 'Port industriel et métallurgique du Nord-Est.', { goodsCapacity: 4, infrastructureCapacity: 6, nationalReach: 3, governanceRisk: 8, laborFriction: 4, developmentPotential: 4, capabilities: ['general_cargo', 'solid_bulk'] }),
  p('kaohsiung', 'TWN', 'Port de Kaohsiung', 'aggregate', 120.28, 22.62, 'Principal hub industriel et conteneurisé de Taïwan.', { goodsCapacity: 8, infrastructureCapacity: 9, nationalReach: 9, governanceRisk: 3, laborFriction: 3, capabilities: ['general_cargo', 'liquid_hydrocarbons'] }),
  p('keelung', 'TWN', 'Port de Keelung', 'aggregate', 121.74, 25.13, 'Porte nord et port-capitale de Taïwan.', { goodsCapacity: 6, infrastructureCapacity: 8, nationalReach: 8, governanceRisk: 3, laborFriction: 3, capabilities: ['general_cargo', 'passengers_ferries'] }),
  p('taichung', 'TWN', 'Port de Taichung', 'aggregate', 120.5, 24.25, 'Port industriel de la côte ouest taïwanaise.', { goodsCapacity: 6, infrastructureCapacity: 8, nationalReach: 8, governanceRisk: 3, laborFriction: 3, capabilities: ['general_cargo', 'solid_bulk'] }),

  // Asie du Sud-Est et archipels
  p('ho-chi-minh', 'VNM', 'Ports de Hô Chi Minh–Cát Lái', 'aggregate', 106.75, 10.77, 'Principal hub commercial du Sud vietnamien.', { goodsCapacity: 7, infrastructureCapacity: 8, nationalReach: 7, governanceRisk: 6, laborFriction: 3 }),
  p('hai-phong', 'VNM', 'Port de Hải Phòng', 'aggregate', 106.68, 20.86, 'Porte industrielle et commerciale du Nord vietnamien.', { goodsCapacity: 6, infrastructureCapacity: 8, nationalReach: 7, governanceRisk: 6, laborFriction: 3 }),
  p('da-nang', 'VNM', 'Port de Đà Nẵng', 'aggregate', 108.2, 16.1, 'Port régional et relais du centre vietnamien.', { goodsCapacity: 4, infrastructureCapacity: 6, nationalReach: 5, governanceRisk: 6, capabilities: ['general_cargo', 'passengers_ferries'] }),
  p('laem-chabang', 'THA', 'Port de Laem Chabang', 'aggregate', 100.88, 13.08, 'Principal hub conteneurisé et industriel thaïlandais.', { goodsCapacity: 7, infrastructureCapacity: 9, nationalReach: 8, governanceRisk: 5, laborFriction: 3 }),
  p('bangkok-river', 'THA', 'Port de Bangkok–Chao Phraya', 'aggregate', 100.5, 13.72, 'Port fluvial et commercial de la capitale.', { goodsCapacity: 5, infrastructureCapacity: 7, nationalReach: 8, governanceRisk: 5, laborFriction: 3 }),
  p('map-ta-phut', 'THA', 'Port industriel de Map Ta Phut', 'aggregate', 101.17, 12.72, 'Complexe pétrochimique et énergétique de la côte Est.', { goodsCapacity: 6, infrastructureCapacity: 8, nationalReach: 7, governanceRisk: 5, capabilities: ['general_cargo', 'liquid_hydrocarbons'] }),
  p('port-klang', 'MYS', 'Port Klang', 'aggregate', 101.4, 3.0, 'Principal port commercial de Malaisie occidentale.', { goodsCapacity: 8, infrastructureCapacity: 9, nationalReach: 8, governanceRisk: 4, laborFriction: 3 }),
  p('tanjung-pelepas', 'MYS', 'Port de Tanjung Pelepas', 'aggregate', 103.55, 1.36, 'Hub de transbordement du détroit de Malacca.', { goodsCapacity: 7, infrastructureCapacity: 8, nationalReach: 7, governanceRisk: 4, laborFriction: 3 }),
  p('penang', 'MYS', 'Port de Penang', 'aggregate', 100.35, 5.42, 'Port industriel et commercial du Nord malaisien.', { goodsCapacity: 6, infrastructureCapacity: 8, nationalReach: 7, governanceRisk: 4, laborFriction: 3, capabilities: ['general_cargo', 'passengers_ferries'] }),
  p('bintulu', 'MYS', 'Port de Bintulu', 'aggregate', 113.05, 3.17, 'Terminal de GNL et d’hydrocarbures du Sarawak.', { goodsCapacity: 6, infrastructureCapacity: 8, nationalReach: 5, governanceRisk: 4, capabilities: ['general_cargo', 'liquid_hydrocarbons', 'lng'] }),
  p('singapore', 'SGP', 'Port de Singapour', 'aggregate', 103.85, 1.27, 'Mégahub mondial du détroit de Malacca.', { goodsCapacity: 10, infrastructureCapacity: 10, nationalReach: 10, governanceRisk: 1, laborFriction: 2, capabilities: ['general_cargo', 'liquid_hydrocarbons', 'lng', 'passengers_ferries'] }),
  p('tanjung-priok', 'IDN', 'Port de Tanjung Priok', 'aggregate', 106.88, -6.1, 'Principal port de Jakarta et de l’économie indonésienne.', { goodsCapacity: 7, infrastructureCapacity: 8, nationalReach: 7, governanceRisk: 6, laborFriction: 4 }),
  p('tanjung-perak', 'IDN', 'Port de Tanjung Perak', 'aggregate', 112.73, -7.2, 'Porte industrielle et commerciale de Java oriental.', { goodsCapacity: 6, infrastructureCapacity: 8, nationalReach: 7, governanceRisk: 6, laborFriction: 4 }),
  p('belawan', 'IDN', 'Port de Belawan', 'aggregate', 98.68, 3.78, 'Porte de Sumatra et du détroit de Malacca.', { goodsCapacity: 5, infrastructureCapacity: 7, nationalReach: 5, governanceRisk: 6, laborFriction: 4, capabilities: ['general_cargo', 'solid_bulk', 'liquid_hydrocarbons'] }),
  p('makassar', 'IDN', 'Port de Makassar', 'aggregate', 119.4, -5.13, 'Nœud maritime de l’Indonésie orientale.', { goodsCapacity: 5, infrastructureCapacity: 7, nationalReach: 5, governanceRisk: 6, laborFriction: 4, capabilities: ['general_cargo', 'passengers_ferries'] }),
  p('balikpapan', 'IDN', 'Port de Balikpapan', 'aggregate', 116.83, -1.27, 'Port pétrolier et industriel du Kalimantan.', { goodsCapacity: 5, infrastructureCapacity: 7, nationalReach: 4, governanceRisk: 6, laborFriction: 4, capabilities: ['general_cargo', 'liquid_hydrocarbons'] }),
  p('manila', 'PHL', 'Port de Manille', 'aggregate', 120.97, 14.6, 'Port-capitale et principal débouché philippin.', { goodsCapacity: 7, infrastructureCapacity: 8, nationalReach: 7, governanceRisk: 6, laborFriction: 4, capabilities: ['general_cargo', 'passengers_ferries'] }),
  p('batangas', 'PHL', 'Port de Batangas', 'aggregate', 121.05, 13.75, 'Port industriel et énergétique au sud de Manille.', { goodsCapacity: 5, infrastructureCapacity: 7, nationalReach: 6, governanceRisk: 6, laborFriction: 4, capabilities: ['general_cargo', 'liquid_hydrocarbons'] }),
  p('cebu', 'PHL', 'Port de Cebu', 'aggregate', 123.9, 10.3, 'Nœud commercial et passagers des Visayas.', { goodsCapacity: 5, infrastructureCapacity: 7, nationalReach: 5, governanceRisk: 6, laborFriction: 4, capabilities: ['general_cargo', 'passengers_ferries'] }),
  p('davao', 'PHL', 'Port de Davao', 'aggregate', 125.63, 7.08, 'Porte agricole et commerciale de Mindanao.', { goodsCapacity: 4, infrastructureCapacity: 6, nationalReach: 4, governanceRisk: 7, laborFriction: 4, capabilities: ['general_cargo', 'solid_bulk'] }),
  p('yangon', 'MMR', 'Port de Yangon–Thilawa', 'aggregate', 96.17, 16.77, 'Principal port fluvial et commercial du Myanmar.', { goodsCapacity: 5, infrastructureCapacity: 7, nationalReach: 5, governanceRisk: 7, laborFriction: 4 }),
  p('sihanoukville', 'KHM', 'Port de Sihanoukville', 'aggregate', 103.52, 10.63, 'Unique port en eau profonde du Cambodge.', { goodsCapacity: 4, infrastructureCapacity: 6, nationalReach: 4, governanceRisk: 6, laborFriction: 3, developmentPotential: 4 }),
  p('muara', 'BRN', 'Port de Muara', 'aggregate', 115.07, 5.02, 'Port commercial et énergétique du Brunei.', { goodsCapacity: 4, infrastructureCapacity: 6, nationalReach: 5, governanceRisk: 3, laborFriction: 2, capabilities: ['general_cargo', 'liquid_hydrocarbons'] }),
  p('dili', 'TLS', 'Port de Dili', 'aggregate', 125.57, -8.56, 'Port-capitale et approvisionnement du Timor oriental.', { goodsCapacity: 2, infrastructureCapacity: 4, nationalReach: 3, governanceRisk: 7, laborFriction: 4, developmentPotential: 5, capabilities: ['general_cargo', 'passengers_ferries'] }),
  p('port-moresby', 'PNG', 'Port Moresby', 'aggregate', 147.15, -9.47, 'Port-capitale et débouché du sud de la Papouasie.', { goodsCapacity: 3, infrastructureCapacity: 5, nationalReach: 3, governanceRisk: 6, laborFriction: 4, developmentPotential: 4, capabilities: ['general_cargo', 'passengers_ferries'] }),
  p('lae', 'PNG', 'Port de Lae', 'aggregate', 146.98, -6.73, 'Port industriel et minier de la côte nord.', { goodsCapacity: 4, infrastructureCapacity: 6, nationalReach: 4, governanceRisk: 6, laborFriction: 4, developmentPotential: 4, capabilities: ['general_cargo', 'solid_bulk'] }),
  // Façade asiatique de la Russie, complémentaire des ports européens.
  p('vladivostok', 'RUS', 'Port de Vladivostok', 'far-east', 131.9, 43.12, 'Porte russe du Pacifique et base navale d’Extrême-Orient.', { goodsCapacity: 6, infrastructureCapacity: 8, nationalReach: 5, governanceRisk: 6, laborFriction: 4, capabilities: ['general_cargo', 'solid_bulk', 'passengers_ferries'] }),
  p('vostochny', 'RUS', 'Port de Vostotchny–Nakhodka', 'far-east', 132.9, 42.75, 'Grand terminal de vrac et d’exportation du Primorié.', { goodsCapacity: 6, infrastructureCapacity: 8, nationalReach: 5, governanceRisk: 6, laborFriction: 4, capabilities: ['general_cargo', 'solid_bulk', 'liquid_hydrocarbons'] }),
];

const countryDefaults: Record<string, Pick<TerritorialPortProfile, 'nationalReach' | 'governanceRisk' | 'laborFriction' | 'developmentPotential'>> = {
  AFG: { nationalReach: 2, governanceRisk: 8, laborFriction: 4, developmentPotential: 5 }, ARE: { nationalReach: 8, governanceRisk: 3, laborFriction: 2, developmentPotential: 2 }, BGD: { nationalReach: 6, governanceRisk: 7, laborFriction: 4, developmentPotential: 4 }, BHR: { nationalReach: 6, governanceRisk: 5, laborFriction: 3, developmentPotential: 3 }, BRN: { nationalReach: 5, governanceRisk: 3, laborFriction: 2, developmentPotential: 2 }, CHN: { nationalReach: 9, governanceRisk: 4, laborFriction: 2, developmentPotential: 1 }, IDN: { nationalReach: 6, governanceRisk: 6, laborFriction: 4, developmentPotential: 4 }, IND: { nationalReach: 8, governanceRisk: 5, laborFriction: 3, developmentPotential: 3 }, IRN: { nationalReach: 7, governanceRisk: 6, laborFriction: 3, developmentPotential: 3 }, IRQ: { nationalReach: 3, governanceRisk: 8, laborFriction: 4, developmentPotential: 4 }, ISR: { nationalReach: 8, governanceRisk: 3, laborFriction: 3, developmentPotential: 2 }, JOR: { nationalReach: 5, governanceRisk: 5, laborFriction: 3, developmentPotential: 3 }, JPN: { nationalReach: 9, governanceRisk: 1, laborFriction: 2, developmentPotential: 1 }, KHM: { nationalReach: 4, governanceRisk: 6, laborFriction: 3, developmentPotential: 4 }, KOR: { nationalReach: 9, governanceRisk: 3, laborFriction: 3, developmentPotential: 2 }, KWT: { nationalReach: 7, governanceRisk: 5, laborFriction: 3, developmentPotential: 3 }, LBN: { nationalReach: 6, governanceRisk: 7, laborFriction: 4, developmentPotential: 4 }, LKA: { nationalReach: 6, governanceRisk: 5, laborFriction: 3, developmentPotential: 3 }, MMR: { nationalReach: 5, governanceRisk: 7, laborFriction: 4, developmentPotential: 4 }, MDV: { nationalReach: 4, governanceRisk: 4, laborFriction: 3, developmentPotential: 3 }, MYS: { nationalReach: 8, governanceRisk: 4, laborFriction: 3, developmentPotential: 2 }, OMN: { nationalReach: 6, governanceRisk: 4, laborFriction: 3, developmentPotential: 3 }, PAK: { nationalReach: 7, governanceRisk: 6, laborFriction: 4, developmentPotential: 4 }, PHL: { nationalReach: 6, governanceRisk: 6, laborFriction: 4, developmentPotential: 4 }, PNG: { nationalReach: 3, governanceRisk: 6, laborFriction: 4, developmentPotential: 4 }, PRK: { nationalReach: 4, governanceRisk: 8, laborFriction: 4, developmentPotential: 4 }, QAT: { nationalReach: 6, governanceRisk: 4, laborFriction: 3, developmentPotential: 2 }, RUS: { nationalReach: 6, governanceRisk: 6, laborFriction: 4, developmentPotential: 3 }, SAU: { nationalReach: 7, governanceRisk: 5, laborFriction: 3, developmentPotential: 2 }, SGP: { nationalReach: 10, governanceRisk: 1, laborFriction: 2, developmentPotential: 1 }, SYR: { nationalReach: 5, governanceRisk: 7, laborFriction: 4, developmentPotential: 4 }, THA: { nationalReach: 8, governanceRisk: 5, laborFriction: 3, developmentPotential: 3 }, TLS: { nationalReach: 3, governanceRisk: 7, laborFriction: 4, developmentPotential: 5 }, TWN: { nationalReach: 9, governanceRisk: 3, laborFriction: 3, developmentPotential: 2 }, VNM: { nationalReach: 7, governanceRisk: 6, laborFriction: 3, developmentPotential: 3 }, YEM: { nationalReach: 4, governanceRisk: 8, laborFriction: 4, developmentPotential: 4 },
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

function profileFor(entry: AsiaPortEntry): TerritorialPortProfile {
  const defaults = countryDefaults[entry.countryId] ?? { nationalReach: 5, governanceRisk: 6, laborFriction: 3, developmentPotential: 4 };
  const goodsCapacity = entry.goodsCapacity ?? 4;
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

function territoryForEntry(state: TerritorialState, entry: AsiaPortEntry) {
  const candidates = [`${entry.countryId}:${entry.territorySuffix}`, `${entry.countryId}:macro-${entry.territorySuffix}`, `${entry.countryId}:aggregate`];
  return candidates.find((id) => state.territories[id]);
}

/** Ajoute les ports asiatiques et migre un éventuel inventaire sans profil. */
export function addAsiaMajorPorts(state: TerritorialState): TerritorialState {
  const assets = { ...state.assets };
  for (const entry of asiaMajorPorts) {
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

export function asiaPortsForCountry(state: TerritorialState, countryId: string) {
  return Object.values(state.assets)
    .filter((asset) => asset.kind === 'port' && state.territories[asset.territoryId]?.sovereignCountryId === countryId)
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}

export function asiaPortOperationalCapacityForCountry(state: TerritorialState, countryId: string) {
  return Number(asiaPortsForCountry(state, countryId).reduce((sum, asset) => sum + (asset.portProfile ? effectivePortGoodsCapacity(asset.portProfile) : 0), 0).toFixed(2));
}
