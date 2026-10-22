# Google Maps MCP Server (`maps-mcp`)

Server **Model Context Protocol (MCP)** untuk integrasi dengan **Google Maps API** menggunakan TypeScript dan Node.js. Server ini memungkinkan asisten AI (seperti Claude Desktop) untuk mencari tempat, mendapatkan petunjuk arah (rute), melakukan geocoding alamat, serta menghitung matriks jarak dan waktu tempuh.

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

## Prasyarat

- **Node.js** (v18 atau lebih baru)
- **Google Maps API Key** dengan layanan berikut yang telah diaktifkan di Google Cloud Console:
  - Directions API
  - Places API
  - Geocoding API
  - Distance Matrix API

---

## Instalasi

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
   ```

---

## Cara Build & Menjalankan Server

1. **Build project TypeScript ke JavaScript:**
   ```bash
   npm run build
   ```
   File hasil kompilasi akan tersimpan di direktori `./dist`.

2. **Menjalankan server:**
   ```bash
   npm start
   ```
   Atau untuk mode development menggunakan `tsx`:
   ```bash
   npm run dev
   ```

---

## Integrasi dengan Claude Desktop / Konfigurasi MCP

Untuk menggunakan server ini di **Claude Desktop**, tambahkan konfigurasi berikut ke file `claude_desktop_config.json`:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

### Contoh Konfigurasi:

```json
{
  "mcpServers": {
    "google-maps": {
      "command": "node",
      "args": [
        "/path/absolut/menuju/maps-mcp/dist/index.js"
      ],
      "env": {
        "GOOGLE_MAPS_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

> **Catatan:** Pastikan Anda telah menjalankan `npm run build` terlebih dahulu dan mengganti `/path/absolut/menuju/maps-mcp/dist/index.js` sesuai dengan lokasi direktori project Anda.
