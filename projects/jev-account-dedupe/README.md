# Jev CRM Account Deduplication Demo

A visual Next.js demonstration of **Jev** (TypeSafe AI's System One evaluation model on **Vercel AI Gateway**) performing real-time account deduplication for CRM and organizational data.

## Why Jev for Deduplication?

Traditional LLMs (like GPT-4o or Claude) rely on autoregressive token-by-token generation to produce structured text, introducing token-generation latency (~800–1,500ms) and high token costs.

**Jev is a System One evaluation model:**
- **Zero Output Tokens:** Directly returns calibrated numeric scores, confidence values, and boolean probabilities.
- **Ultra-Fast:** Typically evaluates decisions in **~50–100ms**.
- **Fraction of the Cost:** Priced at **$0.042 per 1,000,000 input tokens** on Vercel AI Gateway (~22x cheaper than `gpt-4o-mini` and ~370x cheaper than `gpt-4o`).

---

## 3-Pane Architecture

1. **Left Pane — Existing CRM Accounts Database:**
   - Pre-loaded with 25 enterprise accounts (Stripe, Datadog, Snowflake, Linear, Vercel, Supabase, etc.).
   - Toggle between interactive CRM Table and raw JSON view.
   - Real-time search and inspection modal.

2. **Center Pane — Inbound Stream & Controls:**
   - 50 curated inbound test accounts covering:
     - Exact duplicates (`https://stripe.com`)
     - Fuzzy duplicates / typos / suffixes (`Data Dog LLC`, `Snowflake Data Cloud`)
     - Cross-border & corporate subsidiaries (`Stripe Payments Europe Ltd`, `GitHub UK Limited`)
     - False-positive name collisions (`Linear Roofing & Construction`, `Snowflake Ski Lodge`)
     - Brand new tech companies (`Modal Labs`, `Railway Corp`, `LangChain`)
   - **Pipeline Strategy Selector:**
     - ⚡ **Hybrid Optimized (Deterministic + Jev)**: Rules handle trivial matches for $0.00 / 0ms; Jev evaluates ambiguous pairs.
     - 🧠 **Naive Jev (AI Candidate Only)**: Demonstrates pure System One speed and zero-token generation.
     - 🐢 **OpenAI Baseline (gpt-4o-mini)**: Side-by-side benchmark for latency, tokens, and cost.
   - Batch runner: Process 1, Process 10, or Process All 50 with live NDJSON streaming.

3. **Right Pane — Real-Time Tracing & Metrics:**
   - **Live Metrics:** Average Latency (ms), Total Cost ($), Cost Savings Multiple, and Decision breakdown (Merged, Review Queue, Created).
   - **Cost Comparison Bar:** Visual benchmark per 1,000 accounts ($0.005 for Jev vs $0.110 for GPT-4o-mini vs $1.850 for GPT-4o).
   - **Execution Trace Audit:** Step-by-step breadcrumb for each inbound account showing deterministic rule result, candidate blocking score, Jev rubric score, and final action.

---

## Getting Started

### 1. Install dependencies
```bash
npm install
```

### 2. Configure Environment (Optional)
Copy the example environment file:
```bash
cp .env.example .env.local
```

Add either your direct TypeSafe API key or Vercel AI Gateway key:
```env
# Option A: Direct TypeSafe AI Key (Recommended)
TYPESAFE_API_KEY=your_typesafe_api_key

# Option B: Vercel AI Gateway Key
AI_GATEWAY_API_KEY=your_vercel_ai_gateway_key
```

*Note: If no API key is configured, the application automatically runs in full-fidelity sandbox mode with calibrated latencies (~75ms vs ~950ms) and realistic score distributions.*

### 3. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3001](http://localhost:3001) in your browser.

---

## Live Presentation Features

- **Collapsible Panels**: Any of the 3 panels (CRM Database, Inbound Queue, Inspector) can be collapsed to 40px docks to focus audience attention.
- **Focus Modes**: Collapse CRM and Queue to make the Inspector and Cost Benchmark **100% full-screen** for live demonstrations.
- **Cost Benchmark Tab**: Interactive live comparison against GPT-4o-mini, Claude 3.5 Haiku, GPT-4o, and Claude 3.5 Sonnet with scale projections for 10k, 100k, and 1M records.
