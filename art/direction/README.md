# Canavar Deste — görsel düzen

Concept Arts klasöründeki altı ekran, arayüzün görsel referansıdır: mum ışıklı kütüphane, koyu petrol tonlarında paneller, altın çerçeveler, element renkleri ve canlı yaratık illüstrasyonları.

## Ekranlar

- Ana menü: kütüphane sahnesi, Oyna / Desteler / Koleksiyon / Market, görevler ve oynatma ayarları.
- Gün planlama: beş günlük hava takvimi, destenin bağlı Tamer portresi, hazır ve oyuncu desteleri, haftalık kota. Bu ekranda Tamer değiştirilmez; deste seçildiğinde Tamer da birlikte seçilir.
- Tur: sürüklenebilir kartlar, element çerçeveleri, sıralama bağlantıları, aktif/pasif durumlar ve animasyon kontrolleri.
- Koleksiyon: 24 kart/sayfa, Türkçe arama, element/nadirlik/tür filtreleri, sıralama ve kart detayları.
- Desteler: Tamer seçerek yeni deste oluşturma, ad değiştirme, kartları tıklayarak veya sürükleyerek ekleme ve çıkarma, element dağılımı ve otomatik kayıt. Slot sayısı ve deste üst sınırı bağlı Tamer'dan gelir. Nadirlik kopya limitleri uygulanır. Yedi nadirlik, farklı şekil ve renkli SVG rozetlerle gösterilir.
- Market: dört paket, beş element ambalajı, gerçek içerik oranları ve ücretsiz örnek açılış. Örnek açılış bakiyeyi değiştirmez ve kartları koleksiyona eklemez.
- Tur Laboratuvarı ve Art Studio: ortak tema ve kart görünümü.

## Görseller

Görseller **yerleşik image_gen** aracıyla ayrı ayrı üretilmiştir. Kullanılan tam prompt'lar ve master yolları [generated-prompts.json](generated-prompts.json) dosyasındadır. Kart görselleri yalnızca illüstrasyon içerir; isim, nadirlik, çerçeve, dayanıklılık ve yetenekler React bileşenlerinde çizilir.

- `art/source/cards/<id>.png`: kart master'ları, 1024 × 1024.
- `art/source/tamers/<id>.png`: Tamer portreleri, 1024 × 1536.
- `art/source/weather/<id>.png`: hava sahneleri, 1536 × 864.
- `art/source/ui/`: menü/tur sahneleri ve paket illüstrasyonları.
- `src/generated/art/`: kart, Tamer ve hava WebP'leri ve küçük önizlemeler; Vite master'lardan otomatik üretir.
- `public/art/ui/`: arayüz için optimize edilmiş WebP'ler; Vite master'lardan otomatik üretir.

Master PNG'ler mevcut Git LFS kuralları kapsamındadır. Arayüz görselleri `buildUiAll`, diğer görseller `buildWebAll` üzerinden yeniden üretilebilir. `node scripts/art/accept-generated.ts <tür> <id> <PNG yolu>` komutu yeni imagegen çıktısını mevcut pipeline'a alır; mevcut master'ı üzerine yazmaz.

Revizyonlar `replace-generated.ts` ile alınır; önceki master `art/source/revisions/` içinde numaralı olarak korunur. Kullanıcının onayladığı Volkan Yılanı, okunaklı silüet için referanstır. Her yaratığın ayrı doğal habitatı vardır; alev elementinin arka planı kızıl olmak zorunda değildir. Renk uyumu korunur, ayrım açık/koyu değerlerle sağlanır. Efektler gövdeyi, kanatları veya kuyruğu örtmez. Nihai üretim planı `readable-card-plan.json`, tekil sonuçlar `results/readable-cards/`, küçük boyut denetimleri `previews/` içindedir.

Art Studio ve CLI prompt üreticisi de `content/art-direction.json` içindeki 125 kartın ayrı habitat ve yaratık tanımlarını kullanır. Ortak `content/art.json` şablonu, açık/koyu silüet ayrımını, sade efektleri ve tam kadrajı zorunlu tutar; rarity seviyeleri yoğun efekt duvarı üretmez.

## Kontrol

`npm run typecheck`, `npm run lint`, `npm test`, `npm run build`. Görseller için `node art/direction/verify-assets.mjs`, tüm master'ların ve WebP/thumbnail dosyalarının beklenen boyutlarını kontrol eder. Bu Windows sandbox'ında `tsx` kullanıcı bilgisi sorgusu hata verirse eşdeğer doğrulama: `node scripts/content/validate.ts`, ardından `npx tsc -b` ve `npx vite build`.

Arayüz 1920 × 1080 referans sahneyi mevcut Canvas Scaler Expand davranışıyla ölçekler. Tarayıcıda ana menü, gün planlama, tur dizimi/oynatma, koleksiyon araması, deste içeriği, kart sürükleyerek ekleme/çıkarma, yeni deste penceresi, paket önizlemesi, nadirlik tablosu ve 16:9 yerleşimi kontrol edilmiştir. 24 motor ve profil testi; deste-Tamer bağını, eski kayıtların korunmasını, yeni desteyi, kapasiteyi, nadirlik limitlerini ve özel desteyle oyun başlatmayı kapsar.
