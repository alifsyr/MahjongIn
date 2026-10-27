# MahjongIn — Mahjong Garden

Game Mahjong 4 pemain yang berjalan langsung di browser, dengan **1 pemain manusia dan 3 bot**. Proyek ini menggunakan HTML, CSS, dan JavaScript murni tanpa dependensi build.

## Menjalankan game

1. Clone repository atau unduh sebagai ZIP.
2. Buka **index.html** melalui browser desktop atau ponsel.
3. Tekan **Ambil Ubin**, pilih ubin di tangan, lalu **Buang Ubin**.

File **Mahjong-Riichi-4-Pemain.html** adalah versi satu-file untuk bermain secara offline tanpa memerlukan file CSS/JS terpisah.

## Fitur

- Empat kursi (Timur, Selatan, Barat, Utara), 136 ubin.
- Giliran ambil dan buang; tiga bot bermain otomatis.
- **Chi** dari buangan pemain sebelumnya, **Pon** dan **Kan** dari buangan lawan.
- Kan tertutup dan pengambilan ubin pengganti.
- Pemeriksaan kemenangan **4 meld + 1 pair**, **Ron** dan **Tsumo**.
- Riwayat langkah, ubin buangan, meld terbuka, serta UI responsif.

## Menjalankan pengujian

```sh
node tests/rules.test.mjs
```

## Batasan versi belajar

Game ini mengadopsi aturan Riichi **yang disederhanakan**. Belum tersedia yaku, furiten, dora, riichi declaration, scoring resmi, serta multiplayer empat manusia online. Poin akhir hanyalah poin latihan; tidak ada taruhan atau uang asli.

Untuk meng-host sebagai website statis, arahkan layanan hosting atau GitHub Pages ke file **index.html** pada root branch `master`.
