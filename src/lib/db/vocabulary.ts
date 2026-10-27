import { getDb, type VocabEntry } from './schema';

/** STO-4: the same word from the same sentence is saved once. */
export async function addVocab(
  fields: Omit<VocabEntry, 'id' | 'createdAt'>,
): Promise<'saved' | 'exists'> {
  const tx = (await getDb()).transaction('vocabulary', 'readwrite');
  const same = await tx.store.index('word').getAll(fields.word);
  if (same.some((e) => e.sentence === fields.sentence)) {
    await tx.done;
    return 'exists';
  }
  await tx.store.add({ ...fields, id: crypto.randomUUID(), createdAt: Date.now() });
  await tx.done;
  return 'saved';
}
