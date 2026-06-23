# Hybrid Search Analysis Portal

A lightweight React + Vite + TypeScript frontend designed to visualize and analyze hybrid search scores from the vectorization-service without modifying core production code.

## How to Run

### Step 1: Start the Temporary Debug API
This portal requires a temporary debug API to extract intermediate scores from the vector service.
1. Open a new terminal window.
2. Navigate to your vectorization-service directory:
   ```bash
   cd /Users/priyankapradeep/Desktop/SG_COMMON/vectorization-service
   ```
3. Run the standalone script (adjust the python path if you use a specific virtual environment):
   ```bash
   .venv/bin/python3 temp_debug_server.py
   ```
   *The debug server will run on `http://localhost:9001`.*

### Step 2: Start this React Portal
1. Open a new terminal window.
2. Navigate to this directory:
   ```bash
   cd /Users/priyankapradeep/Desktop/SG_COMMON/hybrid-search-portal
   ```
3. Install dependencies (if you haven't already):
   ```bash
   npm install
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```
5. Open your browser to `http://localhost:5173/` and run your search queries!

## Design Details
- **Frontend Only:** Does not use any persistence or database.
- **Styling:** Premium Vanilla CSS.
- **Integrations:** Requires the standalone backend wrapper to extract RRF fusion rankings seamlessly.
