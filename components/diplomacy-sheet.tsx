'use client';

import { Bot, Check, Clock3, MessageSquareText, Route, ShieldCheck, UserRoundCog } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';

export type ResolutionChannel =
  | 'dialogue'
  | 'government_action'
  | 'economic_action'
  | 'multilateral_channel'
  | 'delegation'
  | 'explicit_silence';

export type DiplomaticEventState = {
  id: string;
  title: string;
  summary: string;
  countryId: string;
  requirement: 'optional' | 'position_required' | 'direct_exchange_required';
  deadlineLabel: string;
  deadline: string;
  allowedChannels: ResolutionChannel[];
  resolved: boolean;
  resolvedBy?: ResolutionChannel;
};

type SheetCountry = {
  id: string;
  name: string;
  flag: string;
  role: string;
  posture: string;
  relation: number;
  trust: number;
  interests: string[];
  redLines: string[];
};

type SheetMessage = {
  id: number;
  author: 'player' | 'foreign';
  text: string;
  meta?: string;
};

type DiplomacySheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  countries: SheetCountry[];
  selectedId: string;
  onSelectCountry: (id: string) => void;
  selectedCountry: SheetCountry;
  messages: SheetMessage[];
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  isThinking: boolean;
  playerCountryName: string;
  participantCount?: number;
  activeSpeakerLabel?: string;
  canRequestAI?: boolean;
  onRequestAI?: () => void;
  aiRequestLabel?: string;
  activeEvent?: DiplomaticEventState;
  onResolveEvent: (channel: ResolutionChannel) => void;
  memories: string[];
};

const responseCopy: Partial<Record<ResolutionChannel, { title: string; detail: string }>> = {
  multilateral_channel: {
    title: 'Passer par d’autres canaux',
    detail: 'Privilégier les ambassades ou le cadre européen.',
  },
  delegation: {
    title: 'Déléguer au ministère',
    detail: 'Une réponse officielle sera préparée sans échange présidentiel.',
  },
  government_action: {
    title: 'Régler par une décision',
    detail: 'Traiter le problème par une mesure gouvernementale.',
  },
  economic_action: {
    title: 'Prendre une mesure économique',
    detail: 'Répondre par un acte vérifiable plutôt que par une discussion.',
  },
  explicit_silence: {
    title: 'Ne pas répondre',
    detail: 'Assumer que le silence sera interprété diplomatiquement.',
  },
};

function relationshipTags(country: SheetCountry) {
  const tags = [country.role];
  if (country.relation >= 75) tags.push('Partenaire privilégié');
  else if (country.relation >= 60) tags.push('Partenaire');
  else if (country.relation <= 30) tags.push('Rival sous tension');
  else if (country.relation < 45) tags.push('Relation à surveiller');
  else tags.push('Relation de travail');
  if (country.trust >= 70) tags.push('Confiance élevée');
  return [...new Set(tags)];
}

