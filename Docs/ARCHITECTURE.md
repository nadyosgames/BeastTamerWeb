# Canavar Deste — Web Prototipi Mimarisi

> Amaç: Unity'ye geçmeden önce oyunun **eğlenceli ve oynanabilir** olup olmadığını web'de hızlıca test etmek.
> Kurallar, içerik ve görseller baştan Unity'ye taşınacak şekilde kurulur.

## 1. İlkeler

1. **Simülasyon önce.** Oyunun her kuralı UI'dan bağımsız, deterministik bir motorda (`src/core`) yaşar.
   Arayüz hiçbir hesap yapmaz; motorun ürettiği olayları oynatır. Bu yüzden eklenen her kart ve mekanik
   **otomatik olarak simülasyonda da çalışır**.
2. **Denge sayıları simülasyondan gelir.** Kota eğrisi, paket ekonomisi ve oyun süresi elle değil,
   oyuncu ajanlarının simülasyonuyla hesaplanır (`npm run sim -- calibrate`) ve
   `content/generated/balance.json` dosyasına yazılır. GDD'deki denge hedefleri
   (`content/balance-targets.json`) otomatik kontrol edilir (`npm run sim -- check`).
3. **İçerik veridir.** Kartlar, Tamer'lar, hava, ekonomi ve takvim `content/*.json`'dadır. Kart yetenekleri
   kod değil, küçük bir **Effect DSL** ile yazılır. Unity aynı JSON'u okur.
4. **Unity'ye taşınabilirlik.** Motor saf TypeScript: enum/sınıf yok, düz veri, tohumlanabilir RNG, sabit yuvarlama
   kuralı. Motor çıktısı "golden test" dosyası olarak dışa aktarılır; C# portu aynı sonuçları üretmek zorundadır.
5. **Görseller ChatGPT ile.** Görselde yalnızca yaratık illüstrasyonu olur; çerçeve, isim, sayılar arayüzde kurulur.
   ChatGPT çıktısı → master PNG → web WebP ve Unity PNG türevleri.

## 2. Katmanlar

```
 content/*.json  ──zod doğrulama──▶  src/content  ──▶  ContentDB (tipli, çapraz kontrollü)
                                                        │
          ┌─────────────────────────────────────────────┼──────────────────────────────────┐
          ▼                                             ▼                                  ▼
   src/core  (oyun motoru)                 src/sim  (simülasyon)                   src/ui  (React)
   tur çözücü · gün · takvim/hava          dizilim botları · deste kurucu          olay oynatıcı · ekranlar
   ekonomi · paket · Effect DSL            kampanya ajanı · kalibrasyon             Art Studio · Tur Laboratuvarı
   ▲  saf TS, Unity'ye C# olarak taşınır    hedef kontrolü (GDD)                     1920×1080 sahne
   │                                                    │
   └────────── aynı fonksiyonları çağırır ──────────────┘
                                                        ▼
                                   content/generated/balance.json  (kalibre kota eğrisi → oyun okur)
```

Bağımlılık kuralı (oxlint ile zorunlu): `src/core` yalnızca kendi içinden import eder; `src/sim` UI/Node API kullanmaz.
Böylece motor tarayıcıda, Node CLI'da, testlerde ve ileride bir Web Worker'daki denge panelinde aynen çalışır.

## 3. Klasör yapısı

