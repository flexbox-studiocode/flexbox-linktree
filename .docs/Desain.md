# Desain.md — Panduan Pengembangan Flexbox Studio

> Panduan desain dan implementasi untuk AI Agents yang mengembangkan microsite Flexbox Studio.
> Baca dokumen ini bersama `AGENTS.md` sebelum mengubah antarmuka.
> Dokumen ini menetapkan arah pengembangan, bukan perintah untuk langsung mengubah seluruh UI.

## 1. Tujuan dokumen

Dokumen ini menjaga agar setiap pengembangan:

1. Mempertahankan identitas Flexbox Studio.
2. Tetap menghasilkan **microsite pusat tautan**, bukan aplikasi, dashboard, atau landing page SaaS.
3. Mengutamakan pengalaman mobile yang ringkas dan mudah dipindai.
4. Menggunakan aturan visual dan interaksi yang konsisten.
5. Membedakan kebutuhan pemilik proyek, implementasi yang tersedia, dan keputusan yang belum dikonfirmasi.

### 1.1 Arti istilah

- **Wajib:** batasan yang harus dipenuhi dalam pengembangan terkait.
- **Disarankan:** pedoman awal yang dapat disesuaikan dengan konteks dan hasil pengujian.
- **Perlu konfirmasi:** belum menjadi keputusan final; jangan mengarang jawaban atau mengklaim sudah disetujui.

### 1.2 Urutan acuan

1. Instruksi terbaru pemilik proyek dan batasan lingkungan yang berlaku.
2. `AGENTS.md` untuk aturan kerja, struktur, dan tooling.
3. Dokumen ini untuk arah desain dan kriteria penerimaan.
4. Kode saat ini sebagai referensi implementasi, bukan bukti bahwa semua keputusan telah disetujui.

Jika ada konflik yang memengaruhi identitas, konten, atau lingkup pekerjaan, jelaskan konflik tersebut sebelum membuat perubahan besar.

## 2. Definisi produk

### 2.1 Apa yang dibangun

**Flexbox Studio adalah microsite mobile-first yang menjadi satu pintu menuju ekosistem studio:** produk, proyek, resources, portofolio, komunitas, sosial, dan kontak.

Pengunjung idealnya dapat langsung:

1. Mengenali Flexbox Studio.
2. Memindai direktori tautan.
3. Memilih tujuan.
4. Membuka tujuan tersebut atau menghubungi studio.

### 2.2 Apa yang bukan tujuan produk

Jangan menambahkan tanpa permintaan eksplisit:

- Dashboard, sidebar aplikasi, statistik, atau panel administrasi.
- Login, akun, onboarding, atau penyimpanan preferensi.
- Pricing, tabel paket, funnel penjualan, dan rangkaian section khas SaaS.
- Formulir kompleks, CMS, database, atau integrasi backend.
- Pencarian, filter, pagination, dan counter hanya untuk membuat halaman terlihat lebih “lengkap”.

Direktori adalah pusat pengalaman. Hero dan dekorasi hanya mendukungnya.

## 3. Status implementasi dan keputusan terbuka

Bagian ini berdasarkan pembacaan repository saat dokumen dibuat. Perbarui ketika keputusan benar-benar berubah.

| Area                 | Kondisi kode saat ini                                                        | Arah / status                                                                                             |
| -------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Jenis halaman        | Satu halaman React dengan direktori tautan                                   | Pertahankan sebagai microsite                                                                             |
| Hero                 | “IDE FLEKSIBEL. KARYA NYATA.”                                                | Brief awal meminta “EVERYTHING IN ONE PLACE.”; copy final perlu konfirmasi                                |
| Judul direktori      | “JELAJAHI FLEXBOX”                                                           | Brief awal menggunakan “EXPLORE”; pilihan bahasa final perlu konfirmasi                                   |
| Pencarian dan filter | Masih ada di `src/App.tsx`                                                   | Arah yang diminta lebih editorial tanpa pencarian/filter; jangan anggap kode saat ini sebagai persetujuan |
| Counter              | Jumlah hasil tautan masih ditampilkan                                        | Bukan elemen utama; arah editorial tidak membutuhkannya                                                   |
| Font isi             | Manrope melalui Google Fonts                                                 | Fallback implementasi, bukan pengganti Satoshi yang sudah disetujui                                       |
| Font judul           | Anton                                                                        | Sesuai brief                                                                                              |
| Logo                 | Gambar `/assets/flexbox-logo.png`                                            | Gunakan aset yang tersedia; bukan SVG pada implementasi saat ini                                          |
| Grid mobile          | Dua kolom, termasuk pada layar kecil                                         | Evaluasi ulang keterbacaan; satu kolom direkomendasikan pada sekitar 390px                                |
| Tujuan tautan        | Banyak kartu menuju domain yang sama; kontak memakai alamat email dalam kode | URL, email, dan kanal sosial belum terverifikasi                                                          |

