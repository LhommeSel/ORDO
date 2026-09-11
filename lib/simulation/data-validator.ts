import type { CountryState, MacroeconomicState } from './types';
import type { DefenseReference } from './country-sheet';

export type RegistryIssue = {
  severity: 'error' | 'warning';
  countryId?: string;
  field?: string;
  message: string;
};

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/**
 * Checks the invariant shared by every national fiche and the macro layer.
 * It is intentionally independent from the UI so imports, tests and future
 * save migrations can run the same audit before touching the simulation.
 */
export function validateCountryRegistry(
  countries: Record<string, CountryState>,
  macroEconomies: Record<string, MacroeconomicState>,
  options: { expectedMinimum?: number; defenseReferences?: Record<string, DefenseReference> } = {},
): RegistryIssue[] {
  const issues: RegistryIssue[] = [];
  const ids = Object.keys(countries);
  const expectedMinimum = options.expectedMinimum ?? 195;
  if (ids.length < expectedMinimum) issues.push({ severity: 'warning', message: `Registre incomplet : ${ids.length} pays, ${expectedMinimum} attendus.` });

  for (const country of Object.values(countries)) {
    const id = country.id;
    if (!id || id !== id.toUpperCase() || id.length !== 3) issues.push({ severity: 'error', countryId: id, field: 'id', message: 'Identifiant pays non conforme à un code ISO alpha-3.' });
    if (!country.name.trim()) issues.push({ severity: 'error', countryId: id, field: 'name', message: 'Nom de pays vide.' });
    for (const [field, value] of Object.entries({ weight: country.weight, reliability: country.statisticalReliability, budget: country.metrics.budget, industry: country.metrics.industry, stability: country.metrics.stability, security: country.metrics.security })) {
      if (!finite(value)) issues.push({ severity: 'error', countryId: id, field, message: 'Valeur non numérique ou non finie.' });
    }
    if (country.statisticalReliability < 0 || country.statisticalReliability > 100) issues.push({ severity: 'error', countryId: id, field: 'statisticalReliability', message: 'Fiabilité hors de l’intervalle 0–100.' });
    for (const partner of country.strategy.partners) {
      if (partner === id) issues.push({ severity: 'error', countryId: id, field: 'partners', message: 'Un pays ne peut pas être son propre partenaire.' });
      else if (!countries[partner]) issues.push({ severity: 'error', countryId: id, field: 'partners', message: `Partenaire inconnu : ${partner}.` });
    }
    for (const rival of country.strategy.rivals) {
      if (rival === id) issues.push({ severity: 'error', countryId: id, field: 'rivals', message: 'Un pays ne peut pas être son propre rival.' });
      else if (!countries[rival]) issues.push({ severity: 'error', countryId: id, field: 'rivals', message: `Rival inconnu : ${rival}.` });
    }
    if (!macroEconomies[id]) issues.push({ severity: 'error', countryId: id, field: 'macroEconomies', message: 'Fiche macro absente.' });
  }

  for (const [id, macro] of Object.entries(macroEconomies)) {
    if (!countries[id]) issues.push({ severity: 'error', countryId: id, field: 'countries', message: 'Fiche nationale absente pour cette fiche macro.' });
    for (const [field, value] of Object.entries({ gdp: macro.realGdpBillion2000Usd, population: macro.populationMillions, growth: macro.realGrowthAnnualPct, unemployment: macro.unemploymentPct, debt: macro.publicDebtPctGdp })) {
      if (!finite(value)) issues.push({ severity: 'error', countryId: id, field, message: 'Indicateur macro non numérique ou non fini.' });
    }
    if (macro.realGdpBillion2000Usd <= 0 || macro.populationMillions <= 0) issues.push({ severity: 'error', countryId: id, field: 'macro', message: 'PIB et population doivent être strictement positifs.' });
    if (macro.unemploymentPct < 0 || macro.unemploymentPct > 100) issues.push({ severity: 'error', countryId: id, field: 'unemploymentPct', message: 'Chômage hors de l’intervalle 0–100.' });
    if (macro.publicDebtPctGdp < 0) issues.push({ severity: 'error', countryId: id, field: 'publicDebtPctGdp', message: 'Dette publique négative.' });
  }

  for (const [id, defense] of Object.entries(options.defenseReferences ?? {})) {
    if (!countries[id]) issues.push({ severity: 'error', countryId: id, field: 'defenseReference', message: 'Référence militaire attachée à un pays inconnu.' });
    for (const [field, value] of Object.entries({ budgetBillionUsd: defense.budgetBillionUsd, activePersonnelThousands: defense.activePersonnelThousands })) {
      if (!finite(value) || value < 0) issues.push({ severity: 'error', countryId: id, field, message: 'Valeur militaire négative, non numérique ou non finie.' });
    }
    for (const [field, value] of Object.entries({ combatAvailabilityPct: defense.combatAvailabilityPct, sustainableProjectionPct: defense.sustainableProjectionPct })) {
      if (value !== undefined && (!finite(value) || value < 0 || value > 100)) issues.push({ severity: 'error', countryId: id, field, message: 'Part militaire hors de l’intervalle 0–100.' });
    }
    const unitTotal = defense.unitTypes?.reduce((total, unit, index) => {
      if (!unit.id.trim() || !unit.label.trim()) issues.push({ severity: 'error', countryId: id, field: `defense.unitTypes[${index}]`, message: 'Type d’unité sans identifiant ou libellé.' });
      if (!finite(unit.personnelThousands) || unit.personnelThousands < 0) issues.push({ severity: 'error', countryId: id, field: `defense.unitTypes[${index}].personnelThousands`, message: 'Effectif d’unité invalide.' });
      if (!finite(unit.quality) || unit.quality < 0 || unit.quality > 100) issues.push({ severity: 'error', countryId: id, field: `defense.unitTypes[${index}].quality`, message: 'Qualité d’unité hors de l’intervalle 0–100.' });
      return total + (finite(unit.personnelThousands) ? unit.personnelThousands : 0);
    }, 0) ?? 0;
    if (unitTotal > defense.activePersonnelThousands + 0.01) issues.push({ severity: 'error', countryId: id, field: 'defense.unitTypes', message: 'Les types d’unités dépassent les effectifs actifs.' });
    else if (defense.unitTypes?.length && Math.abs(unitTotal - defense.activePersonnelThousands) > 0.1) issues.push({ severity: 'warning', countryId: id, field: 'defense.unitTypes', message: 'Les types d’unités ne couvrent pas exactement les effectifs actifs.' });
    const deploymentLocations = new Set<string>();
    const deploymentTotal = defense.deployments?.reduce((total, deployment, index) => {
      if (!deployment.location.trim() || deploymentLocations.has(deployment.location)) issues.push({ severity: 'error', countryId: id, field: `defense.deployments[${index}].location`, message: 'Théâtre militaire vide ou dupliqué.' });
      deploymentLocations.add(deployment.location);
      if (!finite(deployment.personnelThousands) || deployment.personnelThousands < 0) issues.push({ severity: 'error', countryId: id, field: `defense.deployments[${index}].personnelThousands`, message: 'Effectif de déploiement invalide.' });
      const breakdownIds = new Set<string>();
      const breakdownTotal = deployment.countryBreakdown?.reduce((subtotal, item, childIndex) => {
        if (!countries[item.countryId]) issues.push({ severity: 'error', countryId: id, field: `defense.deployments[${index}].countryBreakdown[${childIndex}]`, message: `Pays d’accueil inconnu : ${item.countryId}.` });
        if (breakdownIds.has(item.countryId)) issues.push({ severity: 'error', countryId: id, field: `defense.deployments[${index}].countryBreakdown`, message: `Pays d’accueil dupliqué : ${item.countryId}.` });
        breakdownIds.add(item.countryId);
        if (!finite(item.personnelThousands) || item.personnelThousands < 0) issues.push({ severity: 'error', countryId: id, field: `defense.deployments[${index}].countryBreakdown[${childIndex}].personnelThousands`, message: 'Effectif par pays invalide.' });
        return subtotal + (finite(item.personnelThousands) ? item.personnelThousands : 0);
      }, 0) ?? 0;
      if (breakdownTotal > deployment.personnelThousands + 0.01) issues.push({ severity: 'error', countryId: id, field: `defense.deployments[${index}].countryBreakdown`, message: 'La ventilation par pays dépasse l’effectif du théâtre.' });
      else if (deployment.countryBreakdown?.length && deployment.personnelThousands - breakdownTotal > 0.1) issues.push({ severity: 'warning', countryId: id, field: `defense.deployments[${index}].countryBreakdown`, message: 'La ventilation par pays est partielle.' });
      return total + (finite(deployment.personnelThousands) ? deployment.personnelThousands : 0);
    }, 0) ?? 0;
    if (deploymentTotal > defense.activePersonnelThousands + 0.01) issues.push({ severity: 'error', countryId: id, field: 'defense.deployments', message: 'Les déploiements dépassent les effectifs actifs.' });
    else if (defense.deployments?.length && Math.abs(deploymentTotal - defense.activePersonnelThousands) > 0.1) issues.push({ severity: 'warning', countryId: id, field: 'defense.deployments', message: 'Les déploiements ne couvrent pas exactement les effectifs actifs.' });
  }
  return issues;
}

export function assertValidCountryRegistry(
  countries: Record<string, CountryState>,
  macroEconomies: Record<string, MacroeconomicState>,
  options?: { expectedMinimum?: number; defenseReferences?: Record<string, DefenseReference> },
) {
  const issues = validateCountryRegistry(countries, macroEconomies, options);
  const errors = issues.filter((issue) => issue.severity === 'error');
  if (errors.length) throw new Error(`Registre national invalide (${errors.length} erreur(s)) : ${errors.slice(0, 3).map((issue) => issue.message).join(' ')}`);
  return issues;
}