export function DiplomacySheet({
  open,
  onOpenChange,
  countries,
  selectedId,
  onSelectCountry,
  selectedCountry,
  messages,
  draft,
  onDraftChange,
  onSend,
  isThinking,
  playerCountryName,
  participantCount = 2,
  activeSpeakerLabel,
  canRequestAI,
  onRequestAI,
  aiRequestLabel = 'Demander la réponse IA',
  activeEvent,
  onResolveEvent,
  memories,
}: DiplomacySheetProps) {
  const tags = relationshipTags(selectedCountry);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="diplomacy-sheet gap-0 p-0 sm:max-w-none">
        <SheetHeader className="diplomacy-sheet-header border-b border-border pr-14">
          <p className="font-mono text-[9px] tracking-[0.16em] text-primary">CENTRE DIPLOMATIQUE</p>
          <SheetTitle>Relations extérieures</SheetTitle>
          <SheetDescription>Consultez un pays, répondez à une crise ou ouvrez librement un échange.</SheetDescription>
        </SheetHeader>

        <div className="diplomacy-sheet-layout">
          <nav className="diplomacy-contact-list" aria-label="Interlocuteurs diplomatiques">
            <p className="px-3 pb-2 pt-3 font-mono text-[8px] tracking-[0.12em] text-muted-foreground">ENTITÉS ACTIVES ET PRIORITAIRES</p>
            {countries.map((country) => (
              <button
                key={country.id}
                type="button"
                className={`diplomacy-contact ${country.id === selectedId ? 'selected' : ''}`}
                onClick={() => onSelectCountry(country.id)}
                aria-pressed={country.id === selectedId}
              >
                <span className="text-xl" aria-hidden="true">{country.flag}</span>
                <span className="min-w-0"><strong>{country.name}</strong><small>{country.role}</small></span>
                <i className={country.relation >= 65 ? 'positive' : country.relation >= 48 ? 'neutral' : 'watch'} />
              </button>
            ))}
          </nav>

          <section className="diplomacy-conversation">
            <div className="diplomacy-country-heading">
              <span className="text-3xl" aria-hidden="true">{selectedCountry.flag}</span>
              <div><p className="font-mono text-[8px] tracking-[0.12em] text-muted-foreground">CANAL {participantCount > 2 ? 'MULTILATÉRAL' : 'BILATÉRAL'} CHIFFRÉ</p><h2>{playerCountryName} — {selectedCountry.name}</h2>{activeSpeakerLabel && <p className="mt-1 text-xs text-amber-300">Prochain intervenant : {activeSpeakerLabel}</p>}</div>
            </div>

            {activeEvent && activeEvent.countryId === selectedId && !activeEvent.resolved && (
              <div className={`diplomatic-event-callout ${activeEvent.requirement}`}>
                <div className="flex items-start gap-3">
                  <Clock3 className="mt-0.5 size-4 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-[8px] tracking-[0.1em]">ÉVÉNEMENT À RÉSOUDRE · {activeEvent.deadlineLabel}</p>
                    <h3>{activeEvent.title}</h3>
                    <p>{activeEvent.summary}</p>
                  </div>
                </div>
                <div className="diplomatic-event-actions">
                  <Button type="button" onClick={() => onResolveEvent('dialogue')} className="h-auto rounded-none px-3 py-2 text-left">
                    <MessageSquareText className="size-3.5" /> Engager la discussion
                  </Button>
                  {activeEvent.allowedChannels.filter((channel) => channel !== 'dialogue').map((channel) => {
                    const copy = responseCopy[channel];
                    if (!copy) return null;
                    return (
                      <button key={channel} type="button" onClick={() => onResolveEvent(channel)}>
                        <strong>{copy.title}</strong><span>{copy.detail}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="diplomacy-message-list">
              {messages.map((message) => (
                <article key={message.id} className={`message ${message.author}`}>
                  <p className="mb-2 font-mono text-[9px] tracking-[0.08em] text-muted-foreground">{message.meta}</p>
                  <p className="text-sm leading-6">{message.text}</p>
                </article>
              ))}
              {isThinking && <div className="message foreign"><p className="font-mono text-[9px] text-muted-foreground">ANALYSE DES INTÉRÊTS EN COURS…</p></div>}
            </div>

            <div className="diplomacy-composer">
              <label htmlFor="diplomacy-sheet-message">DIRECTIVE LIBRE — ÉCRIVEZ VOTRE POSITION OU VOTRE PROPOSITION</label>
              {canRequestAI && onRequestAI && <Button type="button" variant="outline" onClick={onRequestAI} disabled={isThinking} className="mb-2 h-auto w-full justify-start rounded-none py-2 text-left"><Bot className="size-4" />{aiRequestLabel}</Button>}
              <div className="flex items-end gap-2">
                <Textarea
                  id="diplomacy-sheet-message"
                  value={draft}
                  onChange={(event) => onDraftChange(event.target.value)}
                  onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); onSend(); } }}
                  placeholder="Formuler une proposition, demander des garanties ou exposer une ligne rouge…"
                  className="min-h-20 resize-none rounded-none bg-background"
                />
                <Button type="button" onClick={onSend} disabled={!draft.trim() || isThinking} className="h-20 rounded-none px-4"><MessageSquareText /></Button>
              </div>
            </div>
          </section>

          <aside className="diplomacy-country-recap">
            <div className="diplomacy-recap-title"><span className="text-3xl">{selectedCountry.flag}</span><div><h3>{selectedCountry.name}</h3><p>{selectedCountry.posture}</p></div></div>
            <div className="diplomacy-score-grid"><div><span>RELATION</span><strong>{selectedCountry.relation}/100</strong></div><div><span>CONFIANCE</span><strong>{selectedCountry.trust}/100</strong></div></div>

            <section>
              <p className="recap-label"><Bot /> CLASSEMENT PROPOSÉ PAR L’IA</p>
              <div className="relation-tags">{tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
              <p className="ai-rationale">Classification fondée sur les accords, les échanges et l’activité diplomatique. Elle décrit la relation sans la modifier.</p>
            </section>

            <section><p className="recap-label"><ShieldCheck /> INTÉRÊTS CONNUS</p><ul>{selectedCountry.interests.map((interest) => <li key={interest}>{interest}</li>)}</ul></section>
            <section><p className="recap-label"><Route /> LIGNES ROUGES</p><ul>{selectedCountry.redLines.map((line) => <li key={line}>{line}</li>)}</ul></section>
            <section><p className="recap-label"><UserRoundCog /> MÉMOIRE DE LA RELATION</p>{memories.length ? <ul>{memories.map((memory) => <li key={memory}>{memory}</li>)}</ul> : <p className="ai-rationale">Aucun engagement majeur mémorisé.</p>}</section>
            {activeEvent?.resolved && activeEvent.countryId === selectedId && <p className="resolved-event"><Check /> Événement traité : {activeEvent.resolvedBy === 'explicit_silence' ? 'silence assumé' : 'position enregistrée'}</p>}
          </aside>
        </div>
      </SheetContent>
    </Sheet>
  );
}
