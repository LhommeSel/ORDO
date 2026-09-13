import type { CapacityState, CountryState } from './types';
import type { NationalBaselineDescriptor } from './national-baseline-2000';

/**
 * Catalogue mondial de couverture. Les 95 lignes ci-dessous complètent les
 * fiches détaillées déjà présentes dans le prototype pour couvrir les 195
 * États membres de l'ONU et États observateurs au 1er janvier 2000. Taïwan
 * est ajouté séparément dans le noyau de gameplay comme entité politique
 * distincte, ce qui porte le registre jouable à 196 fiches.
 *
 * Ce n'est pas une base encyclopédique : les grands pays disposent de fiches
 * calibrées séparément. Ici, un archétype fournit un socle cohérent, stable et
 * remplaçable sans changer le moteur. Les valeurs issues de cet archétype sont
 * explicitement des valeurs de scénario, jamais une prétention de précision
 * statistique.
 */
export type GlobalCountryArchetype =
  | 'micro_europe'
  | 'small_europe'
  | 'small_open'
  | 'emerging'
  | 'large_emerging'
  | 'resource'
  | 'fragile'
  | 'authoritarian'
  | 'island'
  | 'rich_micro';

type GlobalCountrySeed = {
  id: string;
  name: string;
  alpha2: string;
  archetype: GlobalCountryArchetype;
};

const seeds: GlobalCountrySeed[] = `
ALB|Albanie|AL|small_europe
AND|Andorre|AD|micro_europe
ATG|Antigua-et-Barbuda|AG|island
ARM|Arménie|AM|emerging
AZE|Azerbaïdjan|AZ|resource
BHS|Bahamas|BS|small_open
BRB|Barbade|BB|small_open
BLZ|Belize|BZ|small_open
BEN|Bénin|BJ|fragile
BTN|Bhoutan|BT|fragile
BWA|Botswana|BW|resource
BRN|Brunei|BN|resource
BFA|Burkina Faso|BF|fragile
BDI|Burundi|BI|fragile
CPV|Cap-Vert|CV|island
CAN|Canada|CA|small_open
CAF|République centrafricaine|CF|fragile
TCD|Tchad|TD|resource
COM|Comores|KM|fragile
COG|République du Congo|CG|resource
CYP|Chypre|CY|small_open
DJI|Djibouti|DJ|resource
DMA|Dominique|DM|island
SLV|Salvador|SV|emerging
GNQ|Guinée équatoriale|GQ|resource
ERI|Érythrée|ER|authoritarian
SWZ|Eswatini|SZ|authoritarian
FJI|Fidji|FJ|island
GAB|Gabon|GA|resource
GMB|Gambie|GM|fragile
GEO|Géorgie|GE|emerging
GRD|Grenade|GD|island
GIN|Guinée|GN|fragile
GNB|Guinée-Bissau|GW|fragile
GUY|Guyana|GY|resource
HTI|Haïti|HT|fragile
HND|Honduras|HN|emerging
JAM|Jamaïque|JM|small_open
KIR|Kiribati|KI|island
KGZ|Kirghizistan|KG|fragile
LAO|Laos|LA|authoritarian
LVA|Lettonie|LV|small_europe
LSO|Lesotho|LS|fragile
LBR|Liberia|LR|fragile
LIE|Liechtenstein|LI|rich_micro
LTU|Lituanie|LT|small_europe
MDG|Madagascar|MG|fragile
MWI|Malawi|MW|fragile
MDV|Maldives|MV|island
MLI|Mali|ML|fragile
MLT|Malte|MT|small_open
MHL|Îles Marshall|MH|island
MRT|Mauritanie|MR|resource
MUS|Maurice|MU|small_open
FSM|Micronésie|FM|island
MDA|Moldavie|MD|emerging
MCO|Monaco|MC|rich_micro
MNG|Mongolie|MN|resource
MNE|Monténégro|ME|small_europe
NAM|Namibie|NA|resource
NRU|Nauru|NR|island
NPL|Népal|NP|fragile
NER|Niger|NE|fragile
PRK|Corée du Nord|KP|authoritarian
MKD|Macédoine du Nord|MK|emerging
OMN|Oman|OM|resource
PLW|Palaos|PW|island
PNG|Papouasie-Nouvelle-Guinée|PG|resource
PRY|Paraguay|PY|emerging
RWA|Rwanda|RW|authoritarian
KNA|Saint-Christophe-et-Niévès|KN|island
LCA|Sainte-Lucie|LC|island
VCT|Saint-Vincent-et-les-Grenadines|VC|island
WSM|Samoa|WS|island
SMR|Saint-Marin|SM|rich_micro
STP|Sao Tomé-et-Principe|ST|island
SYC|Seychelles|SC|small_open
SLE|Sierra Leone|SL|fragile
SVK|Slovaquie|SK|small_europe
SVN|Slovénie|SI|small_europe
SLB|Îles Salomon|SB|island
SOM|Somalie|SO|fragile
SSD|Soudan du Sud|SS|fragile
LKA|Sri Lanka|LK|emerging
SUR|Suriname|SR|resource
TJK|Tadjikistan|TJ|fragile
TLS|Timor oriental|TL|fragile
TGO|Togo|TG|authoritarian
TON|Tonga|TO|island
TTO|Trinité-et-Tobago|TT|resource
TUV|Tuvalu|TV|island
VUT|Vanuatu|VU|island
VAT|Vatican|VA|rich_micro
ZMB|Zambie|ZM|resource
PSE|Palestine|PS|fragile
`.trim().split('\n').map((line) => {
  const [id, name, alpha2, archetype] = line.split('|');
  return { id, name, alpha2, archetype: archetype as GlobalCountryArchetype } satisfies GlobalCountrySeed;
});

