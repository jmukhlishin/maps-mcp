# Google Maps MCP Server (`maps-mcp`)

Server **Model Context Protocol (MCP)** untuk integrasi dengan **Google Maps API** menggunakan TypeScript, Node.js, dan **HTTP Server-Sent Events (SSE) Transport** (`SSEServerTransport` via Express). Server ini dirancang khusus agar dapat diakses oleh **MCP Client node di n8n** (Docker container) maupun MCP client lainnya yang mendukung SSE.

## Fitur (Tools)

1. **`get_directions`**
   - Mendapatkan rute dan petunjuk arah dari titik awal (`origin`) ke tujuan (`destination`).
   - Mendukung mode transportasi: `driving`, `walking`, `bicycling`, `transit`.
2. **`search_places`**
   - Mencari tempat berdasarkan kueri teks (misalnya restoran, hotel, tempat wisata) menggunakan Google Maps Places Text Search.
   - Mendukung filter opsional koordinat `location` dan `radius` (dalam meter).
3. **`geocode_address`**
   - Mengubah alamat atau nama lokasi menjadi koordinat geografis (`latitude` dan `longitude`).
4. **`distance_matrix`**
   - Menghitung jarak dan waktu tempuh untuk beberapa titik asal (`origins`) dan tujuan (`destinations`).

---

## Endpoints HTTP / SSE

- **`GET /sse`** — Endpoint utama untuk inisialisasi koneksi SSE MCP.
- **`POST /messages`** — Endpoint untuk menerima payload pesan JSON-RPC dari MCP client (`transport.handlePostMessage`).
- **`GET /health`** — Endpoint health check untuk memantau status server dan sesi aktif.

---

## Prasyarat

- **Node.js** (v18 atau lebih baru) atau **Docker & Docker Compose**
- **Google Maps API Key** dengan layanan berikut yang telah diaktifkan di Google Cloud Console:
  - Directions API
  - Places API
  - Geocoding API
  - Distance Matrix API

---

## Instalasi & Menjalankan Secara Lokal

1. **Clone repository ini:**
   ```bash
   git clone https://github.com/jmukhlishin/maps-mcp.git
   cd maps-mcp
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Konfigurasi Environment Variable:**
   Salin file `.env.example` menjadi `.env` dan masukkan Google Maps API Key Anda:
   ```bash
   cp .env.example .env
   ```
   Edit file `.env`:
   ```env
   GOOGLE_MAPS_API_KEY=your_actual_api_key_here
   PORT=3000
   ```

4. **Build dan Jalankan Server:**
   ```bash
   npm run build
   npm start
   ```
   Atau mode development:
   ```bash
   npm run dev
   ```

---

## Deployment dengan Docker (Satu Network dengan n8n)

Agar container `maps-mcp` dapat berkomunikasi langsung dengan container `n8n` di server Ubuntu Anda:

1. **Cek nama Docker network tempat container n8n berjalan:**
   ```bash
   docker network ls
   ```
   *(Sesuaikan nama network di bagian `networks` pada file `docker-compose.yml` jika berbeda dari `n8n_network`).*

2. **Pastikan file `.env` sudah terisi `GOOGLE_MAPS_API_KEY`:**
   ```bash
   cp .env.example .env
   nano .env
   ```

3. **Jalankan dengan Docker Compose:**
   ```bash
   docker compose up -d --build
   ```

4. **Verifikasi server berjalan:**
   ```bash
   curl http://localhost:3000/health
   ```

---

## Panduan Konfigurasi di n8n (MCP Client Node)

Untuk menghubungkan **n8n** ke server MCP ini menggunakan node **MCP Client**:

1. Buka workflow n8n Anda dan tambahkan node **MCP Client** (atau sebagai Tool di AI Agent).
2. Buat atau atur **Credentials / Connection Type** ke **SSE (Server-Sent Events)**.
3. Masukkan **SSE URL**:
   - **Jika satu Docker network dengan n8n (Direkomendasikan):**
     ```text
     http://maps-mcp:3000/sse
     ```
   - **Jika diakses melalui IP Host / Public URL:**
     ```text
     http://<IP-SERVER-ATAU-DOMAIN>:3000/sse
     ```
4. Simpan konfigurasi. Node MCP Client di n8n akan otomatis mendeteksi ke-4 tools (`get_directions`, `search_places`, `geocode_address`, `distance_matrix`).