**Penting:** perubahan dokumen ini tidak sekaligus mengubah UI. Saat diminta menyelaraskan tampilan, kerjakan perbedaan yang relevan secara eksplisit dan laporkan yang masih terbuka.

## 4. Prinsip visual

### 4.1 Karakter

Gunakan perpaduan **modern modular tech + soft brutalist**:

- Struktur geometris terinspirasi logo.
- Komposisi modular, rapi, dan mudah dipindai.
- Judul kuat dengan teks pendukung yang tenang.
- Border tipis, bidang warna solid, dan aksen biru terukur.
- Sudut sedikit membulat untuk menyeimbangkan karakter tegas.
- Detail editorial kecil seperti label, garis, atau penanda kotak.

### 4.2 Hierarki perhatian

Urutan yang diutamakan:

1. Identitas studio.
2. Pesan hero singkat.
3. Direktori dan judul kartu.
4. Deskripsi serta penanda tautan.
5. Ajakan kontak dan footer.

Jangan membiarkan dekorasi hero, pita, atau label mikro lebih dominan daripada direktori.

### 4.3 Larangan visual

- Tidak menggunakan glassmorphism, efek neon, atau gradient berlebihan.
- Tidak memakai bayangan tebal di semua komponen.
- Tidak menambah ilustrasi atau fotografi sekadar mengisi ruang.
- Tidak menggunakan emoji sebagai ikon.
- Tidak membuat hero setinggi layar yang menunda akses ke tautan.
- Tidak memperkecil teks ekstrem demi mempertahankan dua kolom.

## 5. Sistem warna

### 5.1 Palet utama

| Peran           | Nilai     | Penggunaan                                    |
| --------------- | --------- | --------------------------------------------- |
| Brand blue      | `#3F83C4` | Aksen, ikon, border interaktif, penanda fokus |
| Light blue      | `#D3DEF0` | Bidang pendukung dan highlight lembut         |
| Graphite        | `#4E5460` | Teks utama dan latar footer                   |
| Page background | `#F7F9FC` | Latar halaman                                 |
| Surface         | `#FFFFFF` | Kartu dan permukaan navigasi                  |

### 5.2 Aturan penggunaan

- Dominankan background terang dan permukaan putih.
- Gunakan biru untuk mengarahkan perhatian, bukan mewarnai semua elemen.
- Warna turunan boleh digunakan secara terbatas untuk border, teks sekunder, dan state.
- Jangan menambah warna brand baru tanpa alasan dan persetujuan.
- Jangan menganggap brand blue otomatis memenuhi kontras untuk teks kecil.
- Uji kontras pada kombinasi aktual; gunakan warna teks lebih gelap bila diperlukan.
- Warna tidak boleh menjadi satu-satunya pembeda informasi atau state.

## 6. Tipografi

### 6.1 Keluarga font

| Peran                  | Font tujuan      | Aturan                                                                   |
| ---------------------- | ---------------- | ------------------------------------------------------------------------ |
| Display / judul utama  | Anton            | Judul ringkas; bobot normal sesuai font                                  |
| Isi / navigasi / kartu | Satoshi          | Font yang diminta pemilik; gunakan hanya jika aset dan izin tersedia     |
| Fallback isi saat ini  | Manrope          | Pertahankan sementara sampai Satoshi tersedia atau penggantian disetujui |
| Label editorial        | Monospace sistem | Terbatas pada metadata; bukan isi utama                                  |

