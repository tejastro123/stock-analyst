# 🚀 How to Run the QuantDesk Terminal

This guide provides instructions for running both the legacy **Streamlit reference dashboard** and the new **full-stack React/Node/Python monorepo** terminal.

---

## Option A: Run the Streamlit Dashboard (Reference App)

The Streamlit app is a single-process python dashboard.

### 1. Setup Environment
Ensure the `.env` file in the root directory contains the necessary keys:
```env
FRED_API_KEY=d3fa3a5a7ff4d14f609da5780f9dfc52
ANTHROPIC_API_KEY=your_key_here  # Optional, for Claude-based AI
```

### 2. Install Python Dependencies
Run the following from the root directory:
```bash
pip install -r requirements.txt
```

### 3. Start the App
Start the Streamlit development server:
```bash
streamlit run app.py
```
This will open the dashboard in your default browser at `http://localhost:8501`.

---

## Option B: Run the Full-Stack QuantDesk Terminal (Vite + Node.js + FastAPI)

The full-stack application requires running a database, two servers, and a frontend client.

### Prerequisites
1. **PostgreSQL**: Ensure PostgreSQL is installed and running on port `5432`.
2. **Ollama**: Ensure Ollama is installed and running on `http://localhost:11434` with the `mistral` model downloaded:
   ```bash
   ollama run mistral
   ```

---

### Step 1: Database Setup & Migration
1. Configure database connection parameters in `backend/.env`:
   ```env
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=quantdesk
   DB_USER=postgres
   DB_PASSWORD=tejas123
   ```
2. Create the `quantdesk` database inside your PostgreSQL instance if it doesn't exist.
3. In the `backend` directory, install Node packages and run the database setup:
   ```bash
   cd backend
   npm install
   npm run db:migrate
   npm run db:seed
   ```
   *Note: This creates the table schema and seeds a default admin user:*
   * **Email**: `admin@quantdesk.local`
   * **Password**: `admin123`

---

### Step 2: Start the Python Data Microservice
This FastAPI service fetches stock quotes, technical indicator metrics, and screeners.
1. In the `py-service` directory, install dependencies:
   ```bash
   cd py-service
   pip install -r requirements.txt
   ```
2. Start the service:
   ```bash
   python main.py
   ```
   *The microservice will start on [http://localhost:8000](http://localhost:8000) (interactive docs are available at `/docs`).*

---

### Step 3: Start the Node.js Express API
This backend handles authentication, user watchlists, portfolio tracking, AI routing, and report generation.
1. In the `backend` directory, start the Express app:
   ```bash
   cd backend
   npm run dev
   ```
   *The server runs on [http://localhost:3001](http://localhost:3001).*

---

### Step 4: Start the React + Vite Frontend
The frontend provides the Bloomberg-style user interface, connecting to the backend via a Vite reverse proxy.
1. In the `frontend` directory, install package dependencies:
   ```bash
   cd frontend
   npm install
   ```
2. Start the Vite server:
   ```bash
   npm run dev
   ```
   *The terminal UI runs on [http://localhost:5173](http://localhost:5173).*

---

## Summary of Active Ports
* **5173**: React Frontend Client (Vite Dev Server)
* **3001**: Node.js Express API Backend
* **8000**: Python FastAPI yfinance Microservice
* **5432**: PostgreSQL Database
* **11434**: Ollama Local AI Server
