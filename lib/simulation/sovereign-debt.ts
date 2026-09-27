import type {
  BankingSystemState,
  CountryId,
  MacroeconomicState,
  SovereignDebtState,
  SovereignDebtStatus,
  WorldEffect,
  WorldState,
} from './types';

const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));
const round = (value: number, digits = 3) => Number(value.toFixed(digits));
const transition = (speedPerYear: number, elapsedMonths: number) => 1 - Math.exp(-speedPerYear * elapsedMonths / 12);

export type DebtProjectionInputs = {
  publicDebtPctGdp: number;
  fiscalBalancePctGdp: number;
  policyRatePct: number;
  inflationAnnualPct: number;
  realGrowthAnnualPct: number;
  currentAccountPctGdp: number;
  foreignReserveMonthsImports: number;
  financialStress: number;
  unemploymentPct: number;
};

const statusRank: Record<SovereignDebtStatus, number> = {
  stable: 0, watch: 1, stressed: 2, refinancing_crisis: 3, restructuring: 4, default: 5,
};

function monetaryProtection(state: WorldState, countryId: CountryId, debt: SovereignDebtState) {
  const regime = state.structuralProfiles[countryId]?.monetaryRegime;
  const multiplier = regime === 'sovereign_floating' ? 1
    : regime === 'sovereign_managed' ? (debt.backstopCredibilityPct >= 70 ? 0.82 : 0.72)
      : regime === 'currency_union' ? 0.68 : 0.72;
  // Un prêteur en dernier ressort ne vaut que par sa crédibilité. La prime
  // d'union monétaire reste explicite, sans rendre les membres invulnérables.
  const credibilityAdjustment = (debt.backstopCredibilityPct - 50) * 0.08;
  const unionSupport = regime === 'currency_union' ? 8 : 0;
  return debt.centralBankBackstop * multiplier + credibilityAdjustment + unionSupport + (countryId === 'USA' ? 22 : 0);
}

function debtStatus(
  access: number,
  debtService: number,
  fundingGap: number,
  monthsUnderStress: number,
  missedPayments: number,
  publicDebtPctGdp: number,
  previousStatus: SovereignDebtStatus = 'stable',
): SovereignDebtStatus {
  if (previousStatus === 'restructuring') return 'restructuring';
  // Un défaut est un événement de paiement, pas la simple conséquence d'un
  // ratio dette/PIB élevé. Le modèle doit laisser le temps à un État de
  // renouveler sa dette, d'obtenir des prêts concessionnels ou de réduire son
  // déficit avant de constater des arriérés irréversibles.
  const arrearsDefault = missedPayments >= 4 && monthsUnderStress >= 24 && publicDebtPctGdp >= 130 && (fundingGap >= 14 || access < 18);
  // Cas d'insolvabilité manifeste : lorsque le besoin annuel dépasse très
  // largement les canaux de financement et que le marché est presque fermé,
  // quelques arriérés suffisent à constater le défaut, même si le stock
  // d'impayés n'a pas encore atteint 4 % du PIB.
  const fundingCrisisDefault = missedPayments >= 2 && monthsUnderStress >= 18 && publicDebtPctGdp >= 130 && fundingGap >= 12 && access < 40;
  const acuteFundingDefault = missedPayments >= 0.2 && monthsUnderStress >= 18 && publicDebtPctGdp >= 115 && fundingGap >= 10 && access < 50 && debtService >= 22;
  const acuteDefault = missedPayments >= 2.5 && monthsUnderStress >= 24 && publicDebtPctGdp >= 130 && access < 12 && fundingGap >= 8;
  const imminentDefault = publicDebtPctGdp >= 115 && monthsUnderStress >= 18 && fundingGap >= 6 && access < 55 && debtService >= 24;
  if (arrearsDefault || fundingCrisisDefault || acuteFundingDefault || acuteDefault || imminentDefault) return 'default';
  // Un signal de marché isolé n'est pas encore une crise : il faut une
  // tension persistante avant d'ouvrir un dossier majeur. Un écart de quelques
  // points de PIB peut encore être absorbé par le coussin de trésorerie et le
  // refinancement domestique.
  const persistentCrisis = monthsUnderStress >= 12 && (fundingGap >= 8 || access < 24);
  const continuingCrisis = previousStatus === 'refinancing_crisis' && monthsUnderStress >= 9 && (fundingGap >= 5 || access < 28);
  if (persistentCrisis || continuingCrisis) return 'refinancing_crisis';
  if (access < 30 || debtService >= 42 || fundingGap >= 6) return 'stressed';
  if (access < 60 || debtService >= 18 || fundingGap >= 2) return 'watch';
  return 'stable';
}