Jangan mengklaim Satoshi tidak tersedia secara permanen berdasarkan fallback yang ada. Jangan mengambil file font dari sumber tidak resmi. Jika font berubah, uji ulang wrapping, ukuran kartu, dan ritme vertikal.

### 6.2 Skala yang disarankan

Angka berikut adalah target keterbacaan, bukan dokumentasi ukuran kecil yang saat ini ada di CSS:

| Elemen               | Mobile  | Desktop |
| -------------------- | ------- | ------- |
| H1                   | 36–44px | 48–56px |
| Judul section        | 18–24px | 20–28px |
| Judul kartu          | 16–18px | 16–20px |
| Teks isi / deskripsi | 14–16px | 14–16px |
| Label pendukung      | 11–12px | 11–12px |

- Gunakan line-height sekitar 1.1–1.2 untuk display dan 1.5–1.7 untuk isi.
- Kapital penuh cocok untuk display dan label singkat, bukan paragraf panjang.
- Hindari tracking lebar pada teks kecil.
- Jangan memakai teks 5–9px untuk informasi yang perlu dibaca.
- Izinkan judul membungkus alami; hindari pemotongan informasi penting.

## 7. Layout dan responsivitas

### 7.1 Container

- Mulai dari viewport mobile sekitar **390px**.
- Padding horizontal utama: **20px**.
- Desktop tetap terpusat; lebar maksimum area utama sekitar **800–900px**.
- Jangan memperlebar halaman menjadi dashboard penuh pada monitor besar.
- Uji juga pada lebar 320px agar tidak terjadi overflow horizontal.

### 7.2 Grid direktori

- Direkomendasikan satu kolom pada mobile agar judul dan deskripsi nyaman dibaca.
- Gunakan dua kolom saat ruang benar-benar cukup; sekitar 600px dapat menjadi titik awal evaluasi.
- **Maksimal dua kolom**, termasuk pada desktop.
- Gap kartu disarankan 12–16px.
- Jangan mengunci tinggi kartu sehingga teks terpotong saat zoom atau konten bertambah.

### 7.3 Ritme ruang

Gunakan skala sederhana: **4, 8, 12, 16, 20, 24, 32, 40, 48px**.

- Padding kartu disarankan 16–24px.
- Jarak antar-section sekitar 32–48px, disesuaikan agar halaman tetap ringkas.
- Radius kartu sekitar 8–12px.
- Border dasar 1px; bayangan tipis atau offset kecil hanya bila membantu hierarki.

## 8. Struktur halaman

Urutan yang dianjurkan:

```text
Header / navigasi minimal
Hero ringkas
EXPLORE / direktori utama
Ajakan kolaborasi singkat (opsional)
Footer graphite
```

### 8.1 Header

- Logo, nama studio, dan sedikit tautan navigasi.
- Brand dapat menjadi tautan kembali ke atas.
- CTA kontak sederhana; jangan membuat deretan tombol.
- Sticky boleh dipertahankan jika tidak menghalangi konten atau fokus keyboard.
- Pada mobile, kurangi item sekunder sebelum mengecilkan teks.

### 8.2 Hero

- Hanya satu `h1`.
- Pesan inti: semua tujuan Flexbox tersedia dalam satu tempat.
- Referensi copy brief: **“EVERYTHING IN ONE PLACE.”**
- Copy alternatif yang sudah ada di kode bukan keputusan final.
- Deskripsi singkat, sekitar satu sampai dua kalimat.
- CTA internal menuju direktori, bukan tombol promosi besar.
- Logo dan aksen geometris boleh dipakai secara ringan.

### 8.3 Direktori EXPLORE

- Menjadi fokus utama dan mudah dicapai setelah hero.
- Kelompokkan konten secara editorial bila perlu, bukan dengan panel kontrol aplikasi.
- Area cakupan: produk/proyek, resources, portofolio, komunitas, sosial, dan kontak.
- Tampilkan hanya tujuan yang benar-benar tersedia atau disetujui.
- Jangan membuat kartu sosial palsu untuk melengkapi kategori.
- Arah dasar tidak memerlukan search, filter chips, atau counter.
- Jika fitur tersebut diminta di kemudian hari, pastikan berfungsi dan tetap menjaga kesederhanaan microsite.

