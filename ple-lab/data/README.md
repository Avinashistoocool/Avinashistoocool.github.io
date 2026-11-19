# PLE static demo data

These files contain **only the 2,000 most frequent GPT-2 training tokens** from the `ple-small` run. They are intended for a browser-only, read-only visualization; they do not contain a model capable of inference.

- `projection.json`: the `space=shared`, `n=2000` 3D PCA projection. Metadata includes `n`, `space`, `n_layer`, `ple_dim`, `source`, `explained_variance`, `explained_variance_full`, `k`, `clusters`, `init_norm`, `scope`, `vector_file`, `scale_file`, and `row_width`. Each `points[i]` has token `id`, decoded `piece`, frequency `rank` (zero-based), training `freq`, `log_freq`, `coords` (one 3D triple per layer), `full` (3D triple for the full embedding), `norms`, `full_norm`, `max_layer`, and `cluster`. The coordinates are rounded and normalized for display, not reconstructed from the quantized files.
- `vectors.i8.bin`: concatenated signed int8 embedding rows in **exactly the same order** as `points`, each with `row_width = n_layer * ple_dim` values. Each row is laid out as consecutive layers of `ple_dim` components.
- `scales.f32.bin`: one little-endian float32 per row, in the same order. Decode component `j` of row `i` as `vectors[i * row_width + j] * scales[i]`; these are the stored PLE table values before the model's `sqrt(ple_dim)` scaling.

The int8 encoding uses symmetric per-token quantization. Cosine nearest neighbours computed from these files are approximate and **only search the published 2,000-token subset**, not the full vocabulary. No dense model weights, training text, inference, or ablation capabilities are published. The three PCA axes explain only a few percent of embedding variance, so visual proximity in 3D does not establish semantic similarity.
