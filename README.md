# MahjongIn — Jakarta Mahjong Club (144 Ubin)

Game Mahjong 4 pemain yang berjalan langsung di browser, dengan **1 pemain manusia dan 3 bot**. Mengadopsi aturan **Hong Kong Mahjong 144 Ubin** seperti yang sedang viral dimainkan di kafe & lounge Mahjong Jakarta (PIK, Senopati, Kelapa Gading, Permata Hijau). Proyek ini dibangun dengan HTML, CSS, dan JavaScript murni tanpa dependensi build.

## Menjalankan Game

1. Buka **index.html** di browser desktop atau ponsel.
2. Tekan **Ambil Ubin**, pilih ubin di tangan, lalu tekan **Buang Ubin**.
3. Klaim buangan lawan jika tersedia (**Chi**, **Pon**, **Kan**, atau **Ron**).

File **Mahjong-Riichi-4-Pemain.html** adalah berkas tunggal mandiri (*all-in-one bundle*) untuk bermain secara offline tanpa membutuhkan file CSS/JS eksternal.

## Fitur & Aturan Viral Jakarta (Hong Kong Style)

- **144 Ubin Lengkap**: 108 ubin angka (Wan, Pin, Sou), 28 ubin kehormatan (Angin & Naga), serta **8 Ubin Bunga & Musim** (梅 蘭 菊 竹 • 春 夏 秋 冬).
- **Penggantian Ubin Bunga Otomatis**: Ubin bunga langsung dipajang di area pemain dan otomatis menarik ubin pengganti dari tembok.
- **Kondisi Menang (Hu)**: 4 kelompok (Chi / Pon / Kan) + 1 pasang (mata).
- **Klaim Ubin**: Chi dari pemain sebelah kiri, Pon & Kan dari siapa saja.
- **Sistem Nilai Fan (Hong Kong Scoring)**:
  - *Tsumo* (ambil sendiri): +1 Fan
  - *Bunga Kursi* (nomor bunga sesuai nomor kursi pemain): +1 Fan
  - *Ping Hu* (semua Chi runtun): +1 Fan
  - *Pung Naga / Angin Kursi*: +1 Fan
  - *Dui Dui Hu* (semua Pung kembar): +3 Fan
  - *Hun Yi Se* (satu jenis angka + naga/angin): +3 Fan
  - *Qing Yi Se* (satu jenis angka murni): +7 Fan
- **Sistem Pembayaran Meja Lounge**:
  - *Ron*: Pemain yang membuang ubin pemenang (*shooter*) membayar penuh nilai kemenangan.
  - *Tsumo*: Ketiga lawan masing-masing membayar rata.
  - Saldo poin tiap pemain tercatat dan terus berjalan di setiap ronde.
- **Strictly No Gambling**: Murni untuk hiburan santai, strategi, dan olahraga asah otak.

## Menjalankan Pengujian

```sh
node tests/rules.test.mjs
```

## Skills Terpasang

Repositori ini telah dilengkapi dengan skill agen pada direktori `.agents/skills/`:
- **antislop**: Kumpulan panduan anti-slop (kebersihan kode, UI kontras tinggi, copywriting natural, tata letak responsif).
- **ponytail**: Pola pikir minimalis senior developer (YAGNI, solusi paling ringkas dan tepat guna tanpa over-engineering).