### 8.4 Kartu tautan

Anatomi yang dianjurkan:

1. Ikon atau penanda kategori.
2. Judul tujuan.
3. Deskripsi ringkas tentang apa yang akan ditemukan.
4. Panah eksternal yang konsisten.
5. Label khusus hanya bila memang diperlukan.

Aturan:

- Seluruh kartu merupakan satu elemen `<a>`, bukan `div` dengan handler klik.
- Jangan menaruh tombol atau tautan lain di dalam tautan kartu.
- Ikon memakai gaya outline yang konsisten dengan SVG yang sudah ada.
- Panah dekoratif tidak perlu dibacakan screen reader.
- “Pilihan studio” hanya digunakan bila kurasinya nyata dan disetujui.

### 8.5 Kontak dan footer

- Ajakan kolaborasi cukup singkat; bukan formulir lead generation.
- Gunakan `mailto:` untuk email bila memang itu tujuan yang disetujui.
- Footer menggunakan graphite dengan teks yang kontras.
- Sertakan identitas, tautan penting, dan copyright.
- Tautan sosial hanya ditambahkan setelah akun tujuan dikonfirmasi.
- Jangan menambahkan klaim ketersediaan, status online, atau janji respons yang tidak dapat dibuktikan.

## 9. Konten dan pengelolaan tautan

### 9.1 Gaya bahasa

- Ringkas, jelas, ramah, dan percaya diri.
- Bahasa Indonesia menjadi dasar teks pendukung yang ada saat ini.
- Frasa Inggris singkat boleh digunakan untuk identitas editorial.
- Konsistensi bahasa dan copy final perlu dikonfirmasi sebelum penggantian massal.
- Hindari jargon kosong, klaim berlebihan, dan deskripsi yang tidak menjelaskan tujuan tautan.

### 9.2 Data tautan

Pertahankan data terstruktur seperti pola `LinkItem` saat ini:

```ts
type LinkItem = {
  title: string;
  description: string;
  category: Category;
  icon: IconName;
  href: string;
  tag?: string;
};
```

- Tambahkan field hanya jika ada kebutuhan nyata.
- Simpan data terpisah dari markup render; ekstraksi ke file lain boleh jika benar-benar membantu.
- Jangan menambahkan CMS atau penyimpanan persisten untuk direktori statis tanpa permintaan.

### 9.3 Validasi tujuan

- Domain `https://flexboxstudio.com` dan `hello@flexboxstudio.com` dalam kode belum membuktikan kepemilikan atau kebenaran tujuan.
- Jangan menyatakan tautan terverifikasi hanya karena sintaks URL valid.
- Minta URL final untuk setiap produk, resource, portofolio, komunitas, sosial, dan kontak sebelum rilis.
- Jangan menciptakan akun sosial, domain, atau alamat email baru.
- Untuk tab baru, gunakan `target="_blank"` dan `rel="noopener noreferrer"`.
- Komunikasikan pembukaan tab baru secara aksesibel; gunakan teks tersembunyi bila diperlukan.
- Tautan internal memakai anchor yang benar dan tidak tertutup header.

## 10. Interaksi dan animasi

- Semua interaksi harus memiliki tujuan nyata.
- Hover kartu dapat mengubah border dan mengangkat kartu sekitar 2–4px.
- Panah dapat bergeser sedikit ke kanan atas.
- Durasi transisi disarankan 150–200ms.
- Animasi masuk cukup halus, sekitar 250–350ms; tidak boleh menunda akses konten.
- Terapkan hover berbasis pointer hanya pada perangkat yang mendukung hover.
- Sediakan feedback `:active` dan `:focus-visible`, bukan hover saja.
- Hormati `prefers-reduced-motion`; nonaktifkan animasi dan smooth scrolling yang tidak diperlukan.
- Tidak memakai parallax, scroll hijacking, animasi terus-menerus, atau efek berat.