export function projectDebtAndBanking(
  state: WorldState,
  economy: MacroeconomicState,
  input: DebtProjectionInputs,
  elapsedMonths: number,
) {
  const debt = economy.sovereignDebt;
  const bank = economy.bankingSystem;
  const profile = state.structuralProfiles[economy.countryId];
  const protection = monetaryProtection(state, economy.countryId, debt);
  const foreignCurrencyShare = clamp(1 - debt.localCurrencySharePct / 100, 0, 1);
  // Une dette libellée dans sa propre monnaie, détenue par des investisseurs
  // domestiques et adossée à une banque centrale crédible ne se comporte pas
  // comme une dette en devises d'un État sans prêteur en dernier ressort. Ce
  // bouclier ne rend pas la dette gratuite : il amortit seulement le risque de
  // crise de liquidité (cas typique du Japon en 2000).
  const monetaryShield = clamp((debt.localCurrencySharePct / 100) * (protection / 100), 0, 1);
  const debtStockPenalty = 0.12 * (1 - monetaryShield * 0.72);
  const debtServicePenalty = 0.52 * (1 - monetaryShield * 0.55);
  const currencyMismatchPressure = foreignCurrencyShare * (
    Math.max(0, -input.currentAccountPctGdp) * 0.45
    + Math.max(0, input.inflationAnnualPct - state.worldEconomy.globalInflationAnnualPct) * 0.25
  );
  const previousSovereignStress = statusRank[debt.status] * 8;
  const bankContagion = bank.liquidityStress * debt.domesticBankExposurePctAssets / 100;
  const debtServiceAtCurrentRate = input.publicDebtPctGdp * debt.effectiveInterestRatePct / 100;
  const debtServicePctRevenue = debtServiceAtCurrentRate / Math.max(1, economy.publicRevenuePctGdp) * 100;
  const accessTarget = clamp(
    45 + (profile?.financialResilience ?? 50) * 0.35 + protection * 0.28
      + Math.min(12, input.foreignReserveMonthsImports) * 1.15
      + Math.max(0, input.currentAccountPctGdp) * 0.35
      + Math.max(0, input.realGrowthAnnualPct) * 0.5
      - Math.max(0, input.publicDebtPctGdp - 80) * debtStockPenalty
      - foreignCurrencyShare * 16 - currencyMismatchPressure
      - Math.max(0, debtServicePctRevenue - 8) * debtServicePenalty
      - Math.max(0, -input.fiscalBalancePctGdp) * 0.9
      - Math.max(0, -input.currentAccountPctGdp) * 0.6
      - input.financialStress * 0.24 - bankContagion * 0.4 - previousSovereignStress * 0.18,
    0, 100,
  );
  const marketAccess = debt.marketAccess + (accessTarget - debt.marketAccess) * transition(2.2, elapsedMonths);
  const spreadTarget = clamp(18 + state.worldEconomy.financialStress * 1.5 + Math.pow(Math.max(0, 78 - marketAccess), 2) * 0.72, 5, 5000);
  const sovereignSpreadBps = debt.sovereignSpreadBps + (spreadTarget - debt.sovereignSpreadBps) * transition(3.5, elapsedMonths);
  const baseFundingRate = Math.max(0.5, input.policyRatePct * 0.65 + state.worldEconomy.neutralInterestRatePct * 0.35);
  const currencyPremium = foreignCurrencyShare * Math.max(0, input.inflationAnnualPct - state.worldEconomy.globalInflationAnnualPct) * 0.06
    + Math.max(0, -input.currentAccountPctGdp) * 0.02;
  const marginalFundingRate = baseFundingRate + sovereignSpreadBps / 100 + currencyPremium;
  const repricingSpeed = 1 / Math.max(1, debt.averageMaturityYears);
  const fixedRateShare = clamp(debt.fixedRateSharePct / 100, 0.15, 0.95);
  const repricedShare = clamp((1 - fixedRateShare) + fixedRateShare * transition(repricingSpeed, elapsedMonths), 0.05, 1);
  const effectiveInterestRatePct = debt.effectiveInterestRatePct
    + (marginalFundingRate - debt.effectiveInterestRatePct) * transition(repricingSpeed * (0.35 + 0.65 * repricedShare), elapsedMonths);
  const annualMaturingDebtPctGdp = input.publicDebtPctGdp / Math.max(0.75, debt.averageMaturityYears);
  const refinancingNeedPctGdp = annualMaturingDebtPctGdp + Math.max(0, -input.fiscalBalancePctGdp);
  const bufferSupport = Math.min(12, debt.cashBufferMonthsDebtService) * 0.28;
  const credibilitySupport = debt.fiscalCredibilityPct * 0.025;
  const fundingCapacity = 2 + marketAccess * 0.35 + protection * 0.035
    + Math.min(12, input.foreignReserveMonthsImports) * 0.18 + bufferSupport + credibilitySupport;
  const monetaryLiquidity = debt.backstopCredibilityPct >= 70
    ? protection * (debt.localCurrencySharePct / 100) * 0.18
    : 0;
  const fundingGapPctGdp = Math.max(0, refinancingNeedPctGdp - fundingCapacity - monetaryLiquidity);
  const stressedNow = fundingGapPctGdp >= 1 || marketAccess < 43 || debtServicePctRevenue >= 28;
  const monthsUnderStress = clamp(debt.monthsUnderStress + (stressedNow ? elapsedMonths : -elapsedMonths * 1.75), 0, 120);
  const preliminaryStatus = debtStatus(marketAccess, debtServicePctRevenue, fundingGapPctGdp, monthsUnderStress, debt.missedPaymentsPctGdp, input.publicDebtPctGdp, debt.status);
  // Le funding gap est annualisé : il ne devient pas automatiquement un
  // arriéré dès le premier mois. Seule la partie persistante au-delà de 2 % du
  // PIB alimente les impayés, à un rythme lent en crise de refinancement et
  // plus rapide lorsque l'accès au marché est déjà fermé.
  const arrearsRate = preliminaryStatus === 'default' ? 0.32 : 0.18;
  const unpaidFlow = ['refinancing_crisis', 'default'].includes(preliminaryStatus)
    ? Math.max(0, fundingGapPctGdp - 2) * elapsedMonths / 12 * arrearsRate
    : 0;
  const missedPaymentsPctGdp = clamp(debt.missedPaymentsPctGdp + unpaidFlow - (preliminaryStatus === 'stable' ? elapsedMonths * 0.08 : 0), 0, 100);
  const status = debtStatus(marketAccess, debtServicePctRevenue, fundingGapPctGdp, monthsUnderStress, missedPaymentsPctGdp, input.publicDebtPctGdp, debt.status);

  const sovereignExposureStress = clamp((100 - marketAccess) * debt.domesticBankExposurePctAssets / 100 + statusRank[status] * 9, 0, 100);
  const recessionStress = Math.max(0, -input.realGrowthAnnualPct) * 4 + Math.max(0, input.unemploymentPct - economy.unemploymentPct) * 1.5;
  const privateLeverageStress = Math.max(0, economy.privateDebtPctGdp - 110) * 0.08;
  const liquidityTarget = clamp(input.financialStress * 0.45 + sovereignExposureStress * 0.65 + recessionStress + privateLeverageStress, 0, 100);
  const liquidityStress = bank.liquidityStress + (liquidityTarget - bank.liquidityStress) * transition(3.2, elapsedMonths);
  const nonPerformingTarget = clamp(bank.nonPerformingLoansPct + recessionStress * 0.08 + statusRank[status] * 0.7, 0.5, 55);
  const nonPerformingLoansPct = bank.nonPerformingLoansPct + (nonPerformingTarget - bank.nonPerformingLoansPct) * transition(0.8, elapsedMonths);
  const capitalDeltaAnnual = liquidityStress > 55 ? -(liquidityStress - 55) * 0.035 : Math.min(0.35, (55 - liquidityStress) * 0.004);
  const capitalAdequacyPct = clamp(bank.capitalAdequacyPct + capitalDeltaAnnual * elapsedMonths / 12, 2, 25);
  const creditAvailabilityTarget = clamp(100 - liquidityStress * 0.65 - nonPerformingLoansPct * 0.9 - Math.max(0, 9 - capitalAdequacyPct) * 4, 5, 98);
  const creditAvailability = bank.creditAvailability + (creditAvailabilityTarget - bank.creditAvailability) * transition(2.5, elapsedMonths);
  return {
    sovereignDebt: {
      ...debt, effectiveInterestRatePct: round(effectiveInterestRatePct), sovereignSpreadBps: round(sovereignSpreadBps),
      annualMaturingDebtPctGdp: round(annualMaturingDebtPctGdp), marketAccess: round(marketAccess),
      refinancingNeedPctGdp: round(refinancingNeedPctGdp), fundingGapPctGdp: round(fundingGapPctGdp),
      debtServicePctRevenue: round(debtServicePctRevenue), missedPaymentsPctGdp: round(missedPaymentsPctGdp),
      monthsUnderStress: round(monthsUnderStress), status,
    } satisfies SovereignDebtState,
    bankingSystem: {
      capitalAdequacyPct: round(capitalAdequacyPct), nonPerformingLoansPct: round(nonPerformingLoansPct),
      liquidityStress: round(liquidityStress), sovereignExposureStress: round(sovereignExposureStress),
      creditAvailability: round(creditAvailability),
    } satisfies BankingSystemState,
  };
}