```
content/                     Oyun verisi (tasarımcının düzenlediği yer)
  cards.json                 Kartlar + Effect DSL yetenekleri + görsel tarifi (art.creature)
  tamers.json, weather.json  Tamer pasifleri ve hava etkileri (ortak Modifier dili)
  economy.json               Nadirlik sınırları, kopya oranları, paketler, pity, süre varsayımları
  calendar.json              Gün/hafta/ay/yıl, burçlar ve albüm pasifleri, hava kuralları
  decks.json                 Preset desteler (playtest ve başlangıç destesi)
  starter.json               Başlangıç destesi (decks.json'daki id) ve Tamer
  proposals/<set>/           Onay bekleyen kart/deste önerileri (oyuna girmez, --set / ?set= ile denenir)
  balance-targets.json       GDD denge hedefleri (simülasyon bunları kontrol eder)
  art.json                   Görsel prompt şablonları ve boyutlar (tür başına)
  generated/balance.json     SİMÜLASYON ÇIKTISI: kalibre kota eğrisi (versiyonlanır)
  schema/*.schema.json       JSON Schema (VS Code otomatik tamamlama) — npm run content:schema
src/
  core/                      Oyun motoru (Unity'ye taşınacak kısım)
    types.ts                 Tüm veri tipleri = oyunun spec'i
    engine/round.ts          Tur çözücü (geçiş döngüsü, anahtar kelimeler, gelir formülü)
    engine/rules.ts          Filtre / koşul / sayım değerlendirme
    engine/modifiers.ts      Hava + Tamer + albüm pasiflerinin derlenmesi
    engine/events.ts         Olay akışı (UI ve Unity oynatıcısı bunu oynatır)
    engine/custom.ts         DSL'e sığmayan tek kartlık kurallar
    day.ts, calendar.ts      Gün (maç) akışı, takvim, haftalık hava üretimi
    economy.ts, packs.ts     Kota, paket fiyatı, kopya → kaynak, paket açma, deste doğrulama
    rng.ts, math.ts          Deterministik RNG, yuvarlama
  content/                   JSON yükleme + zod şemaları + çapraz kontroller
  sim/                       Botlar, deneyler, kampanya, kalibrasyon, hedef kontrolü
  art/prompts.ts             İçerikten ChatGPT prompt'u üretimi (CLI ve Art Studio ortak)
  ui/                        React arayüzü (Stage, CardView, olay oynatıcı, ekranlar)
  state/                     zustand store'ları
  generated/art/             Web görselleri (üretilir, git dışı)
scripts/
  sim/simulate.ts            Simülasyon CLI
  art/*.ts                   Görsel pipeline CLI (prompts, ingest, status, generate, export-unity)
  content/*.ts               İçerik doğrulama, JSON Schema dışa aktarımı
tools/
  vite-plugin-art-studio.ts  Dev sunucusu: tarayıcıdan görsel yükleme uç noktası
  unity/                     Unity'ye kopyalanan editör script'leri
art/
  inbox/                     ChatGPT'den indirilenler buraya (git dışı)
  source/                    MASTER görseller (git LFS) — tek gerçek kaynak
  style-ref/                 Stil referans görselleri (tür başına bir tane)
  originals/, prompts/       Ham arşiv ve üretilmiş prompt'lar (git dışı)
```

## 4. Motor

### 4.1 Tur çözücü

`resolveRound(cards, ctx, emit?)` GDD "Hesaplama sırası"nı uygular:

1. Tur başı: hava/Tamer/albüm dayanıklılık etkileri → Elektrik kutup bağlantıları → Howl.
2. Geçişler: aktif kartlar **Swift → soldan sağa → Heavy** sırasıyla Harvest tetikler; her tetik 1
   (Overload: 2) dayanıklılık düşürür, Ward ilk kaybı engeller, Slumber N ilk N−1 geçişte uyutur.
   Dayanıklılığı biten kart: **Last Breath → (Rebirth | pasif + Haunt)**.
3. Tüm kartlar bitince Epilogue; tur kapanır.

Gelir formülü (tetik başına):

```
ham  = (Σ gain + Σ gainPer + aura) × Π mult + kopyalanan
son  = ham × abilityScale × (1 + Σ hava%) × (1 + Σ albüm%) × Π (1 + Tamer%)
gelir = floor(son + 0.5)          ← C#'ta da Math.Floor(x + 0.5); Math.Round KULLANMA (banker's rounding)
```

Performans: tur başına ~1,7 µs, usta botla tam gün ~1,7 ms. Simülasyonda `emit` verilmez, olay nesnesi oluşmaz.

### 4.2 GDD'de açık olup motorda karar verilen noktalar