## 11. Aksesibilitas

Targetkan **WCAG 2.2 AA** untuk perubahan yang dikerjakan.

- Gunakan landmark `header`, `nav`, `main`, `section`, dan `footer` secara semantik.
- Satu `h1`; urutan heading tidak melompat tanpa alasan.
- Semua tautan dapat dicapai dan diaktifkan dengan keyboard.
- Sediakan indikator fokus yang terlihat di permukaan terang maupun gelap.
- Tambahkan skip link ke konten utama bila diperlukan.
- Gunakan target sentuh sekitar 44 × 44px untuk kontrol utama.
- Pastikan kontras teks normal minimal 4.5:1 dan teks besar minimal 3:1.
- Teks sekunder tidak boleh begitu pucat sehingga sulit dibaca.
- Logo informatif memiliki teks alternatif; dekorasi diberi `aria-hidden`.
- Jangan mengandalkan ikon panah saja sebagai nama tautan.
- Uji pembesaran 200%, wrapping teks, dan tidak adanya konten tertutup header.
- Jika search/filter dipertahankan atas permintaan, wajib ada label, state aktif, hasil kosong, reset, dan pengumuman hasil yang sesuai.

## 12. Aset dan performa

- Logo yang digunakan kode saat ini: `public/assets/flexbox-logo.png`.
- Favicon tersedia di `public/favicon.png`.
- Jangan menggambar ulang atau mengganti logo dengan bentuk perkiraan tanpa persetujuan.
- Pertahankan rasio aspek; jangan meregangkan logo.
- Gunakan dimensi gambar untuk mencegah layout shift.
- Evaluasi optimasi ukuran file bila diperlukan; jangan mengurangi ketajaman secara berlebihan.
- Fotografi bukan kebutuhan dasar microsite ini.
- Jangan menambah library ikon atau animasi jika SVG dan CSS yang ada sudah mencukupi.
- Jaga font tetap terbatas pada family dan weight yang benar-benar digunakan.

## 13. Aturan implementasi

### 13.1 Stack dan lokasi kerja

| File            | Peran                                               |
| --------------- | --------------------------------------------------- |
| `src/App.tsx`   | Halaman utama, komponen lokal, dan direktori tautan |
| `src/index.css` | Import font, Tailwind v4, theme, dan styling global |
| `src/main.tsx`  | Entry point React dan import CSS                    |
| `index.html`    | Shell HTML dan metadata dasar                       |
| `package.json`  | Dependency dan skrip resmi                          |
| `AGENTS.md`     | Aturan repository                                   |

Stack saat ini: React 19, Vite 8, TypeScript, Tailwind CSS v4, dan oxfmt.

### 13.2 Batasan teknis

- Ikuti pola lokal sebelum membuat abstraksi atau dependency baru.
- Jangan migrasi framework untuk perubahan visual biasa.
- Gunakan utility Tailwind untuk pengembangan sesuai `AGENTS.md`; pertahankan konsistensi saat menyentuh class CSS yang sudah ada.
- Import CSS harus berada di atas; font global tetap di `src/index.css`.
- Global element defaults ditempatkan di `@layer base` agar tidak menimpa utilities.
- Jangan menambahkan konfigurasi Tailwind v3 atau PostCSS yang tidak diperlukan.
- Export komponen mengikuti ketentuan default export repository.
- Jangan memodifikasi skrip `.figma/make/` untuk pekerjaan desain biasa.
- Development server sudah berjalan; jangan menjalankan server kedua.
- Perubahan dokumentasi saja tidak mengharuskan build aplikasi.

## 14. Prosedur kerja AI Agent

### Sebelum mengubah

1. Baca `AGENTS.md`, dokumen ini, dan file yang relevan.
2. Tentukan apakah permintaan berupa implementasi, dokumentasi, review, atau diskusi.
3. Cocokkan kondisi kode dengan kebutuhan terbaru; jangan mengandalkan ringkasan percakapan jika bertentangan dengan repository.
4. Identifikasi konten/URL/font yang belum dikonfirmasi.
5. Pertahankan perubahan pengguna dan pekerjaan di luar lingkup.