/**
 * La dette reste un paramètre macro qui explique la transmission d'une crise
 * au crédit et à l'économie. Elle ne produit plus de dossier, de relance IA
 * ni de réponse tactique à choisir. Seul le franchissement d'une crise aiguë
 * devient un fait public dans le fil des événements.
 */
export function sovereignDebtEventEffects(
  state: WorldState,
  countryId: CountryId,
  previous: SovereignDebtStatus,
  current: SovereignDebtStatus,
  currentDebt?: SovereignDebtState,
): WorldEffect[] {
  if (previous === current) return [];
  const country = state.countries[countryId];
  if (!country) return [];
  if (!['refinancing_crisis', 'default', 'restructuring'].includes(current)) return [];
  if (current === 'refinancing_crisis' && (currentDebt?.monthsUnderStress ?? 0) < 12) return [];

  const event = current === 'default'
    ? {
      title: `Défaut de paiement de l’État · ${country.name}`,
      summary: `${country.name} ne parvient plus à honorer normalement ses engagements publics. Le choc se transmet au système bancaire, à l’activité et aux partenaires exposés.`,
    }
    : current === 'restructuring'
      ? {
        title: `Reprofilage financier imposé · ${country.name}`,
        summary: `${country.name} entre dans une restructuration encadrée. La crise cesse d’être un risque immédiat, mais les effets sur le crédit et l’économie persistent.`,
      }
      : {
        title: `Crise de financement de l’État · ${country.name}`,
        summary: `${country.name} perd durablement l’accès normal au financement. Le pays subit une crise financière majeure, avec des répercussions bancaires et économiques.`,
      };
  return [{
    kind: 'world_event_add',
    event: {
      id: `financial-crisis-${countryId}-${current}-${state.currentDate}`,
      date: state.currentDate,
      title: event.title,
      summary: event.summary,
      importance: 'major',
      scope: countryId === state.playerCountryId ? 'national' : 'world',
      actorIds: [countryId],
      source: 'system',
    },
    reason: 'Un basculement financier majeur est enregistré comme événement, sans créer de dossier à suivre.',
    visibility: 'public',
  }];
}
