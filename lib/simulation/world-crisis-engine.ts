import { commitWorldAction } from './ledger';
import { seededUnit } from './random';
import type { CountryId, EconomicShock, ISODate, StrategicDossier, WorldCrisisActorPosture, WorldCrisisState, WorldEffect, WorldState } from './types';

type CrisisMode = WorldCrisisState['mode'];

type CrisisProfile = {
  dossierId: string;
  mode: CrisisMode;
  activatesAt: string;
  cadenceMonths: number;
  initial: Pick<WorldCrisisState, 'pressure' | 'cooperation' | 'materialStress' | 'politicalResolve'>;
  phases: { contested: string; hardening: string; coordination: string; stabilization: string };
};

type CrisisReading = {
  pressure: number;
  cooperation: number;
  materialStress: number;
  politicalResolve: number;
  driver: string;
  postures: WorldCrisisActorPosture[];
};

const clamp = (value: number, minimum = 0, maximum = 100) => Math.min(maximum, Math.max(minimum, value));
const round = (value: number, digits = 1) => Number(value.toFixed(digits));

const profiles: CrisisProfile[] = [
  {
    dossierId: 'world-russia-recentralization', mode: 'political_transition', activatesAt: '2000-04-01', cadenceMonths: 3,
    initial: { pressure: 52, cooperation: 38, materialStress: 32, politicalResolve: 63 },
    phases: { contested: 'Équilibre incertain entre centre et élites', hardening: 'Centralisation et résistance des élites', coordination: 'Compromis institutionnel sous surveillance', stabilization: 'Autorité fédérale stabilisée' },
  },
  {
    dossierId: 'world-southern-africa-consultation', mode: 'regional_cooperation', activatesAt: '2000-05-01', cadenceMonths: 3,
    initial: { pressure: 35, cooperation: 55, materialStress: 42, politicalResolve: 54 },
    phases: { contested: 'Coordination régionale à l’épreuve', hardening: 'Divergences régionales ouvertes', coordination: 'Coordination régionale opérationnelle', stabilization: 'Cadre régional consolidé' },
  },
  {
    dossierId: 'world-central-asia-transit', mode: 'resource_market', activatesAt: '2000-05-01', cadenceMonths: 3,
    initial: { pressure: 47, cooperation: 42, materialStress: 58, politicalResolve: 56 },
    phases: { contested: 'Concurrence entre corridors', hardening: 'Compétition pour les routes d’exportation', coordination: 'Accès aux corridors négocié', stabilization: 'Architecture de transit stabilisée' },
  },
  {
    dossierId: 'world-eastern-europe-choice', mode: 'regional_integration', activatesAt: '2000-06-01', cadenceMonths: 3,
    initial: { pressure: 49, cooperation: 53, materialStress: 35, politicalResolve: 62 },
    phases: { contested: 'Choix d’ancrage encore ouvert', hardening: 'Concurrence d’influences en Europe centrale', coordination: 'Rapprochement occidental structuré', stabilization: 'Ancrage institutionnel consolidé' },
  },
  {
    dossierId: 'world-middle-east-peace', mode: 'diplomatic_crisis', activatesAt: '2000-06-01', cadenceMonths: 2,
    initial: { pressure: 58, cooperation: 37, materialStress: 48, politicalResolve: 66 },
    phases: { contested: 'Négociation sous contraintes internes', hardening: 'Confiance politique en rupture', coordination: 'Désescalade sous médiation', stabilization: 'Accord limité consolidé' },
  },
  {
    dossierId: 'world-oil-market-balance', mode: 'resource_market', activatesAt: '2000-04-01', cadenceMonths: 2,
    initial: { pressure: 51, cooperation: 48, materialStress: 56, politicalResolve: 61 },
    phases: { contested: 'Arbitrage entre prix et volumes', hardening: 'Marché pétrolier durablement tendu', coordination: 'Ajustement concerté de l’offre', stabilization: 'Marché pétrolier stabilisé' },
  },
  {
    dossierId: 'world-strategic-defense-debate', mode: 'security_balance', activatesAt: '2000-07-01', cadenceMonths: 3,
    initial: { pressure: 52, cooperation: 35, materialStress: 30, politicalResolve: 68 },
    phases: { contested: 'Débat stratégique sans compromis', hardening: 'Polarisation des doctrines de dissuasion', coordination: 'Garanties stratégiques discutées', stabilization: 'Équilibre stratégique clarifié' },
  },
];

