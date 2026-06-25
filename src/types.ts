export interface DebugTiming {
    embedding_ms: number;
    dense_ms: number;
    sparse_ms: number;
    fusion_ms: number;
    total_ms: number | null;
}

export interface DebugResultItem {
    id: string;
    title: string | null;
    rank: number;
    score: number;
    metadata: Record<string, any>;
}

export interface DebugFusionResultItem {
    id: string;
    title: string | null;
    final_rank: number;
    dense_rank: number | null;
    sparse_rank: number | null;
    raw_field_scores: Record<string, number>;
    raw_dense_score: number;
    norm_dense_score: number;
    raw_sparse_score: number;
    norm_sparse_score: number;
    rrf_score: number;
    final_score: number;
    metadata: Record<string, any>;
}

export interface DebugSearchResponse {
    query: string;
    embedding_model: string;
    fusion_method: string; // "weighted" (default) or "rrf"
    rrf_k: number;
    timing: DebugTiming;
    field_weights: Record<string, number>;
    dense_weight: number;
    sparse_weight: number;
    // Optional: only present when the debug server has been restarted with the
    // pool-stats change. Guard before use so an older backend doesn't crash the UI.
    dense_min?: number;
    dense_max?: number;
    sparse_min?: number;
    sparse_max?: number;
    dense_results: DebugResultItem[];
    sparse_results: DebugResultItem[];
    fusion_results: DebugFusionResultItem[];
}
