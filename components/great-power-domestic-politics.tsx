'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  Crown,
  Gauge,
  Landmark,
  Users,
} from 'lucide-react';
import {
  domesticPoliticsSnapshot,
  type DomesticPoliticsCountry,
} from '@/lib/simulation/domestic-politics';
import type { WorldState } from '@/lib/simulation/types';

function toneFor(status: DomesticPoliticsCountry['status']) {
  switch (status) {
    case 'campaign':
      return 'border-violet-400/55 bg-violet-400/10 text-violet-100';
    case 'strained':
      return 'border-red-400/55 bg-red-400/10 text-red-100';
    case 'watch':
      return 'border-amber-400/55 bg-amber-400/10 text-amber-100';
    default:
      return 'border-emerald-400/35 bg-emerald-400/5 text-emerald-100';
  }
}

function barTone(value: number, inverse = false) {
  const positive = inverse ? value < 35 : value >= 65;
  return positive ? 'bg-emerald-400' : value >= 45 ? 'bg-amber-400' : 'bg-red-400';
}

function ProgressBar({ value, inverse = false }: { value: number; inverse?: boolean }) {
  return (
    <div className="h-1.5 overflow-hidden bg-muted/35">
      <div
        className={`h-full ${barTone(value, inverse)}`}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

function DomesticMetric({
  label,
  value,
  inverse = false,
}: {
  label: string;
  value: number;
  inverse?: boolean;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
        <span>{label}</span>
        <b className="text-foreground">{value}/100</b>
      </div>
      <div className="mt-1">
        <ProgressBar value={value} inverse={inverse} />
      </div>
    </div>
  );
}

function DetailValue({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border border-border/70 bg-background/25 p-2.5">
      <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-xs font-medium text-foreground">{children}</div>
    </div>
  );
}

export function GreatPowerDomesticPolitics({
  world,
  onOpenAdvisor,
}: {
  world: WorldState;
  onOpenAdvisor?: (prompt: string) => void;
}) {
  const snapshot = useMemo(() => domesticPoliticsSnapshot(world), [world]);
  const defaultCountry = snapshot.countries.find(
    (country) => country.countryId === world.playerCountryId,
  )?.countryId ?? snapshot.countries[0]?.countryId ?? '';
  const [selectedCountryId, setSelectedCountryId] = useState(defaultCountry);
  useEffect(() => {
    setSelectedCountryId(defaultCountry);
  }, [defaultCountry]);
  const selected =
    snapshot.countries.find((country) => country.countryId === selectedCountryId) ??
    snapshot.countries[0];

  if (!selected) return null;
  const orderedCountries = snapshot.countries;
  const nextReviewLabel = selected.nextReviewDate
    ? `${selected.nextReviewDate} · ${selected.monthsToReview ?? 0} mois`
    : 'Pas d’échéance documentée';
  const askAdvisor = () =>
    onOpenAdvisor?.(
      `Politique intérieure de ${selected.name} en ${world.currentDate}. Explique les rapports de force entre exécutif, Parlement, appareils politiques et acteurs organisés, les échéances proches et les points susceptibles de produire un dossier mondial ou national. Distingue les faits documentés des inférences.`,
    );

  return (
    <section className="border border-border bg-card/70">
      <div className="border-b border-border p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 font-semibold">
              <Landmark className="size-4 text-primary" /> Politique intérieure · grandes puissances
            </div>
            <p className="mt-1 max-w-4xl text-xs leading-5 text-muted-foreground">
              Comparaison du rapport de forces intérieur à partir du moteur existant : exécutif,
              calendrier politique, base parlementaire lorsqu’elle est documentée et tensions déjà matérialisées.
            </p>
          </div>
          <button
            type="button"
            onClick={askAdvisor}
            className="border border-primary/50 bg-primary/10 px-3 py-2 text-xs text-primary transition-colors hover:bg-primary/20"
          >
            Interroger le Conseiller
          </button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
          <div className="border border-border/80 bg-background/30 p-2.5">
            <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Puissances suivies</div>
            <div className="mt-1 text-lg font-semibold">{snapshot.countries.length}</div>
          </div>
          <div className="border border-border/80 bg-background/30 p-2.5">
            <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Séquences ouvertes</div>
            <div className="mt-1 text-lg font-semibold text-violet-200">{snapshot.campaignCount}</div>
          </div>
          <div className="border border-border/80 bg-background/30 p-2.5">
            <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Tensions élevées</div>
            <div className="mt-1 text-lg font-semibold text-red-200">{snapshot.strainedCount}</div>
          </div>
          <div className="border border-border/80 bg-background/30 p-2.5">
            <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Échéances proches</div>
            <div className="mt-1 text-lg font-semibold text-amber-200">{snapshot.upcomingCount}</div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(330px,.8fr)]">
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Classement par tension intérieure
            </div>
            <label className="sr-only" htmlFor="domestic-politics-country">Pays sélectionné</label>
            <select
              id="domestic-politics-country"
              value={selected.countryId}
              onChange={(event) => setSelectedCountryId(event.target.value)}
              className="h-8 border border-input bg-background px-2 text-xs"
            >
              {orderedCountries.map((country) => (
                <option key={country.countryId} value={country.countryId}>{country.name}</option>
              ))}
            </select>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {orderedCountries.map((country) => (
              <button
                key={country.countryId}
                type="button"
                aria-label={`Afficher la politique intérieure de ${country.name}`}
                onClick={() => setSelectedCountryId(country.countryId)}
                className={`border p-3 text-left transition-colors hover:border-primary/70 ${selected.countryId === country.countryId ? 'border-primary bg-primary/10' : 'border-border bg-background/25'}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-xs font-semibold">{country.flag} {country.name}</div>
                    <div className="mt-1 truncate text-[10px] text-muted-foreground">{country.governmentLabel}</div>
                  </div>
                  <span className={`shrink-0 border px-1.5 py-0.5 font-mono text-[9px] ${toneFor(country.status)}`}>
                    {country.statusLabel}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <div className="flex justify-between font-mono text-[9px] text-muted-foreground"><span>stabilité</span><b>{country.stability}</b></div>
                    <div className="mt-1"><ProgressBar value={country.stability} /></div>
                  </div>
                  <div>
                    <div className="flex justify-between font-mono text-[9px] text-muted-foreground"><span>tension</span><b>{country.tension}</b></div>
                    <div className="mt-1"><ProgressBar value={country.tension} inverse /></div>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2 font-mono text-[9px] text-muted-foreground">
                  <span>{country.cycleMode}</span>
                  <span>{country.nextReviewDate ?? '—'}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <aside className="border border-primary/35 bg-primary/5 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-wider text-primary">Fiche politique</div>
              <h3 className="mt-1 text-lg font-semibold">{selected.flag} {selected.name}</h3>
              <div className="mt-1 text-xs text-muted-foreground">{selected.regime} · {selected.executive}</div>
            </div>
            <span className={`border px-2 py-1 font-mono text-[9px] ${toneFor(selected.status)}`}>{selected.statusLabel}</span>
          </div>
          <p className="mt-3 border-l-2 border-primary/60 pl-3 text-xs leading-5 text-muted-foreground">{selected.politicalCue}</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <DetailValue label="Chef du gouvernement"><span className="inline-flex items-center gap-1"><Crown className="size-3 text-primary" />{selected.headOfGovernment}</span></DetailValue>
            <DetailValue label="Échéance politique"><span className="inline-flex items-center gap-1"><CalendarClock className="size-3 text-primary" />{nextReviewLabel}</span></DetailValue>
            <DetailValue label="Base de gouvernement"><span className="inline-flex items-center gap-1"><Users className="size-3 text-primary" />{selected.governmentSeats}/{selected.legislatureSeats} sièges · {selected.governmentSeatShare}%</span></DetailValue>
            <DetailValue label="Tensions matérialisées"><span className="inline-flex items-center gap-1"><AlertTriangle className="size-3 text-amber-300" />{selected.activePowerStruggles} lutte(s) · {selected.activeReactions} réaction(s) · {selected.activePoliticalDossiers} dossier(s)</span></DetailValue>
          </div>
          <div className="mt-4 space-y-3">
            <DomesticMetric label="Stabilité institutionnelle" value={selected.stability} />
            <DomesticMetric label="Approbation publique" value={selected.approval} />
            <DomesticMetric label="Coordination de l’exécutif" value={selected.executiveCoordination} />
            <DomesticMetric label="Tension intérieure" value={selected.tension} inverse />
          </div>
          <div className="mt-4 border-t border-border/70 pt-3">
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground"><Gauge className="size-3" /> Lecture institutionnelle</div>
            <div className="mt-2 text-xs text-muted-foreground">
              {selected.parliamentaryTracked
                ? `${selected.parliamentaryLabel} détaillé · majorité ${selected.majorityThreshold} sièges.`
                : 'Parlement et coalition suivis sous forme agrégée dans cette version.'}
            </div>
            {(selected.leadershipNames.length > 0 || selected.apparatusCurrents.length > 0) && (
              <div className="mt-2 flex flex-wrap gap-1">
                {[...selected.leadershipNames, ...selected.apparatusCurrents].map((item) => (
                  <span key={item} className="border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">{item}</span>
                ))}
              </div>
            )}
            {selected.politicalDossierTitles.length > 0 && (
              <div className="mt-2 text-[10px] text-muted-foreground">
                <span className="text-foreground">Dossiers liés :</span>{' '}
                {selected.politicalDossierTitles.join(' · ')}
              </div>
            )}
          </div>
        </aside>
      </div>
      <div className="border-t border-border/70 px-4 py-3 text-[10px] leading-4 text-muted-foreground">
        Les pourcentages de tension sont une lecture comparative dérivée ; ils ne créent pas une nouvelle ressource. Un Parlement détaillé n’est affiché que lorsqu’il existe réellement dans l’état du pays.
      </div>
    </section>
  );
}
