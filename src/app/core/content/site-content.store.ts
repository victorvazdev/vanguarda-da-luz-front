// Leitura e gravação do conteúdo editável no painel (site/guild e site/social).
// Testado contra os emuladores (tests/integration/site-content.spec.ts).
import { FirebaseError } from 'firebase/app';
import { doc, onSnapshot, serverTimestamp, setDoc, type Firestore } from 'firebase/firestore';
import {
  areValidSocialLinks,
  cleanGuildInfo,
  cleanSocialLinks,
  guildInfoFromData,
  isValidGuildInfo,
  socialLinksFromData,
  type GuildInfo,
  type GuildInfoInput,
  type SaveContentResult,
  type SocialLinks,
} from './site-content';

function saveError(error: unknown): SaveContentResult {
  const code = error instanceof FirebaseError ? error.code : '';
  if (code === 'permission-denied') return { ok: false, error: 'not-allowed' };
  if (code === 'unavailable') return { ok: false, error: 'network' };
  return { ok: false, error: 'unknown' };
}

export function watchGuildInfo(
  db: Firestore,
  next: (info: GuildInfo) => void,
  error: (e: unknown) => void,
): () => void {
  return onSnapshot(
    doc(db, 'site', 'guild'),
    (snap) => next(guildInfoFromData(snap.data())),
    error,
  );
}

export function watchSocialLinks(
  db: Firestore,
  next: (links: SocialLinks) => void,
  error: (e: unknown) => void,
): () => void {
  return onSnapshot(
    doc(db, 'site', 'social'),
    (snap) => next(socialLinksFromData(snap.data())),
    error,
  );
}

export async function saveGuildInfo(
  db: Firestore,
  adminUid: string,
  input: GuildInfoInput,
): Promise<SaveContentResult> {
  const clean = cleanGuildInfo(input);
  if (!isValidGuildInfo(clean)) return { ok: false, error: 'invalid' };
  try {
    await setDoc(doc(db, 'site', 'guild'), {
      ...clean,
      updatedAt: serverTimestamp(),
      updatedBy: adminUid,
    });
    return { ok: true };
  } catch (error) {
    return saveError(error);
  }
}

export async function saveSocialLinks(
  db: Firestore,
  adminUid: string,
  links: SocialLinks,
): Promise<SaveContentResult> {
  const clean = cleanSocialLinks(links);
  if (!areValidSocialLinks(clean)) return { ok: false, error: 'invalid' };
  try {
    await setDoc(doc(db, 'site', 'social'), {
      links: clean,
      updatedAt: serverTimestamp(),
      updatedBy: adminUid,
    });
    return { ok: true };
  } catch (error) {
    return saveError(error);
  }
}
