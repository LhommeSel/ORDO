/**
 * Read-only audit of the 2000 national baseline against World Bank WDI.
 * Run with: npx tsx scripts/verify-national-baseline.ts
 *
 * This is an audit helper, not part of the simulation runtime. ORDO values are
 * rounded scenario inputs; a mismatch is a review signal, not an automatic
 * instruction to overwrite gameplay data.
 */
import { nationalBaseline2000 } from '../lib/simulation/national-baseline-2000';

const indicators = {
  gdp: 'NY.GDP.MKTP.CD',
  population: 'SP.POP.TOTL',
  growth: 'NY.GDP.MKTP.KD.ZG',
  populationGrowth: 'SP.POP.GROW',
  inflation: 'FP.CPI.TOTL.ZG',
  unemployment: 'SL.UEM.TOTL.ZS',
  industry: 'NV.IND.TOTL.ZS',
} as const;

type Key = keyof typeof indicators;
type WdiRow = { countryiso3code?: string; value?: number | null };

async function readIndicator(indicator: string): Promise<Map<string, number>> {
  const url = `https://api.worldbank.org/v2/country/all/indicator/${indicator}?date=2000&format=json&per_page=400`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${indicator}: HTTP ${response.status}`);
  const payload = (await response.json()) as [unknown, WdiRow[]];
  return new Map(
    (payload[1] ?? [])
      .filter((row) => row.countryiso3code && row.value != null)
      .map((row) => [row.countryiso3code!, Number(row.value)]),
  );
}

function relativeGap(ordo: number, reference: number): number {
  const denominator = Math.max(Math.abs(reference), 0.25);
  return Math.abs(ordo - reference) / denominator;
}

const data = Object.fromEntries(
  await Promise.all(
    (Object.entries(indicators) as [Key, string][]).map(async ([key, indicator]) => [key, await readIndicator(indicator)]),
  ),
) as Record<Key, Map<string, number>>;

const toWorldBankUnits = (key: Key, value: number) => (key === 'gdp' ? value * 1e9 : key === 'population' ? value * 1e6 : value);

console.log(`Audit World Bank 2000 — ${nationalBaseline2000.length} fiches ORDO`);
for (const key of Object.keys(indicators) as Key[]) {
  let available = 0;
  let within25 = 0;
  let outliers = 0;
  for (const country of nationalBaseline2000) {
    const reference = data[key].get(country.id);
    if (reference == null) continue;
    available++;
    const gap = relativeGap(toWorldBankUnits(key, country[key]), reference);
    if (gap <= 0.25) within25++;
    if (gap > 0.5) outliers++;
  }
  console.log(`${key.padEnd(16)} disponible ${String(available).padStart(2)}/${nationalBaseline2000.length} | ±25% ${String(within25).padStart(2)} | >50% ${String(outliers).padStart(2)}`);
}

console.log('\nOutliers >50% (review only):');
for (const country of nationalBaseline2000) {
  const flags = (Object.keys(indicators) as Key[]).flatMap((key) => {
    const reference = data[key].get(country.id);
    if (reference == null) return [];
    const gap = relativeGap(toWorldBankUnits(key, country[key]), reference);
    return gap > 0.5 ? [`${key}=${country[key]} vs WB=${reference.toFixed(2)}`] : [];
  });
  if (flags.length) console.log(`${country.id}: ${flags.join('; ')}`);
}
