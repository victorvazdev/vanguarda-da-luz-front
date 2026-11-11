import type { EventActionError } from '../../../core/data/events';

/** Mensagens das ações da administração de eventos (lista e formulário). */
export const EVENT_ACTION_ERRORS: Record<Exclude<EventActionError, 'past'>, string> = {
  cancelled: 'Este evento foi cancelado e não pode mais ser alterado.',
  'not-cancelled': 'Somente eventos cancelados podem ser excluídos.',
  'game-locked':
    'A versão do jogo não pode mais ser alterada: já há presenças confirmadas neste evento.',
  'not-found': 'Este evento não existe mais.',
  'not-allowed': 'Você não tem permissão para esta ação.',
  network: 'Não foi possível conectar. Verifique sua internet e tente novamente.',
  unknown: 'Não foi possível salvar. Tente novamente.',
};

export const EVENT_STARTED = 'Este evento já começou e não pode mais ser alterado.';
