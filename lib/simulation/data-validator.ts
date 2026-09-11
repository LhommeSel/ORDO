import type { CountryState, MacroeconomicState } from './types';

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
  options: { expectedMinimum?: number } = {},
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
  return issues;
}

export function assertValidCountryRegistry(
  countries: Record<string, CountryState>,
  macroEconomies: Record<string, MacroeconomicState>,
  options?: { expectedMinimum?: number },
) {
  const issues = validateCountryRegistry(countries, macroEconomies, options);
  const errors = issues.filter((issue) => issue.severity === 'error');
  if (errors.length) throw new Error(`Registre national invalide (${errors.length} erreur(s)) : ${errors.slice(0, 3).map((issue) => issue.message).join(' ')}`);
  return issues;
}
