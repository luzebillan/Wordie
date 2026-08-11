import * as lancedb from "@lancedb/lancedb";
import path from 'node:path';
import { app } from 'electron';
import { getEmbedding } from './semantic';

// Connect to the local LanceDB in the user data directory
const dbDir = path.join(app.getPath('userData'), 'lancedb');
let dbPromise: Promise<lancedb.Connection> | null = null;
let tablePromise: Promise<lancedb.Table> | null = null;

async function getDb() {
  if (!dbPromise) {
    dbPromise = lancedb.connect(dbDir);
  }
  return dbPromise;
}

export async function getVectorTable(): Promise<lancedb.Table | null> {
  const db = await getDb();
  const tableNames = await db.tableNames();
  if (tableNames.includes('cards')) {
    if (!tablePromise) {
      tablePromise = db.openTable('cards');
    }
    return tablePromise;
  }
  return null;
}

export async function addCardVector(id: number, front: string, back: string, type: string) {
  const embedding = await getEmbedding(front + ": " + back);
  if (!embedding || embedding.length === 0) return;

  const db = await getDb();
  const tableNames = await db.tableNames();
  
  const data = [{ id, front, type, vector: embedding }];

  if (!tableNames.includes('cards')) {
    tablePromise = db.createTable('cards', data);
    await tablePromise;
  } else {
    const table = await getVectorTable();
    if (table) {
      await table.add(data);
    }
  }
}

export async function updateCardVector(id: number, front: string, back: string, type: string) {
  const table = await getVectorTable();
  if (!table) return;

  await table.delete(`id = ${id}`);
  await addCardVector(id, front, back, type);
}

export async function deleteCardVector(id: number) {
  const table = await getVectorTable();
  if (!table) return;
  await table.delete(`id = ${id}`);
}

export async function clearVectorTable() {
  const db = await getDb();
  const tableNames = await db.tableNames();
  if (tableNames.includes('cards')) {
    await db.dropTable('cards');
    tablePromise = null;
  }
}

export async function searchCardVectors(queryText: string, type?: string, limit: number = 15) {
  const table = await getVectorTable();
  if (!table) return [];

  const queryVector = await getEmbedding(queryText);
  if (!queryVector || queryVector.length === 0) return [];

  let query = table.search(queryVector).limit(limit);
  
  if (type) {
    query = query.where(`type = '${type}'`);
  }

  const results = await query.toArray();
  return results;
}
