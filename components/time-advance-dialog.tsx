'use client';

import { useMemo, useState } from 'react';
import { CalendarDays, ChevronRight, Clock3, FastForward, ShieldAlert } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export type TimeAdvancePreset = 'week' | 'month' | 'quarter' | 'semester' | 'year' | 'custom';

type TimeAdvanceDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentDate: string;
  deadlineDates: string[];
  eventDates: string[];
  onAdvance: (targetDate: string) => void;
};

const presets: Array<{ id: Exclude<TimeAdvancePreset, 'custom'>; label: string; detail: string }> = [
  { id: 'week', label: '1 semaine', detail: '+ 7 jours' },
  { id: 'month', label: '1 mois', detail: 'Même jour, mois suivant' },
  { id: 'quarter', label: '3 mois', detail: 'Un trimestre' },
  { id: 'semester', label: '6 mois', detail: 'Un semestre' },
  { id: 'year', label: '1 an', detail: 'Même date, année suivante' },
];

function addToDate(iso: string, preset: Exclude<TimeAdvancePreset, 'custom'>) {
  const date = new Date(`${iso}T12:00:00Z`);
  if (preset === 'week') date.setUTCDate(date.getUTCDate() + 7);
  if (preset === 'month') date.setUTCMonth(date.getUTCMonth() + 1);
  if (preset === 'quarter') date.setUTCMonth(date.getUTCMonth() + 3);
  if (preset === 'semester') date.setUTCMonth(date.getUTCMonth() + 6);
  if (preset === 'year') date.setUTCFullYear(date.getUTCFullYear() + 1);
  return date.toISOString().slice(0, 10);
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${iso}T12:00:00Z`));
}

function durationLabel(startIso: string, endIso: string) {
  const days = Math.round((new Date(`${endIso}T12:00:00Z`).getTime() - new Date(`${startIso}T12:00:00Z`).getTime()) / 86_400_000);
  if (days < 31) return `${days} jours`;
  const months = Math.floor(days / 30.44);
  const remainingDays = Math.round(days - months * 30.44);
  return remainingDays > 0 ? `${months} mois et ${remainingDays} jours` : `${months} mois`;
}

export function TimeAdvanceDialog({ open, onOpenChange, currentDate, deadlineDates, eventDates, onAdvance }: TimeAdvanceDialogProps) {
  const [preset, setPreset] = useState<TimeAdvancePreset>('month');
  const [customDate, setCustomDate] = useState(addToDate(currentDate, 'month'));
  const targetDate = preset === 'custom' ? customDate : addToDate(currentDate, preset);
  const validTarget = targetDate > currentDate;
  const preview = useMemo(() => durationLabel(currentDate, targetDate), [currentDate, targetDate]);
  const pendingDeadlineCount = deadlineDates.filter((date) => date > currentDate && date <= targetDate).length;
  const probableEventCount = eventDates.filter((date) => date > currentDate && date <= targetDate).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="time-advance-dialog rounded-none p-0 sm:max-w-[680px]">
        <DialogHeader className="border-b border-border p-5 pr-14">
          <p className="font-mono text-[9px] tracking-[0.16em] text-primary">HORLOGE DE SIMULATION</p>
          <DialogTitle>Avancer dans le temps</DialogTitle>
          <DialogDescription>Le moteur progressera jusqu’à la date choisie, ou s’arrêtera au premier événement exigeant votre attention.</DialogDescription>
        </DialogHeader>

        <div className="p-5">
          <div className="time-preset-grid">
            {presets.map((item) => (
              <button key={item.id} type="button" onClick={() => setPreset(item.id)} aria-pressed={preset === item.id}>
                <strong>{item.label}</strong><span>{item.detail}</span>
              </button>
            ))}
            <button type="button" onClick={() => setPreset('custom')} aria-pressed={preset === 'custom'}>
              <strong>Date personnalisée</strong><span>Choisir un jour précis</span>
            </button>
          </div>

          {preset === 'custom' && (
            <label className="custom-date-field">
              <span><CalendarDays /> DATE CIBLE</span>
              <input type="date" min={currentDate} value={customDate} onChange={(event) => setCustomDate(event.target.value)} />
            </label>
          )}

          <div className="time-advance-preview">
            <div className="time-route"><div><span>DÉPART</span><strong>{formatDate(currentDate)}</strong></div><ChevronRight /><div><span>CIBLE DEMANDÉE</span><strong>{formatDate(targetDate)}</strong></div></div>
            <div className="time-preview-facts">
              <p><Clock3 /><span><small>DURÉE</small><strong>{preview}</strong></span></p>
              <p><FastForward /><span><small>ÉVÉNEMENTS PROBABLES</small><strong>{probableEventCount}</strong></span></p>
              <p><ShieldAlert /><span><small>ÉCHÉANCES OUVERTES</small><strong>{pendingDeadlineCount}</strong></span></p>
            </div>
          </div>

          <p className="time-stop-rule"><ShieldAlert /> Pause automatique aux crises majeures et aux décisions obligatoires. Les événements informatifs sont consignés sans interrompre l’avance.</p>
          <Button type="button" disabled={!validTarget} onClick={() => onAdvance(targetDate)} className="mt-4 h-11 w-full rounded-none font-mono text-[11px] tracking-[0.08em]">
            AVANCER LA SIMULATION <ChevronRight />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