function addMonths(date: string, offset: number): ISODate {
  const [year, month] = date.slice(0, 7).split('-').map(Number);
  const absoluteMonth = year * 12 + month - 1 + offset;
  return `${Math.floor(absoluteMonth / 12)}-${String((absoluteMonth % 12) + 1).padStart(2, '0')}-01` as ISODate;
}

function monthsBetween(start: string, end: string) {
  const [startYear, startMonth] = start.slice(0, 7).split('-').map(Number);
  const [endYear, endMonth] = end.slice(0, 7).split('-').map(Number);
  return Math.max(0, (endYear - startYear) * 12 + endMonth - startMonth);
}

function relation(state: WorldState, from: CountryId, to: CountryId) {
  return state.relations[`${from}:${to}`]?.relation ?? state.relations[`${to}:${from}`]?.relation ?? 50;
}

function countryLabel(state: WorldState, countryId: CountryId) {
  return state.countries[countryId]?.name ?? countryId;
}

function posture(countryId: CountryId, stance: WorldCrisisActorPosture['stance'], summary: string): WorldCrisisActorPosture {
  return { countryId, stance, summary };
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 50;
}

/** Les variables sont tirées de l'état simulé ; le bruit n'est qu'un faible départage déterministe. */
function readCrisis(state: WorldState, dossier: StrategicDossier, profile: CrisisProfile): CrisisReading {
  const oil = state.worldEconomy.oilMarket;
  const noise = (seededUnit(state.seed, `${dossier.id}:${state.currentDate}:crisis`) - 0.5) * 5;
  const countryStability = (countryId: CountryId) => state.countries[countryId]?.metrics.stability ?? 50;
  const governmentCapacity = (countryId: CountryId) => state.countries[countryId]?.capacities.government.maximum ?? 50;

  switch (profile.dossierId) {
    case 'world-oil-market-balance': {
      const pressure = clamp(30 + (oil.demandIndex - oil.supplyIndex) * 1.55 + Math.max(0, 2 - oil.inventoryMonths) * 13 + oil.disruptionRisk * 0.58 + noise);
      const cooperation = clamp(62 - pressure * 0.26 + oil.spareCapacityPct * 0.24);
      return {
        pressure, cooperation, materialStress: clamp(oil.disruptionRisk + Math.max(0, oil.demandIndex - oil.supplyIndex) * 2.1), politicalResolve: 62,
        driver: `Demande ${oil.demandIndex.toFixed(0)}, offre ${oil.supplyIndex.toFixed(0)}, stocks ${oil.inventoryMonths.toFixed(1)} mois et risque ${oil.disruptionRisk.toFixed(0)}/100 déterminent l’arbitrage des producteurs.`,
        postures: [
          posture('SAU', pressure >= 62 ? 'harden' : 'coordinate', pressure >= 62 ? `${countryLabel(state, 'SAU')} privilégie le soutien des prix.` : `${countryLabel(state, 'SAU')} préserve une marge d’ajustement.`),
          posture('RUS', pressure >= 58 ? 'compete' : 'wait', pressure >= 58 ? `${countryLabel(state, 'RUS')} cherche à valoriser ses exportations.` : `${countryLabel(state, 'RUS')} observe les choix des autres producteurs.`),
          posture('USA', pressure >= 60 ? 'contain' : 'wait', pressure >= 60 ? `${countryLabel(state, 'USA')} surveille le coût pour les importateurs.` : `${countryLabel(state, 'USA')} ne force pas encore de réponse collective.`),
        ],
      };
    }
    case 'world-russia-recentralization': {
      const russia = state.countries.RUS;
      // Une forte capacité gouvernementale donne au centre les moyens d'agir ;
      // elle n'est pas, à elle seule, une crise. Les relations et la stabilité
      // font varier la trajectoire sans transformer janvier 2000 en rupture.
      const pressure = clamp(25 + (60 - countryStability('RUS')) * 0.26 + governmentCapacity('RUS') * 0.16 + (50 - average(['FRA', 'DEU', 'POL'].map((id) => relation(state, 'RUS', id))) * 0.1) + noise);
      const cooperation = clamp(54 - pressure * 0.28 + (russia?.politics.publicApproval ?? 50) * 0.14);
      return {
        pressure, cooperation, materialStress: clamp((60 - countryStability('RUS')) * 0.8), politicalResolve: clamp(governmentCapacity('RUS') * 0.85),
        driver: `Stabilité intérieure russe ${countryStability('RUS').toFixed(0)}/100, capacité gouvernementale ${governmentCapacity('RUS').toFixed(0)}/100 et relations européennes influencent la reprise en main.`,
        postures: [
          posture('RUS', pressure >= 62 ? 'harden' : 'coordinate', pressure >= 62 ? 'Le Kremlin renforce ses relais fédéraux.' : 'Le Kremlin recherche encore des compromis avec les élites.'),
          posture('DEU', cooperation >= 50 ? 'coordinate' : 'contain', cooperation >= 50 ? 'Berlin maintient un dialogue pragmatique.' : 'Berlin privilégie les garde-fous européens.'),
          posture('POL', pressure >= 58 ? 'contain' : 'wait', pressure >= 58 ? 'Varsovie demande des garanties de sécurité.' : 'Varsovie observe la transition russe.'),
        ],
      };
    }
    case 'world-eastern-europe-choice': {
      const candidates = ['POL', 'CZE', 'HUN', 'ROU', 'BGR'];
      const westernLink = average(candidates.map((id) => average([relation(state, id, 'FRA'), relation(state, id, 'DEU')])));
      const russiaLink = average(candidates.map((id) => relation(state, id, 'RUS')));
      const cooperation = clamp(28 + westernLink * 0.58 + average(candidates.map(countryStability)) * 0.16 + noise);
      const pressure = clamp(73 - cooperation * 0.52 + Math.max(0, 50 - russiaLink) * 0.35);
      return {
        pressure, cooperation, materialStress: clamp(100 - westernLink), politicalResolve: clamp(average(candidates.map((id) => governmentCapacity(id))) * 0.85),
        driver: `Les relations des candidats avec la France et l’Allemagne (${westernLink.toFixed(0)}/100) pèsent face au lien russe (${russiaLink.toFixed(0)}/100).`,
        postures: [
          posture('POL', cooperation >= 57 ? 'coordinate' : 'contain', cooperation >= 57 ? 'La Pologne accélère l’alignement institutionnel occidental.' : 'La Pologne réclame davantage de garanties.'),
          posture('DEU', cooperation >= 55 ? 'coordinate' : 'wait', cooperation >= 55 ? 'L’Allemagne soutient un rapprochement par les normes et les investissements.' : 'L’Allemagne temporise faute de consensus.'),
          posture('RUS', pressure >= 55 ? 'harden' : 'wait', pressure >= 55 ? 'La Russie conteste une perte d’influence stratégique.' : 'La Russie conserve une posture d’observation.'),
        ],
      };
    }
    case 'world-middle-east-peace': {
      const bilateral = relation(state, 'ISR', 'PSE');
      const pressure = clamp(82 - bilateral * 0.48 + (60 - average([countryStability('ISR'), countryStability('PSE')])) * 0.22 + noise);
      const cooperation = clamp(18 + bilateral * 0.56 + average([relation(state, 'USA', 'ISR'), relation(state, 'USA', 'PSE')]) * 0.12 - pressure * 0.12);
      return {
        pressure, cooperation, materialStress: clamp(100 - bilateral), politicalResolve: clamp(average([governmentCapacity('ISR'), governmentCapacity('PSE')])),
        driver: `La relation Israël–Palestine (${bilateral.toFixed(0)}/100), la stabilité intérieure et la crédibilité de la médiation déterminent la marge de négociation.`,
        postures: [
          posture('ISR', pressure >= 66 ? 'harden' : 'coordinate', pressure >= 66 ? 'Israël privilégie les garanties de sécurité.' : 'Israël accepte de tester un format de médiation.'),
          posture('PSE', pressure >= 66 ? 'harden' : 'coordinate', pressure >= 66 ? 'Les représentants palestiniens refusent des compromis jugés insuffisants.' : 'Les représentants palestiniens maintiennent le canal politique.'),
          posture('USA', cooperation >= 52 ? 'coordinate' : 'contain', cooperation >= 52 ? 'Washington soutient une séquence de médiation.' : 'Washington cherche d’abord à empêcher la rupture.'),
        ],
      };
    }
    case 'world-central-asia-transit': {
      const pressure = clamp(38 + Math.max(0, oil.demandIndex - oil.supplyIndex) * 1.1 + (55 - average(['KAZ', 'UZB', 'TKM'].map(countryStability))) * 0.34 + noise);
      const cooperation = clamp(58 - pressure * 0.3 + average([relation(state, 'KAZ', 'RUS'), relation(state, 'KAZ', 'CHN'), relation(state, 'KAZ', 'TUR')]) * 0.18);
      return {
        pressure, cooperation, materialStress: clamp(oil.disruptionRisk + 35), politicalResolve: clamp(average(['KAZ', 'UZB', 'TKM'].map((id) => governmentCapacity(id)))),
        driver: `La valeur du transit augmente avec le marché énergétique et la stabilité des États de la région.`,
        postures: [
          posture('KAZ', cooperation >= 52 ? 'coordinate' : 'compete', cooperation >= 52 ? 'Le Kazakhstan cherche des garanties d’accès diversifiées.' : 'Le Kazakhstan met les corridors en concurrence.'),
          posture('CHN', pressure >= 55 ? 'compete' : 'wait', pressure >= 55 ? 'La Chine propose financement et débouchés en échange d’un accès durable.' : 'La Chine observe les arbitrages régionaux.'),
          posture('RUS', pressure >= 52 ? 'harden' : 'coordinate', pressure >= 52 ? 'La Russie défend les réseaux existants.' : 'La Russie négocie des accès compatibles avec ses infrastructures.'),
        ],
      };
    }
    case 'world-southern-africa-consultation': {
      const regionalStability = average(['ZAF', 'NAM', 'BWA', 'MOZ', 'ZWE'].map(countryStability));
      const cooperation = clamp(28 + regionalStability * 0.62 + relation(state, 'ZAF', 'NAM') * 0.12 + noise);
      const pressure = clamp(70 - cooperation * 0.55 + (55 - regionalStability) * 0.25);
      return {
        pressure, cooperation, materialStress: clamp(100 - regionalStability), politicalResolve: clamp(governmentCapacity('ZAF') * 0.8),
        driver: `La stabilité régionale (${regionalStability.toFixed(0)}/100) et la capacité sud-africaine à coordonner conditionnent les consultations.`,
        postures: [
          posture('ZAF', cooperation >= 60 ? 'coordinate' : 'wait', cooperation >= 60 ? 'Pretoria investit dans une coordination pratique.' : 'Pretoria limite ses engagements faute de convergence.'),
          posture('NAM', cooperation >= 58 ? 'coordinate' : 'wait', cooperation >= 58 ? 'La Namibie soutient les arrangements de transit.' : 'La Namibie attend des garanties précises.'),
          posture('ZWE', pressure >= 54 ? 'compete' : 'coordinate', pressure >= 54 ? 'Le Zimbabwe défend d’abord ses marges nationales.' : 'Le Zimbabwe participe aux consultations.'),
        ],
      };
    }
    default: {
      const usaRussia = relation(state, 'USA', 'RUS');
      const pressure = clamp(76 - usaRussia * 0.42 + noise);
      const cooperation = clamp(22 + usaRussia * 0.47 - pressure * 0.1);
      return {
        pressure, cooperation, materialStress: clamp(80 - cooperation * 0.45), politicalResolve: 68,
        driver: `La relation États-Unis–Russie (${usaRussia.toFixed(0)}/100) fixe le niveau de polarisation stratégique.`,
        postures: [
          posture('USA', pressure >= 60 ? 'harden' : 'coordinate', pressure >= 60 ? 'Washington poursuit ses options technologiques.' : 'Washington explore des garanties limitées.'),
          posture('RUS', pressure >= 60 ? 'contain' : 'coordinate', pressure >= 60 ? 'Moscou conteste les conséquences pour la dissuasion.' : 'Moscou demande un cadre de vérification.'),
          posture('CHN', pressure >= 62 ? 'contain' : 'wait', pressure >= 62 ? 'Pékin réclame la préservation de l’équilibre stratégique.' : 'Pékin observe les discussions bilatérales.'),
        ],
      };
    }
  }
}