| Konu | Karar (değiştirilebilir) |
|---|---|
| Kopyalanan gelir ("önceki kartın o tetikteki geliri") | Soldaki kartın **bu geçişteki ham** geliri (hava/Tamer öncesi). O geçişte tetiklenmediyse 0. |
| Rebirth olan kart | Pasife geçmiş sayılmaz → Haunt tetiklenmez. Last Breath yalnızca ilk ölümde. |
| Ek tetik (retrigger) | Dayanıklılık harcamaz, pasif kartı da tetikleyebilir. |
| "Son tetik" koşulu | Bu tetik dayanıklılığı 0'a düşürecekse (Ward varken değil). |
| Tetik sınırı (60) | Tüm yetenek çözümleri sayılır; Epilogue sınırdan bağımsız çalışır. |
| Global çarpanlar | Kartın tüm gelirine (Harvest, Last Breath, Haunt, Epilogue) uygulanır. Aura yalnızca Harvest'e. |
| Hibrit kart + hava | Elementlerin yüzdeleri toplanır (Ateş+Su, Güneşli: +40 −20 = +%20). |

### 4.3 Effect DSL ve yeni mekanik ekleme

Kart yeteneği = `{ on: <zamanlama>, effects: [...] }`. Efektler: `gain`, `gainPer`, `mult`, `copyIncome`,
`addHeat`, `addDurability`, `retrigger`, `aura`, `custom`. Koşullar (`if`): `count`, `allCards`, `slot`,
`position`, `neighbor`, `passParity`, `lastTrigger`, `link`, `round`, `self`, `not/all/any`.
Sayımlar (`gainPer.per`): `cards` (`side` ile yön sayımı: "sağındaki her Ateş kartı"), `chain` (Alev Zinciri:
komşudan başlayan **ardışık** eşleşen kart sayısı), `distinctElements`, `heat`, `selfTriggers`, `pass`.

**Dizilim tasarım ilkesi** (simülasyondan): konuma duyarlı kart doğru dizildiğinde konumsuz karttan güçlü,
yanlış dizildiğinde zayıf olmalı ("yüksek tavan, düşük taban"). Aksi halde iyi oyuncu konumsal kartları desteye
almaz ve dizilim kararı önemsizleşir. Tek elementli destede kendiliğinden sağlanan koşullar ("sağındaki kart Ateş")
karar yaratmaz; tip, konum, dayanıklılık, zincir ve kutup koşulları yaratır.

- **Sadece yeni kart** (mevcut efektlerle): `content/cards.json`'a yaz → `npm run content:check` →
  `npm run sim -- cards` (gücü akranlarıyla karşılaştır) → `npm run sim -- check`.
- **Yeni efekt/koşul türü**: `core/types.ts`'e tip → `content/schema.ts`'e şema → `engine/round.ts` veya
  `engine/rules.ts`'e `case` (TypeScript eksik `case`'i derleme hatası yapar) → test → `npm run content:schema`.
- **Tek kartlık kural bükücü** (Mythic/Ancient): `engine/custom.ts`'e id ile fonksiyon, kartta `{ "op": "custom" }`.

Hangi yol seçilirse seçilsin mekanik simülasyona, Tur Laboratuvarı'na ve golden testlere otomatik girer.

## 5. Simülasyon ve denge

```
npm run sim -- check                 GDD hedeflerinin hepsi (✓/✗ tablo), --strict ile CI'da kırar
npm run sim -- arrange --days 500    Dizilim becerisi: usta / acemi / rastgele bot
npm run sim -- weather               Hava uyumu: havaya kurulmuş deste / en uygunsuz deste
npm run sim -- cards                 Kart gücü: marjinal katkı, nadirlik içi z-skoru (▲▼ aykırılar)
npm run sim -- campaign --profile good|casual|mismatched --weeks 144
npm run sim -- calibrate             Kota eğrisini üretir → content/generated/balance.json
npm run sim -- decks                 Preset desteler: dizilim etkisi + deste × hava gelir matrisi
npm run sim -- review --set v1       Öneri kart seti incelemesi → Docs/proposals/kart-seti-v1.md
```

**Kart önerisi → onay akışı:** yeni kartlar `content/proposals/<set>/cards.json`'a yazılır (oyuna girmez) →
`npm run content:check -- --set <set>` → `npm run sim -- review --set <set>` (güç, sinerji ortakları, nadirlik
eğrisi, element destelerinde dizilim etkisi, hava uyumu) → Tur Laboratuvarı'nda `?set=<set>` ile elle deneme →
onaydan sonra `content/cards.json`'a taşınır ve kota yeniden kalibre edilir. Sinerji ölçümü: iki kart birlikte
masadayken, her biri rastgele kartla değiştirildiği duruma göre usta dizilimle fazladan gelir.

