import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import type { Permission } from '../../../core/auth/access';
import { SessionService } from '../../../core/auth/session.service';
import {
  activeAdminCount,
  matchesSearch,
  type MemberActionError,
  type MemberRow,
} from '../../../core/data/members-admin';
import { MembersAdminService } from '../../../core/data/members-admin.service';
import { characterDisplayName, classLabel, gameLabel, roleLabel } from '../../../core/models/wow';
import { ConfirmService } from '../../../shared/ui/confirm-dialog/confirm.service';

const ERRORS: Record<MemberActionError, string> = {
  'last-admin': 'A guilda precisa de ao menos um administrador ativo.',
  'not-active': 'Esta conta não está mais ativa. A lista foi atualizada.',
  'not-inactive': 'Esta conta já está ativa. A lista foi atualizada.',
  'not-allowed': 'Você não tem permissão para esta ação.',
  network: 'Não foi possível conectar. Verifique sua internet e tente novamente.',
  unknown: 'Não foi possível salvar a alteração. Tente novamente.',
};

interface RowView {
  uid: string;
  name: string;
  details: string;
  active: boolean;
  role: Permission;
  isSelf: boolean;
  /** Único admin ativo: não pode perder a permissão nem ser desativado. */
  isLastAdmin: boolean;
}

/** História "Gerenciar membros e permissões". */
@Component({
  selector: 'app-members-admin-page',
  templateUrl: './members-admin-page.html',
  styleUrl: './members-admin-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MembersAdminPage {
  private readonly members = inject(MembersAdminService);
  private readonly confirm = inject(ConfirmService);
  private readonly session = inject(SessionService);

  protected readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  private readonly rows = signal<MemberRow[]>([]);
  protected readonly search = signal('');
  protected readonly busy = signal<string | null>(null);
  protected readonly status = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  protected readonly view = computed<RowView[]>(() => {
    const rows = this.rows();
    const admins = activeAdminCount(rows);
    const me = this.session.user()?.uid;
    return rows
      .filter((r) => matchesSearch(r, this.search()))
      .map((r) => {
        const c = r.mainCharacter;
        return {
          uid: r.uid,
          name: c ? characterDisplayName(c) : r.username,
          details: c
            ? `${classLabel(c.characterClass)}, ${roleLabel(c.characterRole).toLowerCase()} · ${gameLabel(c.game)}`
            : `Usuário ${r.username}, sem personagem principal`,
          active: r.status === 'ativo',
          role: r.role,
          isSelf: r.uid === me,
          isLastAdmin: r.status === 'ativo' && r.role === 'admin' && admins === 1,
        };
      });
  });
  protected readonly total = computed(() => this.rows().length);

  constructor() {
    const stop = this.members.watch(
      (rows) => {
        this.rows.set(rows);
        this.state.set('ready');
      },
      () => this.state.set('error'),
    );
    inject(DestroyRef).onDestroy(stop);
  }

  protected onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  protected async onRoleChange(row: RowView, event: Event): Promise<void> {
    const select = event.target as HTMLSelectElement;
    const role = select.value as Permission;
    if (role === row.role) return;

    const promote = role === 'admin';
    const confirmed = await this.confirm.ask(
      promote
        ? {
            title: 'Tornar administrador?',
            message: `${row.name} poderá avaliar candidaturas e gerenciar membros e eventos.`,
            confirmLabel: 'Tornar administrador',
          }
        : {
            title: 'Remover permissão de administrador?',
            message: row.isSelf
              ? 'Você continuará membro, mas deixará de acessar a área administrativa.'
              : `${row.name} continuará membro, sem acesso à área administrativa.`,
            confirmLabel: 'Remover permissão',
            tone: 'danger',
          },
    );
    if (!confirmed) {
      select.value = row.role;
      return;
    }
    const ok = await this.run(
      row,
      () => this.members.changeRole(row.uid, role),
      promote ? `${row.name} agora é administrador.` : `${row.name} agora é membro.`,
    );
    if (!ok) select.value = row.role;
  }

  protected async reactivate(row: RowView): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: 'Reativar membro?',
      message: `${row.name} voltará a acessar as funcionalidades de membros e às listas da guilda, com permissão de membro.`,
      confirmLabel: 'Reativar',
    });
    if (confirmed) {
      await this.run(
        row,
        () => this.members.reactivate(row.uid),
        `${row.name} foi reativado, com permissão de membro.`,
      );
    }
  }

  protected async deactivate(row: RowView): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: 'Desativar membro?',
      message: `${row.name} perderá o acesso às funcionalidades de membros, terá a sessão encerrada e sairá das listas da guilda.`,
      confirmLabel: 'Desativar',
      tone: 'danger',
    });
    if (confirmed) {
      await this.run(row, () => this.members.deactivate(row.uid), `${row.name} foi desativado.`);
    }
  }

  private async run(
    row: RowView,
    action: () => Promise<{ ok: true } | { ok: false; error: MemberActionError }>,
    success: string,
  ): Promise<boolean> {
    if (this.busy()) return false;
    this.busy.set(row.uid);
    this.status.set(null);
    this.error.set(null);
    const result = await action();
    this.busy.set(null);
    if (result.ok) this.status.set(success);
    else this.error.set(ERRORS[result.error]);
    return result.ok;
  }
}
