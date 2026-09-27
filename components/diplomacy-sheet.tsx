'use client';

import { useEffect, useState } from 'react';

import { Bot, Check, Clock3, MessageSquareText, ShieldCheck, UserRoundCog } from 'lucide-react';

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
  initialPosition?: string;
  negotiationStyle?: string;
};

type SheetMessage = {
  id: number;
  author: 'player' | 'foreign';
  text: string;
  meta?: string;
};

type StructuredDiplomaticResponse = {
  kind: 'accept' | 'counter' | 'refuse' | 'request_clarification' | 'message';
  agreementType: 'industrial_cooperation' | 'energy_cooperation' | 'information_sharing' | 'security_cooperation' | 'political_guarantee' | 'mediation' | 'defense_cooperation';
  position: string;
  concessions: string[];
  guaranteesRequested: string[];
  conditions: string[];
  redLines: string[];
  timeline: string;
  acceptedTerms?: string[];
  rejectedTerms?: string[];
  conditionalTerms?: string[];
  decisionScope?: 'dialogue_only' | 'principle' | 'substance';
  feasibilityIssues?: Array<{ id: string; severity: 'hard' | 'counter'; label: string; explanation: string; requiredResponse: string }>;
  participantPositions?: Array<{ participantId: string; kind: 'accept' | 'counter' | 'refuse' | 'pending'; position: string; acceptedTerms: string[]; rejectedTerms: string[]; conditionalTerms: string[]; rationale?: string }>;
};

type DiplomaticResponseResolution = {
  status: 'accepted' | 'accepted_conditionally' | 'refused' | 'revision_requested' | 'acknowledged';
  decidedAt: string;
  summary: string;
};

type DiplomaticBriefView = {
  source: 'local' | 'ai';
  generatedAt: string;
  summary: string;
  pointsOfAgreement: string[];
  openPoints: string[];
  recommendedChanges: string[];
  suggestedMeeting?: 'official' | 'discreet' | 'technical';
};

type DiplomaticMeetingView = {
  mode: 'official' | 'discreet' | 'technical';
  status: string;
  scheduledAt?: string;
  agenda: string[];
  counterpartDecision?: 'pending' | 'accepted' | 'countered' | 'refused';
  participantPositions?: Array<{ participantId: string; kind: 'accept' | 'counter' | 'refuse' | 'pending'; position: string; acceptedTerms: string[]; rejectedTerms: string[]; conditionalTerms: string[]; rationale?: string }>;
};

type DiplomaticAgreementDraftView = {
  id: string;
  title: string;
  domain: string;
  stage: 'framework' | 'final_proposal' | 'signed' | 'rejected';
  summary: string;
  terms: Record<string, string | number>;
  unresolvedConditions: string[];
  counterpartDecision?: 'pending' | 'accepted' | 'countered' | 'refused';
};

type QuickReply = { label: string; value: string };

type DialogueSummary = {
  id: string;
  kind: 'bilateral_dialogue' | 'multilateral_dialogue';
  participantIds: string[];
  status: string;
  label: string;
};

type DiplomacySheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  countries: SheetCountry[];
  selectedId: string;
  onSelectCountry: (id: string) => void;
  participantIds?: string[];
  participantOptions?: SheetCountry[];
  onAddParticipant?: (id: string) => void;
  dialogues?: DialogueSummary[];
  onSelectDialogue?: (id: string) => void;
  selectedDialogueId?: string | null;
  onNewDialogue?: () => void;
  selectedCountry: SheetCountry;
  messages: SheetMessage[];
  structuredResponse?: StructuredDiplomaticResponse;
  responseResolution?: DiplomaticResponseResolution;
  brief?: DiplomaticBriefView;
  briefLoading?: boolean;
  onRequestBrief?: () => void;
  onProposeMeeting?: (mode: 'official' | 'discreet' | 'technical') => void;
  onReviseAgreement?: (unresolvedConditions: string[]) => void;
  onSignAgreement?: () => void;
  onRequestMeetingAI?: () => void;
  meetingAIAvailable?: boolean;
  meetingAILoading?: boolean;
  meeting?: DiplomaticMeetingView;
  agreementDraft?: DiplomaticAgreementDraftView;
  onResolveResponse?: (decision: 'accept' | 'refuse' | 'request_revision' | 'acknowledge') => void;
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  isThinking: boolean;
  playerCountryName: string;
  participantCount?: number;
  activeSpeakerLabel?: string;
  statusLabel?: string;
  quickReplies?: QuickReply[];
  onQuickReply?: (value: string) => void;
  canRequestAI?: boolean;
  onRequestAI?: () => void;
  aiRequestLabel?: string;
  activeEvent?: DiplomaticEventState;
  onResolveEvent: (channel: ResolutionChannel) => void;
  memories: string[];
  agreements?: string[];
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