Her çalıştırma `sim-results/` altına JSON bırakır (sürümler arası karşılaştırma için).

**Botlar.** `random`, `novice` (tek geçişli açgözlü), `master` (tüm dizilimler). Deste kurucu bot, kart değerini
*marjinal katkı* ile ölçer (rastgele masaya kartı eklemenin gelire kattığı fark) ve desteyi iteratif kurar —
sinerjileri (Sayım, aura, saf deste, kopya) iki yönlü yakalar.

**Kampanya ajanı** haftalar boyunca oynar: takvim → haftalık hava → (havaya göre) deste → dizilim → kota →
haftalık paket → bakiye ile paket alımı → kopya → kaynak → yıl sonu albüm pasifi → Tamer açılışları.
Profiller: `good` (usta + havaya göre deste), `casual` (acemi + tek deste), `mismatched` (bilerek uyumsuz deste).

**Kalibrasyon.** `kota[hafta] = medyan(iyi oyuncu geliri[hafta]) / 1.15`. Kota → paket → koleksiyon → gelir
döngüsel olduğu için birkaç iterasyonda sabit noktaya yakınsatılır, eğri yumuşatılıp azalmaz yapılır.
Oyun ve sonraki simülasyonlar bu dosyayı okur.

**İş akışı (her içerik değişikliğinde):**

```
content düzenle → npm run content:check → npm test → npm run sim -- cards → npm run sim -- calibrate
→ npm run sim -- check → content/generated/balance.json ile birlikte commit
```

## 6. Görsel pipeline (ChatGPT)

```
content (art.creature) ──npm run art:prompts──▶ art/prompts/PROMPTS.md
        │
        └─ ChatGPT'de üret (1 istek = 1 görsel, aynı sohbet, stil referansı) ──indir──▶
           art/inbox/<tür>/<id>.png   ya da   Art Studio'da karta sürükle-bırak
                         │
              npm run art:ingest / dev eklentisi
                         ▼
           art/source/<tür>/<id>.png        MASTER (git LFS) — oran kırpma + hedef boyut
           art/originals/…                  ham dosya arşivi (yeniden kırpmak için)
           src/generated/art/…webp          web sürümleri (dev/build başında otomatik)
                         │
              npm run art:export-unity
                         ▼
           export/unity/Assets/BeastTamer/{Art,Content,Editor}
```

| Tür | ChatGPT boyutu | Master | Kullanım |
|---|---|---|---|
| cards | 1024×1024 | 1024×1024 | Kart sanat penceresi (çerçeve UI'da) |
| tamers | 1024×1536 | 1024×1536 | Tamer seçimi portresi |
| weather | 1536×1024 | 1536×864 (16:9 kırpma) | Haftalık hava bandı |

- **Stil tutarlılığı:** beğenilen ilk görseli `art/style-ref/<tür>.png` olarak kaydet; prompt başına stil
  cümlesi eklenir, ChatGPT'ye bu görsel de yüklenir (Konsept çizimlerdeki stil için `Concept Arts/collection2.png`
  ilk referans olarak kullanılabilir).
- **Toplu üretim (isteğe bağlı, ücretli):** `npm run art:generate -- --yes` OpenAI Images API ile eksikleri üretir
  (`.env` → `OPENAI_API_KEY`). Varsayılan çalıştırma yalnızca listeler.
- **Durum:** `npm run art:status`, Art Studio'daki sayaçlar.
- **Git LFS:** `art/source`, `art/style-ref` ve `Concept Arts` LFS'te (`.gitattributes`). Klonlayan herkes bir kez
  `git lfs install` çalıştırmalı.

## 7. Playtest modu

`npm run dev` → OYNA. Günü Planla (haftanın havası, Tamer, preset deste, haftalık kota) → 6 tur: çekilen 5 kartı
sürükleyerek diz, BAŞLAT, motorun olay akışını izle (x1/x2/x4/Atla) → her tur sonunda **aynı elin en iyi dizilimi**
ile karşılaştırma → gün özeti (usta bota göre verim, gerçek süre, tur başına planlama süresi) → 5 günde hafta
sonucu ve kota. İlerleme tarayıcıda (localStorage) saklanır; aynı profil tohumu + gün = aynı eller.

