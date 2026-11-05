import { Injectable, inject } from '@angular/core';
import { FIREBASE_AUTH, FirestoreClient } from '../firebase/firebase.providers';
import {
  removeCharacter,
  saveCharacter,
  setMainCharacter,
  watchCharacters,
  type Character,
  type CharacterInput,
  type CharacterResult,
} from './characters';

/** Personagens do membro logado. */
@Injectable({ providedIn: 'root' })
export class CharactersService {
  private readonly auth = inject(FIREBASE_AUTH);
  private readonly firestore = inject(FirestoreClient);

  private uid(): string {
    const uid = this.auth.currentUser?.uid;
    if (!uid) throw new Error('Usuário não autenticado');
    return uid;
  }

  /** Devolve a função para parar de acompanhar. */
  watchMine(next: (list: Character[]) => void, error: (e: unknown) => void): () => void {
    let stop: (() => void) | null = null;
    let stopped = false;
    const uid = this.uid();
    void this.firestore.get().then((db) => {
      if (!stopped) stop = watchCharacters(db, uid, next, error);
    }, error);
    return () => {
      stopped = true;
      stop?.();
    };
  }

  async save(id: string | null, input: CharacterInput, asMain: boolean): Promise<CharacterResult> {
    return saveCharacter(await this.firestore.get(), this.uid(), id, input, asMain);
  }

  async setMain(id: string): Promise<CharacterResult> {
    return setMainCharacter(await this.firestore.get(), this.uid(), id);
  }

  async remove(character: Pick<Character, 'id' | 'isMain'>): Promise<CharacterResult> {
    return removeCharacter(await this.firestore.get(), this.uid(), character);
  }
}
