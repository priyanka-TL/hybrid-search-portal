"""
Temporary Debug Server for Hybrid Search Analysis Portal
--------------------------------------------------------
To run this server:
1. Make sure you are in the vectorization-service directory
2. Activate your virtual environment if applicable
3. Run: python3 temp_debug_server.py
OR
3. Run: .venv/bin/python3 temp_debug_server.py
"""
import time
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

from app.models.api_models import PrioritizedSearchRequest
from app.services.prioritized_search_service import PrioritizedSearchService
from app.config import settings
from app.core.clients.embedding import generate_embeddings

app = FastAPI(title="Hybrid Search Debug API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class DebugTiming(BaseModel):
    embedding_ms: int
    dense_ms: int
    sparse_ms: int
    fusion_ms: int
    total_ms: Optional[int] = None

class DebugResultItem(BaseModel):
    id: str
    title: Optional[str] = None
    rank: int
    score: float
    metadata: Dict[str, Any]

class DebugFusionResultItem(BaseModel):
    id: str
    title: Optional[str] = None
    final_rank: int
    dense_rank: Optional[int] = None
    sparse_rank: Optional[int] = None
    raw_field_scores: Dict[str, float]
    raw_dense_score: float
    norm_dense_score: float
    raw_sparse_score: float
    norm_sparse_score: float
    rrf_score: float
    final_score: float
    metadata: Dict[str, Any]

class DebugSearchResponse(BaseModel):
    query: str
    embedding_model: str
    fusion_method: str
    rrf_k: int
    timing: DebugTiming
    field_weights: Dict[str, float]
    dense_weight: float
    sparse_weight: float
    # Candidate-pool min/max used by the min-max normalization step. These are the
    # actual (min, max) over the whole retrieved pool, so the portal can show the
    # exact (score - min) / (max - min) calculation per document.
    dense_min: float
    dense_max: float
    sparse_min: float
    sparse_max: float
    dense_results: List[DebugResultItem]
    sparse_results: List[DebugResultItem]
    fusion_results: List[DebugFusionResultItem]

search_service = PrioritizedSearchService()

def min_max_normalize(scores: Dict[Any, float]) -> Dict[Any, float]:
    if not scores:
        return {}
    values = list(scores.values())
    lo, hi = min(values), max(values)
    if hi <= lo:
        return {k: (1.0 if v > 0 else 0.0) for k, v in scores.items()}
    span = hi - lo
    return {k: (v - lo) / span for k, v in scores.items()}

@app.post("/debug/search", response_model=DebugSearchResponse)
def debug_search(request: PrioritizedSearchRequest):
    t0 = time.time()
    
    # Preprocess query
    from app.utils.query_preprocessor import preprocess_query
    preprocessed = preprocess_query(request.query)
    query_for_embedding = preprocessed if preprocessed.strip() else request.query
    
    query_embedding = generate_embeddings([query_for_embedding])[0]
        
    embedding_ms = int((time.time() - t0) * 1000)

    filter_conditions = search_service._build_filters(
        categories=request.categories, organizations=request.organizations,
        resource_types=request.resource_type, file_types=request.file_type
    )

    t1 = time.time()
    search_fields = search_service.priority_order
    limit = search_service._candidate_limit(request.top_k)
    
    if settings.SPARSE_SEARCH_ENABLED:
        all_results, field_scores = search_service._hybrid_batch_search(
            search_fields=search_fields,
            query_text=query_for_embedding,
            query_embedding=query_embedding,
            filter_conditions=filter_conditions,
            limit=limit,
        )
    else:
        all_results, field_scores = search_service._parallel_batch_search(
            search_fields=search_fields,
            weights=search_service.default_weights,
            query_embedding=query_embedding,
            filter_conditions=filter_conditions,
            limit=limit,
        )
        
    batch_ms = int((time.time() - t1) * 1000)
    
    dense_ms = batch_ms
    sparse_ms = 0

    sparse_name = settings.SPARSE_VECTOR_NAME
    
    raw_dense = {}
    raw_sparse = {}
    
    for point_id, fs in field_scores.items():
        dense = 0.0
        for field in search_fields:
            if field in search_service.default_weights:
                score = fs.get(field)
                if score is not None:
                    dense += score * search_service.default_weights[field]
        raw_dense[point_id] = dense
        raw_sparse[point_id] = fs.get(sparse_name) or 0.0

    norm_dense = min_max_normalize(raw_dense)
    norm_sparse = min_max_normalize(raw_sparse)

    # Pool min/max that the normalization above is based on — surfaced so the portal
    # can render the exact (score - min) / (max - min) arithmetic.
    dense_vals = list(raw_dense.values())
    sparse_vals = list(raw_sparse.values())
    dense_min = min(dense_vals) if dense_vals else 0.0
    dense_max = max(dense_vals) if dense_vals else 0.0
    sparse_min = min(sparse_vals) if sparse_vals else 0.0
    sparse_max = max(sparse_vals) if sparse_vals else 0.0

    dense_w = settings.HYBRID_DENSE_WEIGHT
    sparse_w = settings.HYBRID_SPARSE_WEIGHT

    # Build dense_results
    dense_items = []
    for pid, score in raw_dense.items():
        if score > 0:
            dense_items.append({
                "id": pid,
                "title": all_results[pid].payload.get("title"),
                "score": score,
                "metadata": all_results[pid].payload.get("metadata", {})
            })
    dense_items.sort(key=lambda x: x["score"], reverse=True)
    dense_results = []
    for rank, item in enumerate(dense_items):
        dense_results.append(DebugResultItem(
            id=item["id"], title=item["title"], score=item["score"],
            metadata=item["metadata"], rank=rank + 1
        ))

    # Build sparse_results
    sparse_items = []
    for pid, score in raw_sparse.items():
        if score > 0:
            sparse_items.append({
                "id": pid,
                "title": all_results[pid].payload.get("title"),
                "score": score,
                "metadata": all_results[pid].payload.get("metadata", {})
            })
    sparse_items.sort(key=lambda x: x["score"], reverse=True)
    sparse_results = []
    for rank, item in enumerate(sparse_items):
        sparse_results.append(DebugResultItem(
            id=item["id"], title=item["title"], score=item["score"],
            metadata=item["metadata"], rank=rank + 1
        ))

    t2 = time.time()
    # Rank results (this is the authoritative fused score the API returns).
    # _rank_results stashes the real fusion diagnostics on each entry:
    #   keyword_score, rrf_score, dense_rank, sparse_rank.
    # In "weighted" mode rrf_score/dense_rank/sparse_rank are None (no RRF computed);
    # in "rrf" mode they carry the values that actually produced the ranking.
    ranked = search_service._rank_results(
        all_results=all_results,
        field_scores=field_scores,
        weights=search_service.default_weights,
        search_fields=search_fields
    )
    fusion_ms = int((time.time() - t2) * 1000)

    # Build fusion_results
    fusion_results = []
    for rank_idx, item in enumerate(ranked):
        pid = item['id']
        # Manual ranks (always available) — used in "weighted" mode where the backend
        # does not compute per-modality ranks. In "rrf" mode prefer the backend's own
        # ranks since those are what fed the fusion.
        manual_drank = next((i + 1 for i, d in enumerate(dense_items) if d["id"] == pid), None)
        manual_srank = next((i + 1 for i, s in enumerate(sparse_items) if s["id"] == pid), None)
        drank = item.get("dense_rank") if item.get("dense_rank") is not None else manual_drank
        srank = item.get("sparse_rank") if item.get("sparse_rank") is not None else manual_srank

        # Get raw field scores without the internal sparse key for display
        raw_fs = {k: v for k, v in field_scores[pid].items() if k != sparse_name}

        fusion_results.append(DebugFusionResultItem(
            id=pid,
            title=all_results[pid].payload.get("title"),
            final_rank=rank_idx + 1,
            dense_rank=drank,
            sparse_rank=srank,
            raw_field_scores=raw_fs,
            raw_dense_score=raw_dense.get(pid, 0.0),
            norm_dense_score=norm_dense.get(pid, 0.0),
            raw_sparse_score=raw_sparse.get(pid, 0.0),
            norm_sparse_score=norm_sparse.get(pid, 0.0),
            # Raw RRF value (pre-normalization), populated only in "rrf" fusion mode.
            rrf_score=item.get("rrf_score") or 0.0,
            final_score=item.get("weighted_score", 0.0),
            metadata=all_results[pid].payload.get("metadata", {})
        ))

    total_ms = int((time.time() - t0) * 1000)
    timing = DebugTiming(
        embedding_ms=embedding_ms,
        dense_ms=dense_ms,
        sparse_ms=sparse_ms,
        fusion_ms=fusion_ms,
        total_ms=total_ms
    )

    return DebugSearchResponse(
        query=request.query,
        embedding_model=settings.EMBEDDING_MODEL,
        fusion_method=settings.HYBRID_FUSION_METHOD,
        rrf_k=settings.RRF_K,
        timing=timing,
        field_weights=search_service.default_weights,
        dense_weight=dense_w,
        sparse_weight=sparse_w,
        dense_min=dense_min,
        dense_max=dense_max,
        sparse_min=sparse_min,
        sparse_max=sparse_max,
        dense_results=dense_results,
        sparse_results=sparse_results,
        fusion_results=fusion_results
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=9001)
