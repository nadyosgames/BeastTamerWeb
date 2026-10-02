# Beast Tamer — güncel görsel yön

Kullanıcının 2026-10-02 tarihinde onayladığı `art/style-ref/retro-menu.png` ve `retro-run.png` referansları yeni görsel yönü belirler: koyu mürekkepli kütüphane, krem parşömen, kalın sıcak siyah konturlar, düz cel renkleri, 1930'lar çizgi film yüzleri ve tuğla kırmızısı ana kontroller. Önceki ressamsı yön geçmiş kayıtlarda korunur.

Ana menü, gün planlama, tur, koleksiyon, desteler, market, yardım/eğitim, ayarlar, Tur Laboratuvarı ve Art Studio ortak retro temayı kullanır. Koleksiyon sayfa başına 12 kart gösterir. Kart metinleri, kurallar, dayanıklılık, çerçeveler ve rozetler React bileşenleridir. Hava karakterleri, paketler, element ikonları ve eldiven imleci SVG öğeleridir.

## Tekil üretim

[Retro iş akışı](retro/README.md), [üretim planı](retro/plan.json) ve `retro/results/<kind>/<id>.json` güncel prompt ve görsel kontrol kayıtlarıdır. Yalnızca `reviewed-and-imported` kayıtları tamamlanmıştır; `pending` ve `generation-blocked` kayıtları tamamlanmış sayılmaz.

Her kart ayrı bir yerleşik ImageGen çağrısıyla üretilir. Tam boyut çıktıda gözler, gözbebekleri, türe uygun uzuv sayısı ve bağlantıları, kanatlar, kuyruk, kadraj ve küçük boyut okunaklılığı incelenir. Hatalar düzeltilip tekrar incelenmeden master'a alınmaz. Sade krem parşömen üzerindeki efektler anatomiyi örtmez.

`scripts/art/import-retro.mjs` kontrol notuyla yeni görseli alır, önceki master'ı `art/source/revisions/` içinde numaralı korur ve WebP pipeline'ını çalıştırır. `scripts/art/replace-ui-generated.mjs` arayüz sahnelerinde aynı korumayı uygular.

- `art/source/cards/<id>.png`: 1024 × 1024 kart master'ları.
- `art/source/tamers/<id>.png`: 1024 × 1536 Tamer master'ları.
- `art/source/ui/`: menü ve tur sahneleri.
- `src/generated/art/`: master'lardan üretilen WebP ve küçük önizlemeler.
- `public/art/ui/`: optimize edilmiş arayüz sahneleri ve SVG öğeleri.
- `art/direction/previews/retro/`: oyun içi ekran görüntüleri.

PNG master'ları mevcut Git LFS kurallarına tabidir. Eski `generated-prompts.json`, `readable-card-plan.json` ve `results/readable-cards/` önceki yönün geçmişidir.

## Doğrulama

`npm run typecheck`, `npm run lint`, `npm test`, `npm run build` ve `node art/direction/verify-assets.mjs`. Windows sandbox'ında `tsx` kullanıcı bilgisi sorgusu hata verirse içerik kontrolü `node scripts/content/validate.ts` ile, ardından TypeScript ve Vite doğrudan çalıştırılarak yapılabilir. Görsel geçiş mevcut oyun kurallarını değiştirmez.