const dialogueStatusLabel = (status: string) => ({
  awaiting_ai: 'Appel IA en attente',
  awaiting_player: 'Votre réponse attendue',
  closed: 'Canal fermé',
}[status] ?? status);

export function DiplomacySheet({
  open,
  onOpenChange,
  countries,
  selectedId,
  onSelectCountry,
  participantIds = [],
  participantOptions = [],
  onAddParticipant,
  dialogues = [],
  onSelectDialogue,
  selectedDialogueId,
  onNewDialogue,
  selectedCountry,
  messages,
  structuredResponse,
  responseResolution,
  onResolveResponse,
  draft,
  onDraftChange,
  onSend,
  isThinking,
  playerCountryName,
  participantCount = 2,
  activeSpeakerLabel,
  statusLabel,
  quickReplies = [],
  onQuickReply,
  canRequestAI,
  onRequestAI,
  aiRequestLabel = 'Demander la réponse IA',
  activeEvent,
  onResolveEvent,
  memories,
  agreements = [],
}: DiplomacySheetProps) {
  const tags = relationshipTags(selectedCountry);
  const [participantToAdd, setParticipantToAdd] = useState(participantOptions[0]?.id ?? '');
  useEffect(() => {
    if (!participantOptions.some((country) => country.id === participantToAdd)) setParticipantToAdd(participantOptions[0]?.id ?? '');
  }, [participantOptions, participantToAdd]);

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
            {onNewDialogue && <div className="border-b border-border/70 p-2"><Button type="button" size="sm" variant="outline" onClick={onNewDialogue} className="w-full justify-start rounded-none text-[11px]">Nouveau canal</Button></div>}
            {dialogues.length > 0 && onSelectDialogue && <div className="mb-2 border-b border-border/70 pb-2">
              <p className="px-3 pb-2 pt-3 font-mono text-[8px] tracking-[0.12em] text-muted-foreground">CANAUX RÉCENTS</p>
              <div className="space-y-1 px-2">
                {dialogues.slice(0, 8).map((item) => {
                  return <button key={item.id} type="button" onClick={() => onSelectDialogue(item.id)} className={`block w-full border px-2 py-1.5 text-left text-[11px] ${item.id === selectedDialogueId ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/30'}`}>
                    <span className="block font-medium">{item.kind === 'multilateral_dialogue' ? 'Groupe' : 'Canal'} · {item.label || 'Dialogue'}</span>
                    <span className="block text-[9px] text-muted-foreground">{dialogueStatusLabel(item.status)} · {item.participantIds.length - 1} interlocuteur(s)</span>
                  </button>;
                })}
              </div>
            </div>}
            <p className="px-3 pb-2 pt-3 font-mono text-[8px] tracking-[0.12em] text-muted-foreground">PAYS DISPONIBLES</p>
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
              <div className="min-w-0 flex-1"><p className="font-mono text-[8px] tracking-[0.12em] text-muted-foreground">CANAL {participantCount > 2 ? 'MULTILATÉRAL' : 'BILATÉRAL'}</p><h2>{playerCountryName} — {selectedCountry.name}</h2>{participantCount > 2 && <p className="mt-1 text-[11px] text-muted-foreground">Participants : {participantIds.filter((id) => id !== selectedCountry.id).map((id) => countries.find((country) => country.id === id)?.name ?? id).join(', ')}</p>}{statusLabel && <p className="mt-1 text-xs text-sky-300">{statusLabel}</p>}{activeSpeakerLabel && <p className="mt-1 text-xs text-amber-300">Prochain intervenant : {activeSpeakerLabel}</p>}{onAddParticipant && participantOptions.length > 0 && <div className="mt-2 flex flex-wrap items-center gap-2"><select aria-label="Ajouter un pays au canal" value={participantToAdd} onChange={(event) => setParticipantToAdd(event.target.value)} className="border border-border bg-background px-2 py-1 text-xs">{participantOptions.map((country) => <option key={country.id} value={country.id}>{country.flag} {country.name}</option>)}</select><Button type="button" size="sm" variant="outline" onClick={() => { if (participantToAdd) onAddParticipant(participantToAdd); }}>Ajouter au canal</Button></div>}</div>
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
              {structuredResponse && (
                <article className="message foreign border border-primary/40 bg-primary/5">
                  <p className="mb-2 font-mono text-[9px] tracking-[0.08em] text-primary">
                    RÉPONSE DE L’INTERLOCUTEUR
                  </p>
                  <p className="text-sm leading-6">{structuredResponse.position}</p>
                  {structuredResponse.participantPositions && structuredResponse.participantPositions.length > 0 && (
                    <div className="mt-3 border-t border-border/70 pt-3 text-xs">
                      <strong>Positions des participants</strong>
                      <ul className="mt-1 space-y-1">
                        {structuredResponse.participantPositions.map((item) => (
                          <li key={item.participantId}>
                            <strong>{countries.find((country) => country.id === item.participantId)?.name ?? item.participantId}</strong>
                            {' — '}{item.position}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {responseResolution ? (
                    <p className="mt-3 border-t border-border pt-2 text-xs text-primary">{responseResolution.summary}</p>
                  ) : onResolveResponse ? (
                    <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
                      <Button type="button" size="sm" onClick={() => onResolveResponse('acknowledge')}>
                        Prendre acte
                      </Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => onResolveResponse('refuse')}>
                        Clore le canal
                      </Button>
                    </div>
                  ) : null}
                </article>
              )}
              {isThinking && <div className="message foreign"><p className="font-mono text-[9px] text-muted-foreground">ANALYSE DES INTÉRÊTS EN COURS…</p></div>}
            </div>

            <div className="diplomacy-composer">
              <label htmlFor="diplomacy-sheet-message">VOTRE MESSAGE</label>
              {canRequestAI && onRequestAI && <Button type="button" variant="outline" onClick={onRequestAI} disabled={isThinking} className="mb-2 h-auto w-full justify-start rounded-none py-2 text-left"><Bot className="size-4" />{aiRequestLabel}</Button>}
              {quickReplies.length > 0 && onQuickReply && <div className="mb-2 flex flex-wrap gap-2">{quickReplies.map((reply) => <Button key={reply.label} type="button" size="sm" variant="outline" onClick={() => onQuickReply(reply.value)} disabled={isThinking}>{reply.label}</Button>)}</div>}
              <div className="flex items-end gap-2">
                <Textarea
                  id="diplomacy-sheet-message"
                  value={draft}
                  onChange={(event) => onDraftChange(event.target.value)}
                  onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); onSend(); } }}
                  placeholder="Écrivez votre position, une question ou une proposition…"
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

            {selectedCountry.initialPosition && <section><p className="recap-label"><MessageSquareText /> POSITION INITIALE</p><p className="ai-rationale">{selectedCountry.initialPosition}</p>{selectedCountry.negotiationStyle && <p className="ai-rationale">Style de négociation : {selectedCountry.negotiationStyle}</p>}</section>}
            <section><p className="recap-label"><ShieldCheck /> INTÉRÊTS CONNUS</p><ul>{selectedCountry.interests.map((interest) => <li key={interest}>{interest}</li>)}</ul></section>
            <section><p className="recap-label"><UserRoundCog /> MÉMOIRE DE LA RELATION</p>{memories.length ? <ul>{memories.map((memory) => <li key={memory}>{memory}</li>)}</ul> : <p className="ai-rationale">Aucun engagement majeur mémorisé.</p>}</section>
            <section><p className="recap-label"><ShieldCheck /> ENGAGEMENTS ACTIFS</p>{agreements.length ? <ul>{agreements.map((agreement) => <li key={agreement}>{agreement}</li>)}</ul> : <p className="ai-rationale">Aucun accord formel actif avec ce pays.</p>}</section>
            {activeEvent?.resolved && activeEvent.countryId === selectedId && <p className="resolved-event"><Check /> Événement traité : {activeEvent.resolvedBy === 'explicit_silence' ? 'silence assumé' : 'position enregistrée'}</p>}
          </aside>
        </div>
      </SheetContent>
    </Sheet>
  );
}