type ArchetypeProfile = {
  scale: number;
  gdp: number;
  population: number;
  growth: number;
  populationGrowth: number;
  inflation: number;
  unemployment: number;
  industry: number;
  openness: number;
  confidence: number;
  stability: number;
  security: number;
  orientation: NationalBaselineDescriptor['orientation'];
  regime: string;
  government: string;
  interests: string[];
  vulnerabilities: string[];
};

const archetypes: Record<GlobalCountryArchetype, ArchetypeProfile> = {
  micro_europe: { scale: 22, gdp: 2.4, population: 0.75, growth: 3.0, populationGrowth: 0.4, inflation: 2.1, unemployment: 7.5, industry: 22, openness: 82, confidence: 86, stability: 73, security: 56, orientation: 'liberal', regime: 'Micro-État parlementaire', government: 'Gouvernement de coalition', interests: ['Préserver la stabilité et l’ouverture régionale'], vulnerabilities: ['Petite échelle économique', 'Dépendance aux voisins'] },
  small_europe: { scale: 34, gdp: 18, population: 4.8, growth: 4.0, populationGrowth: -0.2, inflation: 3.0, unemployment: 10.5, industry: 30, openness: 76, confidence: 78, stability: 62, security: 58, orientation: 'transition', regime: 'République parlementaire', government: 'Coalition parlementaire de transition', interests: ['Ancrer l’État dans les institutions européennes', 'Moderniser l’économie'], vulnerabilities: ['Transition post-socialiste', 'Dépendance commerciale'] },
  small_open: { scale: 31, gdp: 12, population: 2.1, growth: 3.5, populationGrowth: 0.8, inflation: 4.0, unemployment: 9, industry: 24, openness: 78, confidence: 72, stability: 59, security: 52, orientation: 'liberal', regime: 'République parlementaire', government: 'Gouvernement civil', interests: ['Attirer les capitaux et les visiteurs', 'Maintenir l’accès aux marchés'], vulnerabilities: ['Petite économie ouverte', 'Exposition aux chocs extérieurs'] },
  emerging: { scale: 39, gdp: 28, population: 12, growth: 4.8, populationGrowth: 1.7, inflation: 6.5, unemployment: 12, industry: 23, openness: 48, confidence: 56, stability: 48, security: 43, orientation: 'transition', regime: 'République présidentielle en consolidation', government: 'Coalition gouvernementale', interests: ['Industrialiser et diversifier les exportations', 'Consolider l’État'], vulnerabilities: ['Institutions inégales', 'Dépendance aux matières premières', 'Chômage'] },
  large_emerging: { scale: 54, gdp: 96, population: 54, growth: 5.1, populationGrowth: 1.4, inflation: 7.5, unemployment: 10, industry: 34, openness: 52, confidence: 59, stability: 49, security: 48, orientation: 'nationalist', regime: 'République présidentielle', government: 'Coalition nationale', interests: ['Accélérer l’industrialisation', 'Accroître l’autonomie stratégique'], vulnerabilities: ['Inégalités régionales', 'Pression démographique', 'Vulnérabilité financière'] },
  resource: { scale: 42, gdp: 32, population: 8.5, growth: 4.2, populationGrowth: 2.0, inflation: 8, unemployment: 13, industry: 36, openness: 58, confidence: 52, stability: 43, security: 47, orientation: 'nationalist', regime: 'République présidentielle à économie de rente', government: 'Appareil présidentiel et réseaux économiques', interests: ['Monétiser les ressources naturelles', 'Préserver le contrôle des actifs stratégiques'], vulnerabilities: ['Dépendance aux matières premières', 'Volatilité des prix', 'Diversification limitée'] },
  fragile: { scale: 25, gdp: 7, population: 10, growth: 2.8, populationGrowth: 2.5, inflation: 10, unemployment: 22, industry: 15, openness: 34, confidence: 32, stability: 27, security: 29, orientation: 'fragile', regime: 'République fragile', government: 'Administration centrale et coalitions locales', interests: ['Préserver l’unité territoriale', 'Obtenir des financements et des infrastructures'], vulnerabilities: ['Pauvreté et capacité administrative faible', 'Insécurité intérieure', 'Dépendance à l’aide'] },
  authoritarian: { scale: 34, gdp: 15, population: 15, growth: 3.4, populationGrowth: 1.8, inflation: 7, unemployment: 13, industry: 23, openness: 31, confidence: 36, stability: 44, security: 55, orientation: 'party_state', regime: 'République autoritaire à appareil centralisé', government: 'Présidence et appareil sécuritaire', interests: ['Préserver le régime', 'Maintenir la souveraineté politique'], vulnerabilities: ['Isolement diplomatique', 'Risque de succession', 'Économie administrée'] },
  island: { scale: 23, gdp: 3.2, population: 0.9, growth: 3.2, populationGrowth: 1.2, inflation: 4.5, unemployment: 12, industry: 16, openness: 64, confidence: 55, stability: 53, security: 42, orientation: 'transition', regime: 'République insulaire', government: 'Gouvernement insulaire et coalition parlementaire', interests: ['Garantir les liaisons et l’approvisionnement', 'Développer le tourisme et les services'], vulnerabilities: ['Éloignement logistique', 'Marché intérieur étroit', 'Exposition climatique'] },
  rich_micro: { scale: 29, gdp: 18, population: 0.18, growth: 3.2, populationGrowth: 0.2, inflation: 2, unemployment: 4, industry: 25, openness: 92, confidence: 94, stability: 86, security: 62, orientation: 'liberal', regime: 'Micro-État constitutionnel', government: 'Conseil gouvernemental', interests: ['Protéger la place financière et la souveraineté', 'Préserver la neutralité'], vulnerabilities: ['Dépendance à quelques secteurs', 'Exposition aux pressions extérieures'] },
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Stable variation: same country, same inputs, same initial world. */
function variation(id: string, amplitude: number) {
  let value = 17;
  for (let index = 0; index < id.length; index += 1) value = (value * 31 + id.charCodeAt(index)) % 997;
  return ((value % 201) / 100 - 1) * amplitude;
}

function flagFromAlpha2(alpha2: string) {
  return alpha2.toUpperCase().split('').map((character) => String.fromCodePoint(127397 + character.charCodeAt(0))).join('');
}

function descriptorFromSeed(seed: GlobalCountrySeed): NationalBaselineDescriptor {
  const base = archetypes[seed.archetype];
  const factor = 1 + variation(seed.id, 0.18);
  const gdp = Math.max(0.4, Number((base.gdp * factor).toFixed(2)));
  const population = Math.max(0.08, Number((base.population * (1 + variation(`${seed.id}:pop`, 0.22))).toFixed(3)));
  const growth = Number((base.growth + variation(`${seed.id}:growth`, 1.8)).toFixed(2));
  const populationGrowth = Number((base.populationGrowth + variation(`${seed.id}:popgrowth`, 0.8)).toFixed(2));
  const inflation = Number(Math.max(-2, base.inflation + variation(`${seed.id}:inflation`, 3)).toFixed(2));
  const unemployment = Number(clamp(base.unemployment + variation(`${seed.id}:unemployment`, 4), 1, 55).toFixed(2));
  const industry = Math.round(clamp(base.industry + variation(`${seed.id}:industry`, 9), 8, 65));
  const openness = Math.round(clamp(base.openness + variation(`${seed.id}:openness`, 10), 15, 96));
  const confidence = Math.round(clamp(base.confidence + variation(`${seed.id}:confidence`, 8), 12, 96));
  const stability = Math.round(clamp(base.stability + variation(`${seed.id}:stability`, 9), 10, 92));
  const security = Math.round(clamp(base.security + variation(`${seed.id}:security`, 9), 10, 90));
  return {
    id: seed.id, name: seed.name, flag: flagFromAlpha2(seed.alpha2), leader: base.regime.includes('autoritaire') ? 'Direction nationale' : 'Chef du gouvernement',
    regime: base.regime, government: base.government, orientation: base.orientation, scale: Math.round(clamp(base.scale + variation(`${seed.id}:scale`, 5), 12, 82)),
    gdp, population, growth, populationGrowth, inflation, unemployment, industry, openness, confidence, stability, security,
    interests: base.interests, vulnerabilities: base.vulnerabilities, redLines: ['Atteinte à la souveraineté et à la continuité de l’État'], partners: [], rivals: [],
  };
}

export const globalNationalBaseline2000: NationalBaselineDescriptor[] = seeds.map(descriptorFromSeed);

function capacities(descriptor: NationalBaselineDescriptor): CapacityState {
  const base = Math.min(92, 30 + descriptor.scale * 0.76);
  const administration = Math.min(95, base + (descriptor.orientation === 'party_state' || descriptor.orientation === 'military' ? 8 : 0));
  return {
    government: { maximum: Math.round(base + 4), committed: Math.round(base * 0.48) }, administration: { maximum: Math.round(administration), committed: Math.round(administration * 0.52) },
    diplomacy: { maximum: Math.round(base + (descriptor.openness > 65 ? 10 : 0)), committed: Math.round(base * 0.42) }, economy: { maximum: Math.round(base + descriptor.industry * 0.12), committed: Math.round(base * 0.56) },
    intelligence: { maximum: Math.round(base + descriptor.security * 0.12), committed: Math.round(base * 0.45) }, defense: { maximum: Math.round(base + descriptor.security * 0.15), committed: Math.round(base * 0.58) },
  };
}

const doctrine = (orientation: NationalBaselineDescriptor['orientation']) => ({
  liberal: { economic: 30, social: -4, sovereignty: 28, security: 22 }, social: { economic: 4, social: 30, sovereignty: 16, security: 16 }, nationalist: { economic: 8, social: 0, sovereignty: 58, security: 52 }, party_state: { economic: 12, social: -20, sovereignty: 76, security: 66 }, military: { economic: 4, social: -8, sovereignty: 72, security: 82 }, monarchy: { economic: 18, social: -38, sovereignty: 58, security: 62 }, theocratic: { economic: -4, social: -58, sovereignty: 82, security: 76 }, fragile: { economic: 0, social: 14, sovereignty: 42, security: 42 }, transition: { economic: 18, social: 14, sovereignty: 32, security: 34 },
}[orientation]);

export function createGlobalBaselineCountries2000(): Record<string, CountryState> {
  return Object.fromEntries(globalNationalBaseline2000.map((descriptor) => {
    const d = doctrine(descriptor.orientation);
    const seats = descriptor.scale >= 55 ? 500 : descriptor.scale >= 35 ? 300 : 180;
    const governingSeats = descriptor.orientation === 'transition' || descriptor.orientation === 'liberal' ? Math.round(seats * 0.53) : Math.round(seats * 0.72);
    return [descriptor.id, {
      id: descriptor.id, name: descriptor.name, flag: descriptor.flag, weight: descriptor.scale, statisticalReliability: 52,
      metrics: { budget: Math.max(18, Math.round(descriptor.gdp * 0.17)), industry: descriptor.industry, stability: descriptor.stability, security: descriptor.security }, capacities: capacities(descriptor),
      politics: { regime: descriptor.regime, executive: descriptor.leader, headOfGovernment: descriptor.leader, governmentLabel: descriptor.government, legislatureSeats: seats, governingSeats, publicApproval: Math.round((descriptor.stability + descriptor.security) / 2), administrativeCompliance: Math.round(Math.min(92, descriptor.stability + (descriptor.orientation === 'party_state' ? 18 : 4))), doctrine: d },
      strategy: { goals: descriptor.interests.map((label, index) => ({ id: `${descriptor.id.toLowerCase()}-goal-${index + 1}`, label, priority: index === 0 ? 88 : 72, progress: 32, status: 'active' as const })), vulnerabilities: descriptor.vulnerabilities, redLines: descriptor.redLines, partners: [], rivals: [], lastReviewDate: '2000-01-01' },
    } satisfies CountryState];
  }));
}