### Saat mengubah

1. Kerjakan perubahan sekecil yang cukup untuk menyelesaikan permintaan.
2. Pertahankan karakter microsite dan fokus direktori.
3. Jangan menambahkan fitur untuk mengisi ruang kosong.
4. Pastikan setiap kontrol terhubung ke perilaku nyata.
5. Pisahkan fakta implementasi dari rekomendasi.
6. Jika perubahan menyentuh keputusan terbuka, minta konfirmasi hanya ketika pilihan tersebut berdampak penting.

### Setelah mengubah

1. Review terhadap permintaan dan checklist di bawah.
2. Gunakan skrip resmi: `pnpm format` untuk format dan `pnpm build` untuk build bila relevan.
3. Batasi pemformatan ke file terkait bila memungkinkan; jangan mengubah file lain tanpa kebutuhan.
4. Uji interaksi yang berubah, bukan hanya build.
5. Jika tidak ada test runner, jangan mengklaim tes otomatis telah lulus.
6. Laporkan perubahan, pemeriksaan yang benar-benar dijalankan, serta hal yang masih belum terverifikasi.
7. Perbarui dokumen ini bila ada keputusan desain baru yang telah disetujui.

## 15. Checklist penerimaan

Gunakan sesuai lingkup perubahan. Item yang belum diperiksa harus dilaporkan, bukan dianggap lulus.

### Produk dan konten

- [ ] Halaman tetap terasa sebagai microsite, bukan aplikasi/dashboard.
- [ ] Direktori menjadi fokus utama.
- [ ] Hero singkat dan tidak mendorong direktori terlalu jauh.
- [ ] Copy final sesuai keputusan pemilik.
- [ ] Tidak ada URL, email, akun sosial, badge, atau klaim yang dikarang.
- [ ] Semua tujuan rilis telah dikonfirmasi.

### Visual dan responsif

- [ ] Palet utama dan karakter modular tetap konsisten.
- [ ] Anton digunakan untuk display; status Satoshi/fallback dijelaskan dengan jujur.
- [ ] Teks nyaman dibaca tanpa label mikro ekstrem.
- [ ] Layout diuji pada sekitar 320px, 390px, 768px, dan 1280px.
- [ ] Padding mobile sekitar 20px dan container desktop tetap terpusat.
- [ ] Grid tidak melebihi dua kolom.
- [ ] Tidak ada overflow horizontal, teks terpotong, atau kartu terlalu padat.
- [ ] Logo tetap proporsional.

### Perilaku dan aksesibilitas

- [ ] Anchor internal bekerja dan tidak tertutup header.
- [ ] Tautan eksternal dan email menuju tujuan yang benar.
- [ ] Keyboard, fokus, dan target sentuh nyaman digunakan.
- [ ] Kontras diuji, termasuk teks kecil dan footer.
- [ ] Reduced motion dihormati.
- [ ] Zoom 200% tidak menghilangkan konten atau fungsi.
- [ ] Tidak ada kontrol dekoratif yang tampak bisa diklik tetapi tidak berfungsi.

### Teknis

- [ ] Tidak ada dependency atau backend baru tanpa kebutuhan.
- [ ] Format dan build yang relevan berhasil.
- [ ] Perilaku yang berubah sudah diuji secara langsung atau otomatis.
- [ ] Tidak ada error baru yang diketahui.
- [ ] Hasil dan keterbatasan verifikasi dijelaskan secara konkret.

## 16. Ringkasan untuk agent

> Bangun Flexbox Studio sebagai microsite direktori yang ringkas, mobile-first, dan editorial. Gunakan identitas biru–graphite, judul Anton, serta Satoshi bila tersedia secara sah. Prioritaskan kartu tautan yang mudah dibaca, bukan fitur aplikasi. Pertahankan container terpusat dan maksimal dua kolom. Jangan mengarang tujuan tautan atau menganggap fallback serta copy saat ini sebagai keputusan final. Ubah hanya yang diminta, verifikasi perilakunya, dan laporkan hal yang belum pasti.
