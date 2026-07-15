// AI : shared Traditional RAG row types — safe for client + server.

export type chunk_id_string = string;
export type query_string = string;

export type ChunkRetrievalRow = {
  chunk_id: chunk_id_string;
  text: string;
  start: number;
  end: number;
  score: number;
  retrieved: boolean;
  rank: number | null;
  explanation: string;
};

export type RetrievalMissRow = {
  chunk_id: chunk_id_string;
  explanation: string;
  expected: boolean;
  actual: boolean;
};