function phaseFor(profile: CrisisProfile, reading: Pick<WorldCrisisState, 'pressure' | 'cooperation'>) {
  if (reading.cooperation >= 72 && reading.pressure <= 35) return profile.phases.stabilization;
  if (reading.cooperation >= 60 && reading.pressure < 52) return profile.phases.coordination;
  if (reading.pressure >= 68) return profile.phases.hardening;
  return profile.phases.contested;
}

function importanceFor(dossier: StrategicDossier, pressure: number): StrategicDossier['importance'] {
  if (pressure >= 84) return 'critical';
  if (pressure >= 64) return 'major';
  return dossier.importance === 'major' || dossier.importance === 'critical' ? dossier.importance : 'moderate';
}

function postureSignature(postures: WorldCrisisActorPosture[]) {
  return postures.map((item) => `${item.countryId}:${item.stance}`).join('|');
}

function outcomeEffects(state: WorldState, dossier: StrategicDossier, crisis: WorldCrisisState): { effects: WorldEffect[]; applied: string[] } {
  const applied = [...crisis.appliedOutcomes];
  const effects: WorldEffect[] = [];
  const applyOnce = (id: string, build: () => WorldEffect[]) => {
    if (applied.includes(id)) return;
    applied.push(id);
    effects.push(...build());
  };
  const reason = (label: string) => `Conséquence durable de la crise mondiale « ${dossier.title} » : ${label}.`;

  if (dossier.id === 'world-oil-market-balance') {
    const shockId = 'world-crisis-oil-tightness';
    const active = state.worldEconomy.activeShocks.filter((shock) => shock.id !== shockId);
    if (crisis.pressure >= 66) {
      const shock: EconomicShock = { id: shockId, label: 'Marché pétrolier durablement tendu', channel: 'energy', intensity: round(12 + (crisis.pressure - 66) * 0.7), remainingMonths: 3, decayPerMonth: 0.1, affectedCountryIds: [], productFamily: 'energy', source: 'local_rule' };
      effects.push({ kind: 'world_economy_patch', patch: { activeShocks: [...active, shock] }, reason: reason('tension persistante sur l’offre pétrolière'), visibility: 'debug' });
    } else if (state.worldEconomy.activeShocks.some((shock) => shock.id === shockId)) {
      effects.push({ kind: 'world_economy_patch', patch: { activeShocks: active }, reason: reason('détente du marché pétrolier'), visibility: 'debug' });
    }
  }
  if (dossier.id === 'world-russia-recentralization' && crisis.pressure >= 72) applyOnce('russian-centralization', () => [
    { kind: 'relation_delta', from: 'RUS', to: 'FRA', relation: -4, trust: -5, reason: reason('centralisation russe plus affirmée') },
    { kind: 'relation_delta', from: 'RUS', to: 'DEU', relation: -3, trust: -4, reason: reason('centralisation russe plus affirmée') },
  ]);
  if (dossier.id === 'world-eastern-europe-choice' && crisis.cooperation >= 66) applyOnce('western-anchor', () => [
    { kind: 'relation_delta', from: 'FRA', to: 'POL', relation: 4, trust: 3, reason: reason('rapprochement institutionnel européen') },
    { kind: 'relation_delta', from: 'DEU', to: 'POL', relation: 4, trust: 3, reason: reason('rapprochement institutionnel européen') },
    { kind: 'relation_delta', from: 'RUS', to: 'POL', relation: -3, trust: -3, reason: reason('rééquilibrage européen perçu comme défavorable par Moscou') },
  ]);
  if (dossier.id === 'world-middle-east-peace' && crisis.pressure >= 72) applyOnce('peace-process-fracture', () => [
    { kind: 'relation_delta', from: 'ISR', to: 'PSE', relation: -7, trust: -8, reason: reason('rupture durable de confiance entre les parties') },
  ]);
  if (dossier.id === 'world-middle-east-peace' && crisis.cooperation >= 66) applyOnce('limited-mediation', () => [
    { kind: 'relation_delta', from: 'ISR', to: 'PSE', relation: 4, trust: 4, reason: reason('canal de médiation maintenu') },
  ]);
  if (dossier.id === 'world-central-asia-transit' && crisis.pressure >= 66) applyOnce('corridor-competition', () => [
    { kind: 'relation_delta', from: 'RUS', to: 'KAZ', relation: 3, trust: 1, reason: reason('compétition pour les corridors d’exportation') },
    { kind: 'relation_delta', from: 'CHN', to: 'KAZ', relation: 3, trust: 1, reason: reason('compétition pour les corridors d’exportation') },
  ]);
  if (dossier.id === 'world-southern-africa-consultation' && crisis.cooperation >= 65) applyOnce('southern-africa-coordination', () => [
    { kind: 'relation_delta', from: 'ZAF', to: 'NAM', relation: 3, trust: 3, reason: reason('coordination régionale durable') },
    { kind: 'relation_delta', from: 'ZAF', to: 'MOZ', relation: 3, trust: 3, reason: reason('coordination régionale durable') },
  ]);
  if (dossier.id === 'world-strategic-defense-debate' && crisis.pressure >= 70) applyOnce('strategic-polarization', () => [
    { kind: 'relation_delta', from: 'USA', to: 'RUS', relation: -5, trust: -5, reason: reason('polarisation sur les défenses antimissiles') },
    { kind: 'relation_delta', from: 'USA', to: 'CHN', relation: -4, trust: -4, reason: reason('polarisation sur les défenses antimissiles') },
  ]);
  return { effects, applied };
}

