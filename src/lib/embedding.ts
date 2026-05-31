import { pipeline } from '@huggingface/transformers';

class EmbeddingPipeline {
  static task = 'feature-extraction';
  static model = 'Xenova/bge-m3';
  static instance: any = null;

  static async getInstance() {
    if (this.instance === null) {
      this.instance = await pipeline(this.task as any, this.model);
    }
    return this.instance;
  }
}

export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const embedder = await EmbeddingPipeline.getInstance();
    
    // bge-m3 produces embeddings
    const output = await embedder(text, { pooling: 'mean', normalize: true });
    
    // Convert Float32Array to standard array
    return Array.from(output.data);
  } catch (error) {
    console.error('Embedding Generation Error:', error);
    throw error;
  }
}
