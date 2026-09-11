import type {
  CountryId,
  CountryState,
  ISODate,
  NationalReformDomain,
  NationalReformOutcome,
  NationalReformState,
  WorldEffect,
  WorldState,
} from './types';

const clamp = (value: number, minimum = 0, maximum = 100) => Math.min(maximum, Math.max(minimum, value));
const round = (value: number) => Number(value.toFixed(2));
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr');

export type NationalReformOption = {
  id: string;
  domain: NationalReformDomain;
  title: string;
  summary: string;
  targetPosition: number;
  durationMonths: number;
  budgetCost: number;
  intensity: 'modérée' | 'forte';
};

export const nationalReformOptions: NationalReformOption[] = [
  { id: 'religious-neutrality', domain: 'religion', title: 'Renforcer la neutralité de l’État', summary: 'Clarifier les règles communes et limiter les exceptions confessionnelles dans les services publics.', targetPosition: 78, durationMonths: 12, budgetCost: 4.5, intensity: 'forte' },
  { id: 'religious-accommodation', domain: 'religion', title: 'Élargir la reconnaissance des autorités religieuses', summary: 'Accorder davantage de place aux représentants confessionnels dans le dialogue public et certains services.', targetPosition: 38, durationMonths: 12, budgetCost: 3.5, intensity: 'modérée' },
  { id: 'immigration-integration', domain: 'immigration', title: 'Pacte d’intégration et de travail', summary: 'Accélérer la langue, l’accès à l’emploi et la naturalisation sous conditions vérifiables.', targetPosition: 68, durationMonths: 15, budgetCost: 5.5, intensity: 'forte' },
  { id: 'immigration-restriction', domain: 'immigration', title: 'Resserrement des admissions', summary: 'Réduire les admissions, renforcer les contrôles et concentrer l’effort sur les filières jugées prioritaires.', targetPosition: 28, durationMonths: 9, budgetCost: 4, intensity: 'forte' },
  { id: 'societal-rights', domain: 'societal', title: 'Extension des droits civils', summary: 'Étendre les protections individuelles et l’égalité juridique, avec une mise en œuvre progressive.', targetPosition: 76, durationMonths: 15, budgetCost: 4.5, intensity: 'forte' },
  { id: 'societal-order', domain: 'societal', title: 'Priorité à l’ordre public et à la famille', summary: 'Renforcer les obligations communes et les politiques familiales, au prix de contraintes sociales plus visibles.', targetPosition: 32, durationMonths: 12, budgetCost: 3.5, intensity: 'modérée' },
];

const explicitPositions: Record<string, Partial<Record<NationalReformDomain, number>>> = {
  FRA: { religion: 78, immigration: 55, societal: 63 }, DEU: { religion: 58, immigration: 48, societal: 52 }, ITA: { religion: 55, immigration: 39, societal: 50 }, ESP: { religion: 62, immigration: 43, societal: 56 }, GBR: { religion: 56, immigration: 48, societal: 60 }, DZA: { religion: 28, immigration: 36, societal: 27 }, USA: { religion: 51, immigration: 65, societal: 63 }, RUS: { religion: 38, immigration: 30, societal: 35 }, CHN: { religion: 30, immigration: 20, societal: 25 }, JPN: { religion: 60, immigration: 22, societal: 45 }, IND: { religion: 39, immigration: 30, societal: 36 }, TUR: { religion: 38, immigration: 35, societal: 34 }, VNM: { religion: 34, immigration: 25, societal: 29 }, BRA: { religion: 46, immigration: 49, societal: 54 }, ZAF: { religion: 48, immigration: 52, societal: 57 }, AUS: { religion: 58, immigration: 56, societal: 62 },
};

function heuristicPosition(country: CountryState, domain: NationalReformDomain) {
  const descriptor = normalize(`${country.politics.regime} ${country.politics.governmentLabel}`);
  if (domain === 'religion') {
    if (/theocr|islamique|religieux|charia/.test(descriptor)) return 25;
    if (/parti unique|communiste|emirat/.test(descriptor)) return 34;
    return clamp(58 + country.politics.doctrine.social * 0.35);
  }
  if (domain === 'immigration') return clamp(45 + country.politics.doctrine.social * 0.18 + (country.weight > 70 ? 5 : 0));
  return clamp(52 + country.politics.doctrine.social * 0.35);
}

