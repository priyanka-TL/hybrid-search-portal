import type { DebugSearchResponse, DebugFusionResultItem } from './types';
import { useState } from 'react';
import './index.css';

function App() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DebugSearchResponse | null>(null);
  const [selectedItem, setSelectedItem] = useState<DebugFusionResultItem | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setData(null);

    try {
      const response = await fetch('http://localhost:9001/debug/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, top_k: 20 }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      const result: DebugSearchResponse = await response.json();
      setData(result);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch search results');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      {/* ... header and search ... */}
      <header className="header">
        <h1>Hybrid Search Analysis</h1>
        <p>Analyze how the vector service scores and ranks documents</p>
      </header>

      <div className="glass-panel" style={{ marginBottom: '2rem' }}>
        <form className="search-form" onSubmit={handleSearch}>
          <input
            type="text"
            className="search-input"
            placeholder="Enter search query (e.g. Teach with Tech)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="submit" className="search-btn" disabled={loading || !query.trim()}>
            {loading ? 'Searching...' : 'Search'}
          </button>
        </form>

        {error && <div className="error-message">{error}</div>}

        {data && (
          <div className="timing-grid">
            <div className="timing-card">
              <div className="timing-value">{data.timing.embedding_ms}ms</div>
              <div className="timing-label">Embedding</div>
            </div>
            <div className="timing-card">
              <div className="timing-value">{data.timing.dense_ms}ms</div>
              <div className="timing-label">Dense</div>
            </div>
            <div className="timing-card">
              <div className="timing-value">{data.timing.sparse_ms}ms</div>
              <div className="timing-label">Sparse</div>
            </div>
            <div className="timing-card">
              <div className="timing-value">{data.timing.fusion_ms}ms</div>
              <div className="timing-label">Fusion</div>
            </div>
            {data.timing.total_ms !== null && (
              <div className="timing-card">
                <div className="timing-value" style={{ color: 'var(--success)' }}>{data.timing.total_ms}ms</div>
                <div className="timing-label">Total</div>
              </div>
            )}
          </div>
        )}
      </div>

      {data && (
        <div className="results-container">
          <div className="glass-panel">
            <h2 className="column-title">
              Dense Results
              <span className="badge">{data.dense_results.length}</span>
            </h2>
            <div className="result-list">
              {data.dense_results.map((item) => (
                <div key={item.id} className="result-card" onClick={() => {
                  const fusionMatch = data.fusion_results.find(f => f.id === item.id);
                  if (fusionMatch) setSelectedItem(fusionMatch);
                }}>
                  <div className="result-rank">#{item.rank}</div>
                  <div className="result-title">{item.title || 'Untitled Document'}</div>
                  <div className="result-score">
                    <span>Score:</span>
                    <span className="score-value">{item.score.toFixed(4)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-panel">
            <h2 className="column-title">
              Sparse Results
              <span className="badge">{data.sparse_results.length}</span>
            </h2>
            <div className="result-list">
              {data.sparse_results.map((item) => (
                <div key={item.id} className="result-card" onClick={() => {
                  const fusionMatch = data.fusion_results.find(f => f.id === item.id);
                  if (fusionMatch) setSelectedItem(fusionMatch);
                }}>
                  <div className="result-rank">#{item.rank}</div>
                  <div className="result-title">{item.title || 'Untitled Document'}</div>
                  <div className="result-score">
                    <span>Score:</span>
                    <span className="score-value">{item.score.toFixed(4)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-panel">
            <h2 className="column-title">
              Fusion Results
              <span className="badge">{data.fusion_results.length}</span>
            </h2>
            <div className="result-list">
              {data.fusion_results.map((item) => (
                <div key={item.id} className="result-card" onClick={() => setSelectedItem(item)}>
                  <div className="result-rank fusion-rank">#{item.final_rank}</div>
                  <div className="result-title">{item.title || 'Untitled Document'}</div>
                  <div className="result-score">
                    <span>API Score:</span>
                    <span className="score-value">{item.final_score.toFixed(4)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      <div className={`modal-overlay ${selectedItem ? 'open' : ''}`} onClick={() => setSelectedItem(null)}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          {selectedItem && data && (
            <>
              <div className="modal-header">
                <h3 className="modal-title">Rank #{selectedItem.final_rank}: {selectedItem.title}</h3>
                <button className="close-btn" onClick={() => setSelectedItem(null)}>&times;</button>
              </div>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                
                {/* 1. Score Lineage Map */}
                <section>
                  <div className="score-box-title">
                    1. Architecture Lineage Journey
                    <span className="badge" style={{ marginLeft: '0.75rem' }}>
                      fusion: {data.fusion_method}
                    </span>
                  </div>
                  <div className="lineage-flow">
                    <div className="lineage-step">1. Qdrant Raw Field Scores — 5 dense cosines + BM25 sparse</div>
                    <div className="lineage-arrow">↓</div>
                    <div className="lineage-step">2. Hybrid Mode Detection Gate (raw BM25 score present)</div>
                    <div className="lineage-arrow">↓</div>
                    <div className="lineage-step highlight">3. Field-Weighted Dense Sum (raw_dense) + Raw BM25 (raw_sparse)</div>
                    <div className="lineage-arrow">↓</div>

                    {data.fusion_method === 'rrf' ? (
                      <>
                        <div className="lineage-step highlight">4. Rank both lists → RRF = 1/(k+dense_rank) + 1/(k+sparse_rank)</div>
                        <div className="lineage-arrow">↓</div>
                        <div className="lineage-step highlight">5. Min-Max Normalize RRF → [0, 1] final score</div>
                      </>
                    ) : (
                      <>
                        <div className="lineage-step highlight">4. Min-Max Normalize each modality → [0, 1]</div>
                        <div className="lineage-arrow">↓</div>
                        <div className="lineage-step highlight">5. Cross-Modality Linear Combination (0.7·dense + 0.3·sparse)</div>
                      </>
                    )}

                    {/* Post-Scoring Phases */}
                    <div className="lineage-divider">Post-Scoring Pipeline (Vector Service)</div>

                    <div className="lineage-step post-scoring">6. Title/Summary Boost (×2.5/×1.5/×1.4/×1.2, capped at 1.0)</div>
                    <div className="lineage-arrow">↓</div>
                    <div className="lineage-step post-scoring">7. filter_score / detail_filter_score Gate</div>
                    <div className="lineage-arrow">↓</div>
                    <div className="lineage-step final">8. Final API Result List (Top K)</div>
                  </div>
                </section>

                {/* 2. Dense Score Breakdown */}
                <section>
                  <div className="score-box-title">2. Dense Score Breakdown</div>
                  <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '1rem' }}>
                    <p style={{ margin: '0', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                      <strong>How are Raw Qdrant Scores calculated?</strong> The Vector Service converts the user's text query into a mathematical vector (using the <code>{data.embedding_model}</code> embedding model configured in the environment variables). Qdrant then calculates the <strong>Cosine Similarity</strong> between the query vector and the document's pre-computed vector for each field. The result is a score from -1.0 to 1.0, where 1.0 represents perfect semantic alignment.
                    </p>
                  </div>
                  <div className="table-wrapper">
                    <table className="breakdown-table">
                      <thead>
                        <tr>
                          <th>Vector Field</th>
                          <th>Raw Qdrant Score</th>
                          <th>Backend Weight</th>
                          <th>Contribution</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(data.field_weights).map(([field, weight]) => {
                          const raw = selectedItem.raw_field_scores[field] || 0.0;
                          const contrib = raw * weight;
                          return (
                            <tr key={field}>
                              <td style={{ textTransform: 'capitalize' }}>{field}</td>
                              <td>{raw.toFixed(7)}</td>
                              <td>× {weight.toFixed(2)}</td>
                              <td>{contrib.toFixed(7)}</td>
                            </tr>
                          );
                        })}
                        <tr className="summary-row">
                          <td colSpan={3} style={{ textAlign: 'right' }}><strong>Raw Dense Score:</strong></td>
                          <td><strong>{selectedItem.raw_dense_score.toFixed(7)}</strong></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* 3. Sparse Score Breakdown */}
                <section>
                  <div className="score-box-title">3. Sparse Score Breakdown</div>
                  <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <p style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                      <strong>How is the Raw BM25 Score calculated?</strong> The vector service uses FastEmbed to generate a sparse vector representing the keywords in the query. Qdrant performs an exact-match keyword search (BM25 algorithms) against the document's sparse index, resulting in an unbounded positive score based on term frequency and inverse document frequency.
                    </p>
                    <div className="score-grid-2">
                      <div className="score-box">
                        <div className="score-box-title">Sparse Rank</div>
                        <div className="score-box-val">{selectedItem.sparse_rank ? `#${selectedItem.sparse_rank}` : 'N/A'}</div>
                      </div>
                      <div className="score-box">
                        <div className="score-box-title">Raw BM25 Score</div>
                        <div className="score-box-val">{selectedItem.raw_sparse_score.toFixed(4)}</div>
                      </div>
                    </div>
                  </div>
                </section>

                {/* 4. RRF Breakdown */}
                <section>
                  <div className="score-box-title">4. Reciprocal Rank Fusion (RRF)</div>
                  <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    {data.fusion_method === 'rrf' ? (
                      <>
                        <code style={{ display: 'block', marginBottom: '1rem', color: 'var(--accent-hover)' }}>
                          RRF = 1 / ({data.rrf_k} + dense_rank) + 1 / ({data.rrf_k} + sparse_rank)
                        </code>
                        <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                          RRF fuses exactly <strong>two</strong> lists: the combined dense list (the 5 dense
                          fields collapsed into one field-weighted cosine sum) and the BM25 sparse list. A
                          document with no sparse hit contributes only the dense term. The raw RRF value is then
                          min-max normalized to [0, 1] to produce the final score (raw RRF is only ~0.016–0.03).
                        </p>
                        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '4px', fontFamily: 'monospace' }}>
                          1/({data.rrf_k}+{selectedItem.dense_rank ?? '∞'}) + 1/({data.rrf_k}+{selectedItem.sparse_rank ?? '∞'}) = {selectedItem.rrf_score.toFixed(6)} (raw, pre-normalization)
                        </div>
                      </>
                    ) : (
                      <p style={{ margin: '0', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                        <strong>Not used in this run.</strong> The active fusion method is
                        <code> weighted</code>, which combines min-max normalized dense and sparse scores
                        directly (see section 5). RRF is only applied when
                        <code> HYBRID_FUSION_METHOD=rrf</code>. The legacy per-field RRF key has been removed
                        from the backend, so no RRF value is computed here.
                      </p>
                    )}
                  </div>
                </section>

                {/* 5. Final API Score Explanation */}
                <section>
                  <div className="score-box-title">
                    5. {data.fusion_method === 'rrf' ? 'RRF Normalization → Final Score' : 'Cross-Modality Linear Combination'}
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <p style={{ margin: '0 0 1rem 0' }}><strong>Why does the API return {selectedItem.final_score.toFixed(4)}?</strong></p>

                    {data.fusion_method === 'rrf' ? (
                      <>
                        <ul style={{ margin: '0 0 1rem 0', paddingLeft: '1.5rem', lineHeight: '1.6', color: 'var(--text-muted)' }}>
                          <li><strong>Rank fusion:</strong> the raw RRF value ({selectedItem.rrf_score.toFixed(6)}) is computed from this doc's dense rank (#{selectedItem.dense_rank ?? 'N/A'}) and sparse rank (#{selectedItem.sparse_rank ?? 'N/A'}) — see section 4.</li>
                          <li><strong>Min-Max Scaling:</strong> raw RRF values (~0.016–0.03) are normalized <code>(rrf - min) / (max - min)</code> across the candidate pool so the score lands on a calibrated [0, 1] scale comparable to <code>filter_score</code>. Field weights ({data.dense_weight}/{data.sparse_weight}) do <em>not</em> apply in RRF mode — they only shape the combined dense list's ordering.</li>
                        </ul>
                        <div className="math-block">
                          <div className="math-row math-total" style={{ color: 'var(--success)', fontWeight: 'bold' }}>
                            <span>minmax( raw RRF {selectedItem.rrf_score.toFixed(6)} )</span>
                            <span>= {selectedItem.final_score.toFixed(4)}</span>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <ul style={{ margin: '0 0 1rem 0', paddingLeft: '1.5rem', lineHeight: '1.6', color: 'var(--text-muted)' }}>
                          <li><strong>Min-Max Scaling:</strong> To combine the Dense Score ({selectedItem.raw_dense_score.toFixed(4)}) and Sparse Score ({selectedItem.raw_sparse_score.toFixed(4)}), the backend applies Min-Max normalization <code>(score - min) / (max - min)</code> across the entire retrieved candidate pool ({data.fusion_results.length} candidates).</li>
                          <li><strong>Modality Weighting:</strong> The normalized scores are linearly combined using the global Hybrid Weights (not to be confused with Field Weights).</li>
                        </ul>

                        {data.dense_min !== undefined && data.dense_max !== undefined &&
                         data.sparse_min !== undefined && data.sparse_max !== undefined && (
                          <>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 0.4rem 0' }}><strong>Step A — Min-Max Normalization (using this query's pool min/max)</strong></div>
                            <div className="math-block" style={{ marginBottom: '1rem' }}>
                              <div className="math-row">
                                <span>Dense: (raw {selectedItem.raw_dense_score.toFixed(4)} − min {data.dense_min.toFixed(4)}) / (max {data.dense_max.toFixed(4)} − min {data.dense_min.toFixed(4)})</span>
                                <span>= {selectedItem.norm_dense_score.toFixed(4)}</span>
                              </div>
                              <div className="math-row">
                                <span>Sparse: (raw {selectedItem.raw_sparse_score.toFixed(4)} − min {data.sparse_min.toFixed(4)}) / (max {data.sparse_max.toFixed(4)} − min {data.sparse_min.toFixed(4)})</span>
                                <span>= {selectedItem.norm_sparse_score.toFixed(4)}</span>
                              </div>
                            </div>
                          </>
                        )}

                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 0.4rem 0' }}><strong>Step B — Modality Weighting</strong></div>
                        <div className="math-block">
                          <div className="math-row">
                            <span>Dense Normalized ({selectedItem.norm_dense_score.toFixed(4)}) × Modality Weight ({data.dense_weight})</span>
                            <span>= {(selectedItem.norm_dense_score * data.dense_weight).toFixed(4)}</span>
                          </div>
                          <div className="math-row">
                            <span>+ Sparse Normalized ({selectedItem.norm_sparse_score.toFixed(4)}) × Modality Weight ({data.sparse_weight})</span>
                            <span>= {(selectedItem.norm_sparse_score * data.sparse_weight).toFixed(4)}</span>
                          </div>
                          <div className="math-row math-total" style={{ color: 'var(--success)', fontWeight: 'bold', paddingTop: '0.5rem', marginTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                            <span>Final Weighted Score</span>
                            <span>= {selectedItem.final_score.toFixed(4)}</span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </section>

                {/* 6. Explain Ranking */}
                <section>
                  <div className="score-box-title">6. Ranking Summary</div>
                  <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <p style={{ margin: '0', lineHeight: '1.6' }}>
                      This document ranked <strong>#{selectedItem.final_rank}</strong> primarily because it placed <strong>#{selectedItem.dense_rank || 'N/A'}</strong> out of {data.dense_results.length} in semantic density, and <strong>#{selectedItem.sparse_rank || 'N/A'}</strong> out of {data.sparse_results.length} in exact keyword matching.
                      {data.fusion_method === 'rrf'
                        ? ' Under RRF fusion the final order is driven by these two rank positions (lower ranks → higher reciprocal contribution), then min-max normalized across the pool.'
                        : ' Because the backend min-max normalizes the top dense score to 1.0 and the top sparse score to 1.0, '}
                      {data.fusion_method !== 'rrf' && (selectedItem.final_rank === 1 ? 'this document achieved the highest combined normalized score, pushing it to 1.0.' : 'this document was ranked proportionately to the highest-scoring candidate in the pool.')}
                    </p>
                  </div>
                </section>

                <section>
                  <div className="score-box-title" style={{ marginBottom: '0.5rem' }}>7. Raw Item Metadata</div>
                  <pre className="json-pre">
                    {JSON.stringify(selectedItem.metadata, null, 2)}
                  </pre>
                </section>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
