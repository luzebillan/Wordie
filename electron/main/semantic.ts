import { pipeline, env } from '@xenova/transformers';
import path from 'node:path';
import { app } from 'electron';

// Configure transformers.js environment for Electron
let localModelPath = '';
if (app?.isPackaged) {
  // Models are unpacked to app.asar.unpacked so that native C++ ONNX runtime can read them
  localModelPath = path.join(app.getAppPath().replace('app.asar', 'app.asar.unpacked'), 'dist', 'models');
} else if (app?.getAppPath) {
  localModelPath = path.join(app.getAppPath(), 'public', 'models');
} else {
  localModelPath = path.join(process.cwd(), 'public', 'models');
}

env.allowLocalModels = true;
env.localModelPath = localModelPath;
env.allowRemoteModels = false;

let extractor: any = null;
let initPromise: Promise<any> | null = null;

/**
 * Initialize the feature extraction pipeline.
 * We use Xenova/paraphrase-multilingual-MiniLM-L12-v2 for robust multilingual
 * (English, Chinese, etc.) semantic sentence embeddings.
 */
export async function initSemanticModel() {
  if (extractor) return extractor;
  if (initPromise) return initPromise;
  
  initPromise = new Promise(async (resolve, reject) => {
    try {
      // Create a feature-extraction pipeline
      extractor = await pipeline('feature-extraction', 'Xenova/paraphrase-multilingual-MiniLM-L12-v2', {
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
  // pooling: 'mean' computes mean pooling over token embeddings for sentence transformers
  // normalize: true L2-normalizes the vector, which means dot product == cosine similarity
  const output = await extractor(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}

/**
 * Generate embedding vectors for a batch of texts in a single forward pass.
 * This runs SIMD/parallel inference across the batch, avoiding sequential invocation overhead.
 */
export async function getEmbeddingsBatch(texts: string[]): Promise<number[][]> {
  if (!texts || texts.length === 0) return [];
  if (!extractor) await initSemanticModel();

  const safeTexts = texts.map(t => (t && t.trim()) ? t : ' ');
  const output = await extractor(safeTexts, { pooling: 'mean', normalize: true });
  const dim = output.dims[output.dims.length - 1];
  const results: number[][] = [];
  for (let i = 0; i < texts.length; i++) {
    if (!texts[i] || !texts[i].trim()) {
      results.push([]);
    } else {
      const start = i * dim;
      const end = start + dim;
      results.push(Array.from(output.data.subarray(start, end)));
    }
  }
  return results;
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