Her gün `DayLog` olarak kaydedilir (el, dizilim, gelir, en iyi gelir, planlama saniyesi). "Kayıtları indir"
JSON verir: gerçek oyuncu verisi simülasyon varsayımlarıyla (economy.json `planningSecPerRound`, usta/acemi bot
oranları) karşılaştırılır ve dengeye geri beslenir. Kod: `src/state/game.ts` (profil), `src/state/run.ts`
(gün akışı), `src/ui/screens/PlanDayScreen.tsx`, `RunScreen.tsx`.

## 8. Unity'ye geçiş

`npm run art:export-unity -- --unity <UnityProjesi>` şunu yazar:

- `Assets/BeastTamer/Art/{Cards,Tamers,Weather}/*.png` — `BeastTamerArtPostprocessor.cs` bunları otomatik olarak
  UI Sprite ayarlarıyla import eder.
- `Assets/BeastTamer/Content/*.json` — içerik + `balance.json` (Newtonsoft JSON ile okunur:
  `com.unity.nuget.newtonsoft-json`). `art-manifest.json` görsel ↔ id eşlemesi ve hash içerir.
- `Assets/BeastTamer/Content/golden-rounds.json` — 300 tur için girdi + beklenen olay akışı. C# motoru
  bunları NUnit (Unity Test Framework) ile birebir geçmeli: web ve Unity aynı oyunu oynar.

C# port eşleştirmesi: `types.ts` → `[Serializable]` sınıflar / enum'lar, `round.ts` → `RoundResolver`,
`events.ts` → olay tipleri (oynatıcı DOTween ile aynı olay → görsel kuralını uygular), `rng.ts` → `uint` ile
mulberry32, `math.ts` → `Math.Floor(x + 0.5)`. Web arayüzü 1920×1080 referanslı sahnede kurulur ve Unity Canvas
Scaler'ın **Expand** kuralıyla pencereyi doldurur (kısa kenar referansa oturur, uzun kenar uzar; siyah bant yok).
Unity'de aynı ayar: Scale With Screen Size, Reference 1920×1080, Screen Match Mode = Expand. Ekranlar kenarlara
çapalanır, ortalanacak öğeler `useStage().width` ile hesaplanır.

## 9. Kütüphaneler

| Paket | Sürüm | Neden |
|---|---|---|
| vite | 8.3 | Dev sunucusu, HMR, build; Art Studio eklentisi |
| react / react-dom | 19.3 | Menü ağırlıklı kart oyunu arayüzü için DOM/CSS en hızlı yol |
| typescript | 6.0 | `erasableSyntaxOnly`: kod Node'da tip silmeyle de çalışır, C#'a taşımaya uygun sade sözdizimi |
| zod | 4.6 | İçerik JSON doğrulama + JSON Schema üretimi |
| zustand | 5.0 | Hafif durum yönetimi (React dışından da erişilebilir) |
| motion | 13.5 | Kart animasyonları (gelir balonu, tetik vurgusu) |
| @fontsource/cinzel, alegreya-sans | 5.3 | Konsept çizimlerdeki fantastik başlık + okunaklı gövde fontu (Türkçe karakterli, çevrimdışı) |
| vitest | 5.0 | Motor testleri |
| tsx | 4.23 | TS script'lerini (sim, art) doğrudan çalıştırma |
| sharp | 0.35 | Görsel kırpma/ölçekleme/WebP (art pipeline) |
| oxlint | 1.86 | Hızlı lint + katman sınırı kuralları |

## 10. Sıradaki adımlar (GDD prototip planı)

1. ✅ Tur çözücü ve simülasyon (CLI) — "dizilimin gerçek etkisi var mı?" ölçülüyor.
2. ✅ Oynanabilir gün: Günü Planla → 6 tur → sonuç, x1/x2/x4/Atla, gerçek gün süresi ölçümü.
3. ✅ Hafta: 5 gün, kota çubuğu, günlük hava, 6 preset deste (playtest kaydı + JSON dışa aktarım).
4. Koleksiyon: paketler, market, kopya → kaynak, deste düzenleme ekranı.
5. Albüm ve quest kitabı + simülasyona quest/albüm görevleri.
6. Tarayıcıda denge paneli (sim'i Web Worker'da çalıştırıp grafikle gösterme).
