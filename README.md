# Canavar Deste — Web Prototipi

Stratejik koleksiyon kart oyunu *Canavar Deste*'nin oynanabilirlik prototipi. Unity'ye geçmeden önce
eğlenceyi test etmek ve dengeyi **simülasyonla** kurmak için. Mimari: [Docs/ARCHITECTURE.md](Docs/ARCHITECTURE.md) ·
Tasarım: [Docs/Canavar Deste GDD.html](Docs/Canavar%20Deste%20GDD.html) (v0.6, kart sistemi) ·
[Av Sistemi, GDD v0.8 taslağı](https://claude.ai/code/artifact/4e0425e9-803b-4b35-8e13-ad29715df474) (oyun akışı: av, sefer, bölgeler)

## Kurulum

Gerekenler: Node 24+, Git LFS.

```bash
git lfs install
npm install
npm run dev
```

Tarayıcıda: **OYNA** (`#play`) av sistemi (GDD v0.8-v0.9) — 8 biyomlu dünya haritasında bir bölgeye sefere çık,
yaratığın niyetine göre kartları diz ve onu bayılt; Tamer'ın canı sefer boyunca taşınır, yakalanan yaratık destene
katılır, bölgenin Final'i yolun devamındaki bölgeyi açar;
**Tur Laboratuvarı** (`#lab`) tek bir eli serbestçe deneme; **Art Studio** (`#art`) ChatGPT görsellerini ekleme.

## Komutlar

| Komut | Ne yapar |
|---|---|
| `npm run dev` / `npm run build` | Geliştirme sunucusu / production build |
| `npm test` | Motor, profil ve dünya testleri (GDD örnek turu = 56 kaynak dahil) |
| `npm run lint` · `npm run typecheck` | oxlint (katman sınırları dahil) · TypeScript |
| `npm run content:check` | İçerik JSON doğrulama (`-- --set v1` ile öneri seti) |
| `npm run content:schema` | JSON Schema üret (VS Code'da kart yazarken otomatik tamamlama) |
| `npm run sim -- check` | GDD denge hedefleri ✓/✗ |
| `npm run sim -- arrange \| weather \| cards` | Tekil denge deneyleri |
| `npm run sim -- hunts` | Her av: bayıltma oranı, tur, Tamer can kaybı (hedef profil ve başlangıç destesi) |
| `npm run sim -- world` | Dünya ilerlemesi: tipik oyuncu ana hikâyeyi, bölge kitaplarını ve tüm avları kaç saatte bitirir |
| `npm run sim -- calibrate` | Referans desteleri + yaratık canlarını bölge bölge simülasyonla üret → `content/generated/hunts.json` |
| `npm run sim -- decks` | Preset desteler: dizilim etkisi + hava matrisi |
| `npm run sim -- review --set v1` | Öneri kart setini incele (güç, sinerji) → `Docs/proposals/` |
| `npm run art:prompts` | ChatGPT prompt'larını üret → `art/prompts/PROMPTS.md` |
| `npm run art:ingest` | `art/inbox/` → master + web görselleri |
| `npm run art:status` | Eksik görseller |
| `npm run art:generate -- --yes` | (İsteğe bağlı, ücretli) OpenAI API ile toplu üretim |
| `npm run art:export-unity` | Unity paketi: görseller + içerik + golden testler |
