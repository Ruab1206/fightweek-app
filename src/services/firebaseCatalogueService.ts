import { collection, doc, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { PUBLIC_DATA_PATH } from '../config/constants';
import type { CatalogueClass } from '../types/catalogue';

const COL = collection(db, PUBLIC_DATA_PATH, 'catalogue');

type CatalogueInput = Omit<CatalogueClass, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>;

export async function addCatalogueClass(data: CatalogueInput, createdBy?: string): Promise<string> {
  const now = new Date().toISOString();
  const ref = await addDoc(COL, { ...data, createdBy: createdBy ?? null, createdAt: now, updatedAt: now });
  return ref.id;
}

export async function updateCatalogueClass(id: string, data: Partial<CatalogueInput>): Promise<void> {
  await updateDoc(doc(db, PUBLIC_DATA_PATH, 'catalogue', id), {
    ...data,
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteCatalogueClass(id: string): Promise<void> {
  await deleteDoc(doc(db, PUBLIC_DATA_PATH, 'catalogue', id));
}
