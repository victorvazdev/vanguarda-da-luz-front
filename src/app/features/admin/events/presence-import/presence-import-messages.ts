// Textos da importação de presenças do addon.
import { ACCOUNT_MESSAGES } from '../../../../core/auth/messages';
import type { ItemOutcome, PreviewError } from '../../../../core/data/presence-import';
import type { EventIgnoredReason, PlanItem } from '../../../../core/data/presence-import-plan';

export const PREVIEW_ERRORS: Record<PreviewError, string> = {
  prefix: 'Isto não é uma string de presenças do addon. Ela começa com "VDLP1:".',
  version: 'Esta versão da string de presenças não é aceita pelo site. Atualize o addon.',
  encoding: 'A string está incompleta ou corrompida. Copie-a de novo no jogo.',
  compression: 'A string está incompleta ou corrompida. Copie-a de novo no jogo.',
  checksum: 'A string está incompleta ou corrompida. Copie-a de novo no jogo.',
  payload: 'O conteúdo da string é inválido. Gere a string de novo no jogo.',
  'not-allowed': 'Somente administradores importam presenças.',
  network: ACCOUNT_MESSAGES.network,
  unknown: 'Não foi possível validar a string. Tente novamente.',
};

export const IGNORED_EVENTS: Record<EventIgnoredReason, string> = {
  unknown: 'Evento não encontrado no site. Ignorado.',
  past: 'O evento já começou. Ignorado.',
  cancelled: 'O evento foi cancelado. Ignorado.',
  'not-forever': 'O evento não é do WoW Forever. Ignorado.',
};

type Reason =
  | Extract<PlanItem, { action: 'refused' }>['reason']
  | Extract<ItemOutcome, { result: 'refused' }>['reason'];

/** Motivo de um registro não ser aplicado (`detail`: nomes envolvidos, quando houver). */
export function refusalMessage(reason: Reason, detail?: string): string {
  switch (reason) {
    case 'stale':
      return 'A presença foi alterada no site depois desta resposta do jogo.';
    case 'full':
      return 'O evento está lotado.';
    case 'member-other-character':
      return detail
        ? `O membro já confirmou com outro personagem (${detail}).`
        : 'O membro já confirmou com outro personagem.';
    case 'duplicate-guest':
      return 'Este personagem já está confirmado como visitante.';
    case 'duplicate-member':
      return 'Este personagem já está confirmado por um membro.';
    case 'member-inactive':
      return `O personagem é de uma conta desativada ou excluída${detail ? ` (${detail})` : ''}.`;
    case 'ambiguous':
      return (
        `Mais de um membro tem um personagem com este nome (${detail ?? ''}). ` +
        'Confirme a presença manualmente.'
      );
    case 'invalid-name':
      return 'O nome do personagem não é válido (nome e sobrenome, de 2 a 12 letras cada).';
    case 'character-not-found':
      return 'O personagem foi removido ou renomeado no site.';
    case 'not-allowed':
      return 'Sem permissão para alterar esta presença.';
    case 'error':
      return 'Não foi possível aplicar. Tente importar a string de novo.';
    default:
      return IGNORED_EVENTS[reason];
  }
}

export const APPLY_ERRORS = {
  outdated: 'Esta string não é mais nova que a última importada. Gere uma string nova no jogo.',
  'not-allowed': 'Somente administradores importam presenças.',
  network: ACCOUNT_MESSAGES.network,
  unknown: 'Não foi possível importar as presenças. Tente novamente.',
} as const;
