import { pipeline, env } from '@xenova/transformers';
import path from 'node:path';
import { app } from 'electron';
import fs from 'node:fs';

// Configure transformers.js environment for Electron
// We store models in the user data directory so they persist across app updates
const modelCacheDir = path.join(app.getPath('userData'), 'ai_models');
if (!fs.existsSync(modelCacheDir)) {
  fs.mkdirSync(modelCacheDir, { recursive: true });
}

env.cacheDir = modelCacheDir;
env.remoteHost = 'https://hf-mirror.com';

let extractor: any = null;
let initPromise: Promise<any> | null = null;

/**
 * Initialize the feature extraction pipeline.
 * We use Xenova/all-MiniLM-L6-v2 because it's the gold standard for English 
 * semantic matching, small (around 22MB), and handles asymmetric queries well.
 */
export async function initSemanticModel() {
  if (extractor) return extractor;
  if (initPromise) return initPromise;
  
  initPromise = new Promise(async (resolve, reject) => {
    try {
      // Create a feature-extraction pipeline
      extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
        quantized: true, // Use int8 quantization to save RAM
      });
      resolve(extractor);
    } catch (e) {
      console.error("Failed to load semantic model:", e);
      initPromise = null;
      reject(e);
    }
  });

  return initPromise;
}

/**
 * Generate an embedding vector for a given text.
 */
export async function getEmbedding(text: string): Promise<number[]> {
  if (!text || text.trim() === '') return [];
  if (!extractor) await initSemanticModel();
  
  // Extract features (generate embedding)
  // pooling: 'cls' gets the embedding for the whole sequence
  // normalize: true L2-normalizes the vector, which means dot product == cosine similarity
  const output = await extractor(text, { pooling: 'cls', normalize: true });
  return Array.from(output.data);
}

/**
 * Calculate the cosine similarity between two vectors.
 * Since our vectors are L2-normalized by the model, dot product is mathematically 
 * equivalent to cosine similarity and much faster.
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0 || vecA.length !== vecB.length) return 0;
  
  let dotProduct = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
  }
  return dotProduct;
}
