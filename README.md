# Canavar Deste — Web Prototipi

Stratejik koleksiyon kart oyunu *Canavar Deste*'nin oynanabilirlik prototipi. Unity'ye geçmeden önce
eğlenceyi test etmek ve dengeyi **simülasyonla** kurmak için. Mimari: [Docs/ARCHITECTURE.md](Docs/ARCHITECTURE.md) ·
Tasarım: [Docs/Canavar Deste GDD.html](Docs/Canavar%20Deste%20GDD.html)

## Kurulum

Gerekenler: Node 24+, Git LFS.

```bash
git lfs install
npm install
npm run dev
```

Tarayıcıda: **Tur Laboratuvarı** (`#lab`) kartları dizip motoru izlemek için, **Art Studio** (`#art`) ChatGPT
görsellerini eklemek için.

## Komutlar

| Komut | Ne yapar |
|---|---|
| `npm run dev` / `npm run build` | Geliştirme sunucusu / production build |
| `npm test` | Motor testleri (GDD örnek turu = 56 kaynak dahil) |
| `npm run lint` · `npm run typecheck` | oxlint (katman sınırları dahil) · TypeScript |
| `npm run content:check` | İçerik JSON doğrulama |
| `npm run content:schema` | JSON Schema üret (VS Code'da kart yazarken otomatik tamamlama) |
| `npm run sim -- check` | GDD denge hedefleri ✓/✗ |
| `npm run sim -- arrange \| weather \| cards \| campaign` | Tekil denge deneyleri |
| `npm run sim -- calibrate` | Kota eğrisini simülasyonla üret → `content/generated/balance.json` |
| `npm run art:prompts` | ChatGPT prompt'larını üret → `art/prompts/PROMPTS.md` |
| `npm run art:ingest` | `art/inbox/` → master + web görselleri |
| `npm run art:status` | Eksik görseller |
| `npm run art:generate -- --yes` | (İsteğe bağlı, ücretli) OpenAI API ile toplu üretim |
| `npm run art:export-unity` | Unity paketi: görseller + içerik + golden testler |
