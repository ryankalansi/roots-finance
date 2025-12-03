import { ImageResponse } from 'next/og'

// Konfigurasi Metadata Gambar
export const runtime = 'edge'
export const size = {
  width: 32,
  height: 32,
}
export const contentType = 'image/png'

// Generate Gambar Favicon
export default function Icon() {
  return new ImageResponse(
    (
      // Elemen HTML/CSS untuk Favicon (Tema Hitam & Putih)
      <div
        style={{
          fontSize: 20,
          background: '#0f172a', // Warna Slate-900 (Hitam Elegan)
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white', // Warna Teks Putih
          borderRadius: '8px', 
          fontWeight: 800,
          fontFamily: 'sans-serif',
          border: '1px solid #334155' // Border tipis Slate-700 untuk definisi
        }}
      >
        R
      </div>
    ),
    {
      ...size,
    }
  )
}