function initialCrisis(profile: CrisisProfile, state: WorldState): WorldCrisisState {
  const dossier = state.strategicDossiers[profile.dossierId];
  const reading = readCrisis(state, dossier, profile);
  return {
    mode: profile.mode,
    pressure: round((profile.initial.pressure + reading.pressure) / 2),
    cooperation: round((profile.initial.cooperation + reading.cooperation) / 2),
    materialStress: round((profile.initial.materialStress + reading.materialStress) / 2),
    politicalResolve: round((profile.initial.politicalResolve + reading.politicalResolve) / 2),
    actorPostures: reading.postures,
    lastDriverSummary: reading.driver,
    lastAdvancedAt: state.currentDate,
    nextReviewAt: addMonths(state.currentDate, profile.cadenceMonths),
    appliedOutcomes: [],
  };
}

/**
 * Fait vivre les crises mondiales sans produire de dialogue imposé ni de
 * décision artificielle pour le joueur. Les États prennent des postures, les
 * facteurs évoluent, et seules les bifurcations franchies appliquent un effet
 * durable au monde.
 */
export function advanceWorldCrises(state: WorldState) {
  let next = state;
  for (const profile of profiles) {
    const dossier = next.strategicDossiers[profile.dossierId];
    if (!dossier || dossier.status === 'resolved' || next.currentDate < profile.activatesAt) continue;
    const current = dossier.worldCrisisState;
    if (!current) {
      const crisis = initialCrisis(profile, next);
      next = commitWorldAction(next, {
        kind: 'historical', actorId: next.playerCountryId, targetIds: dossier.actorIds.filter((id): id is CountryId => id !== next.playerCountryId && Boolean(next.countries[id])), origin: 'historical', visibility: 'public',
        intent: `Ouvrir la boucle de crise mondiale « ${dossier.title} »`,
        effects: [{
          kind: 'dossier_patch', dossierId: dossier.id, patch: { worldCrisisState: crisis, updatedAt: next.currentDate },
          reason: 'Le dossier reçoit des indicateurs et postures autonomes plutôt qu’une suite prédéterminée.', visibility: 'debug',
        }],
      });
      continue;
    }
    if (next.currentDate < current.nextReviewAt || monthsBetween(current.lastAdvancedAt, next.currentDate) < profile.cadenceMonths) continue;
    const reading = readCrisis(next, dossier, profile);
    const crisis: WorldCrisisState = {
      ...current,
      pressure: round(current.pressure + (reading.pressure - current.pressure) * 0.52),
      cooperation: round(current.cooperation + (reading.cooperation - current.cooperation) * 0.48),
      materialStress: round(current.materialStress + (reading.materialStress - current.materialStress) * 0.55),
      politicalResolve: round(current.politicalResolve + (reading.politicalResolve - current.politicalResolve) * 0.4),
      actorPostures: reading.postures,
      lastDriverSummary: reading.driver,
      lastAdvancedAt: next.currentDate,
      nextReviewAt: addMonths(next.currentDate, profile.cadenceMonths),
    };
    const phase = phaseFor(profile, crisis);
    const importance = importanceFor(dossier, crisis.pressure);
    const trend: StrategicDossier['trend'] = crisis.cooperation >= 62 && crisis.pressure < 52
      ? 'deescalating' : crisis.pressure >= 61 ? 'escalating' : 'stable';
    const outcomes = outcomeEffects(next, dossier, crisis);
    crisis.appliedOutcomes = outcomes.applied;
    const previousSignature = postureSignature(current.actorPostures);
    const nextSignature = postureSignature(crisis.actorPostures);
    const materialChange = Math.abs(crisis.pressure - current.pressure) >= 3 || Math.abs(crisis.cooperation - current.cooperation) >= 3 || phase !== dossier.phase || previousSignature !== nextSignature;
    const postureText = crisis.actorPostures.map((item) => item.summary).join(' ');
    const summary = `${reading.driver} ${postureText}`;
    const effects: WorldEffect[] = [
      {
        kind: 'dossier_patch', dossierId: dossier.id,
        patch: { phase, importance, trend, publicSummary: summary, worldCrisisState: crisis, updatedAt: next.currentDate },
        reason: 'Les indicateurs et postures des acteurs font évoluer la crise mondiale.', visibility: 'public',
      },
      ...outcomes.effects,
    ];
    if (materialChange) effects.push({
      kind: 'dossier_entry_add', dossierId: dossier.id,
      entry: {
        id: `world-crisis-${dossier.id}-${next.currentDate}`, date: next.currentDate,
        title: phase, summary, importance, actorIds: dossier.actorIds, requiresDecision: false, visibility: 'public',
      },
      reason: 'La chronologie ne reçoit que les changements politiques ou matériels perceptibles.', visibility: 'public',
    });
    next = commitWorldAction(next, {
      kind: 'historical', actorId: next.playerCountryId, targetIds: dossier.actorIds.filter((id): id is CountryId => id !== next.playerCountryId && Boolean(next.countries[id])), origin: 'historical', visibility: 'public',
      intent: `Actualiser la crise mondiale « ${dossier.title} »`, effects,
    });
  }
  return next;
}