export function createNationalReforms2000(countries: Record<CountryId, CountryState>, date: ISODate = '2000-01-01') {
  const result: Record<string, NationalReformState> = {};
  for (const country of Object.values(countries)) {
    for (const domain of ['religion', 'immigration', 'societal'] as const) {
      const position = explicitPositions[country.id]?.[domain] ?? heuristicPosition(country, domain);
      const descriptor = normalize(`${country.politics.regime} ${country.politics.governmentLabel}`);
      const institutionalAnchor = clamp(34 + country.politics.administrativeCompliance * 0.32 + (/theocr|parti unique|emirat/.test(descriptor) ? 18 : 0));
      result[`${country.id}:${domain}`] = {
        countryId: country.id, domain, position: round(position), institutionalAnchor: round(institutionalAnchor),
        publicSalience: domain === 'immigration' ? 58 : 46, polarization: 12,
        implementationCapacity: round(clamp(country.politics.administrativeCompliance * 0.8 + country.capacities.administration.maximum * 0.2)),
        administrativeBurden: 18, reformCount: 0, activeProgramId: null, lastChangedAt: date,
      };
    }
  }
  return result;
}

export function reformStateKey(countryId: CountryId, domain: NationalReformDomain) { return `${countryId}:${domain}`; }

export function reformDomainFromText(text: string): NationalReformDomain | undefined {
  const value = normalize(text);
  if (/relig|laic|confession|eglise|culte/.test(value)) return 'religion';
  if (/immigr|migrat|asile|frontiere|naturalisation|integration/.test(value)) return 'immigration';
  if (/societ|famille|droits civils|ordre public|mœurs|moeurs|egalite/.test(value)) return 'societal';
  return undefined;
}

export function reformOptionForText(text: string, domain = reformDomainFromText(text)) {
  if (!domain) return undefined;
  const value = normalize(text);
  return nationalReformOptions.find((option) => {
    if (option.domain !== domain) return false;
    if (option.id === 'religious-neutrality') return /neutral|laic|secular/.test(value);
    if (option.id === 'religious-accommodation') return /reconnaissance|autorite relig|accommod|culte/.test(value);
    if (option.id === 'immigration-integration') return /integration|travail|langue|naturalisation/.test(value);
    if (option.id === 'immigration-restriction') return /restriction|resserr|controle|admission|fermer/.test(value);
    if (option.id === 'societal-rights') return /droit|egalite|protection|libert/.test(value);
    return /ordre|famille|obligation|tradition/.test(value);
  }) ?? nationalReformOptions.find((option) => option.domain === domain);
}

export function reformPositionLabel(domain: NationalReformDomain, position: number) {
  if (domain === 'religion') return position >= 68 ? 'État fortement neutre' : position >= 48 ? 'Neutralité négociée' : 'Références religieuses fortes';
  if (domain === 'immigration') return position >= 68 ? 'Ouverture encadrée et intégration' : position >= 45 ? 'Gestion intermédiaire' : 'Admissions fortement resserrées';
  return position >= 68 ? 'Droits civils étendus' : position >= 45 ? 'Compromis sociétal' : 'Ordre public et normes traditionnelles';
}

export function nationalReformSupport(state: WorldState, domain: NationalReformDomain, targetPosition: number, countryId = state.playerCountryId) {
  const country = state.countries[countryId];
  if (!country) return { score: 0, obstacles: ['Le pays porteur de la réforme est absent du monde simulé.'] };
  const reform = state.nationalReforms?.[reformStateKey(country.id, domain)];
  if (!reform) return { score: 35, obstacles: ['Profil de réforme absent de cette ancienne sauvegarde.'] };
  const ideal = clamp(50 + country.politics.doctrine.social * 0.45);
  const distance = Math.abs(targetPosition - reform.position);
  const ideologicalDistance = Math.abs(targetPosition - ideal);
  const score = Math.round(clamp(78 - distance * 0.42 - ideologicalDistance * 0.18 - reform.institutionalAnchor * 0.12 - reform.polarization * 0.22 + reform.implementationCapacity * 0.08));
  const obstacles: string[] = [];
  if (ideologicalDistance > 24) obstacles.push('La ligne du gouvernement est éloignée de la réforme proposée.');
  if (reform.institutionalAnchor > 62) obstacles.push('Des institutions et corps établis peuvent ralentir le changement.');
  if (reform.polarization > 35) obstacles.push('Le sujet est déjà fortement polarisé.');
  if (reform.implementationCapacity < 48) obstacles.push('L’administration manque de moyens pour appliquer rapidement la réforme.');
  return { score, obstacles };
}

export function nationalReformEffects(state: WorldState, intent: string, outcome: NationalReformOutcome, countryId = state.playerCountryId): WorldEffect[] {
  const country = state.countries[countryId];
  if (!country) return [];
  const domain = reformDomainFromText(intent);
  const option = reformOptionForText(intent, domain);
  const current = domain ? state.nationalReforms?.[reformStateKey(country.id, domain)] : undefined;
  if (!domain || !option || !current) return [];
  const delta = option.targetPosition - current.position;
  const factor = outcome === 'adopted' ? 1 : outcome === 'partial' ? 0.5 : 0;
  const position = round(current.position + delta * factor);
  const polarization = round(clamp(current.polarization + (outcome === 'stalled' ? 6 : Math.abs(delta) * (outcome === 'adopted' ? 0.42 : 0.25))));
  const stabilityDelta = outcome === 'adopted' ? round(0.8 - Math.abs(delta) * 0.022) : outcome === 'partial' ? round(0.25 - Math.abs(delta) * 0.012) : -0.55;
  const approvalDelta = outcome === 'adopted' ? round(0.4 - Math.abs(delta) * 0.012) : outcome === 'partial' ? -0.15 : -0.7;
  const dossierId = `reform-${country.id}-${domain}`;
  const title = `${country.name} · réforme ${domain === 'religion' ? 'religieuse' : domain === 'immigration' ? 'migratoire' : 'sociétale'}`;
  const summary = outcome === 'adopted' ? `${option.title} est mise en œuvre ; la position nationale évolue vers « ${reformPositionLabel(domain, position)} ».` : outcome === 'partial' ? `${option.title} n’est appliquée qu’en partie ; les oppositions maintiennent une forte incertitude.` : `La réforme « ${option.title} » se heurte aux institutions et reste bloquée.`;
  const effects: WorldEffect[] = [
    { kind: 'national_reform_patch', countryId: country.id, domain, patch: { position, polarization, administrativeBurden: round(clamp(current.administrativeBurden + (outcome === 'adopted' ? 4 : 2))), reformCount: current.reformCount + (outcome === 'stalled' ? 0 : 1), activeProgramId: null, lastOutcome: outcome, lastChangedAt: state.currentDate }, reason: summary, visibility: 'player' },
    { kind: 'politics_patch', countryId: country.id, patch: { publicApproval: clamp(country.politics.publicApproval + approvalDelta) }, reason: `La réaction de l’opinion à la réforme modifie l’approbation du gouvernement (${approvalDelta >= 0 ? '+' : ''}${approvalDelta}).`, visibility: 'player' },
    { kind: 'metric_delta', countryId: country.id, metric: 'stability', delta: stabilityDelta, reason: 'Le changement de normes sociales produit une friction temporaire mesurée par la stabilité.', visibility: 'player' },
  ];
  const existing = state.strategicDossiers[dossierId];
  if (!existing) effects.push({ kind: 'dossier_add', dossier: { id: dossierId, title, kind: 'political_transition', status: outcome === 'stalled' ? 'active' : 'deescalating', importance: 'moderate', actorIds: [country.id], regionTags: [], startedAt: state.currentDate, updatedAt: state.currentDate, phase: outcome === 'adopted' ? 'Mise en œuvre et réactions' : 'Arbitrage institutionnel', trend: outcome === 'stalled' ? 'escalating' : 'stable', publicSummary: summary, followed: true, autoTracked: false, commitments: [option.title], pendingDecisions: outcome === 'stalled' ? ['Choisir une voie de compromis, un dialogue ou un silence explicite.'] : [], relatedCurrentIds: [], relatedActionIds: [], entries: [{ id: `${dossierId}-opening`, date: state.currentDate, title: option.title, summary, importance: 'moderate', actorIds: [country.id], requiresDecision: outcome === 'stalled', visibility: 'player' }] }, reason: 'Une réforme nationale suffisamment structurante devient un dossier permanent.', visibility: 'player' });
  else effects.push({ kind: 'dossier_patch', dossierId, patch: { updatedAt: state.currentDate, phase: outcome === 'adopted' ? 'Mise en œuvre et réactions' : 'Arbitrage institutionnel', trend: outcome === 'stalled' ? 'escalating' : 'stable', status: outcome === 'stalled' ? 'active' : existing.status }, reason: 'Le dossier de réforme conserve les arbitrages et réactions successifs.', visibility: 'player' });
  effects.push({ kind: 'dossier_entry_add', dossierId, entry: { id: `${dossierId}-${state.currentDate}-${outcome}`, date: state.currentDate, title: option.title, summary, importance: 'moderate', actorIds: [country.id], requiresDecision: outcome === 'stalled', visibility: 'player' }, reason: 'Chaque étape de la réforme reste consultable dans son dossier.', visibility: 'player' });
  return effects;
}
