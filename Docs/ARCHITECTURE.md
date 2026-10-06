# Canavar Deste — Web Prototipi Mimarisi

> Amaç: Unity'ye geçmeden önce oyunun **eğlenceli ve oynanabilir** olup olmadığını web'de hızlıca test etmek.
> Kurallar, içerik ve görseller baştan Unity'ye taşınacak şekilde kurulur.

## 1. İlkeler

1. **Simülasyon önce.** Oyunun her kuralı UI'dan bağımsız, deterministik bir motorda (`src/core`) yaşar.
   Arayüz hiçbir hesap yapmaz; motorun ürettiği olayları oynatır. Bu yüzden eklenen her kart ve mekanik
   **otomatik olarak simülasyonda da çalışır**.
2. **Denge sayıları simülasyondan gelir.** Yaratık canları (GDD v0.8 av sistemi) elle değil, oyuncu
   botlarının simülasyonuyla hesaplanır (`npm run sim -- calibrate`) ve `content/generated/hunts.json`
   dosyasına yazılır. GDD'deki denge hedefleri (`content/balance-targets.json`) otomatik kontrol edilir
   (`npm run sim -- check`).
3. **İçerik veridir.** Kartlar, Tamer'lar, hava, ekonomi, av yaratıkları ve bölgeler `content/*.json`'dadır.
   Kart yetenekleri kod değil, küçük bir **Effect DSL** ile yazılır; yaratığın niyetleri ve özellikleri de veridir.
   Unity aynı JSON'u okur.
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
   tur çözücü · av katmanı · sefer         dizilim botları · av botları            olay oynatıcı · ekranlar
   ekonomi · paket · Effect DSL            deste kurucu · can kalibrasyonu          harita · av · Art Studio
   ▲  saf TS, Unity'ye C# olarak taşınır    hedef kontrolü (GDD)                     1920×1080 sahne
   │                                                    │
   └────────── aynı fonksiyonları çağırır ──────────────┘
                                                        ▼
                                   content/generated/hunts.json  (kalibre yaratık canları → oyun okur)
```

Bağımlılık kuralı (oxlint ile zorunlu): `src/core` yalnızca kendi içinden import eder; `src/sim` UI/Node API kullanmaz.
Böylece motor tarayıcıda, Node CLI'da, testlerde ve ileride bir Web Worker'daki denge panelinde aynen çalışır.

## 3. Klasör yapısı

```
content/                     Oyun verisi (tasarımcının düzenlediği yer)
  cards.json                 Kartlar + Effect DSL yetenekleri + görsel tarifi (art.creature)
  tamers.json, weather.json  Tamer pasifleri, canı ve hava etkileri (ortak Modifier dili)
  economy.json               Nadirlik sınırları, kopya oranları, paket fiyatları, sefer ve öz ödülü ayarları
  hunts.json                 Av yaratıkları: kademe, can, niyet döngüsü, özellikler, fazlar, kilit, harita konumu,
                             kalibrasyon hedefi (deste ya da "ref" + hava + tur)
  regions.json               Dünya (ad, boyut) ve bölgeler: seviye, biyom, kilit (önceki Finaller), iklim, kitap buff'ı,
                             dünya haritasındaki alan, kamp, patikalar ve yer şekilleri
  decks.json                 Preset desteler (playtest ve başlangıç destesi)
  starter.json               Başlangıç destesi (decks.json'daki id) ve Tamer
  proposals/<set>/           Onay bekleyen kart/deste önerileri (oyuna girmez, --set / ?set= ile denenir)
  balance-targets.json       GDD denge hedefleri (simülasyon bunları kontrol eder)
  art.json                   Görsel prompt şablonları ve boyutlar (tür başına)
  generated/hunts.json       SİMÜLASYON ÇIKTISI: kalibre yaratık canları + referans desteler (versiyonlanır)
  schema/*.schema.json       JSON Schema (VS Code otomatik tamamlama) — npm run content:schema
src/
  core/                      Oyun motoru (Unity'ye taşınacak kısım)
    types.ts                 Tüm veri tipleri = oyunun spec'i
    engine/round.ts          Tur çözücü (geçiş döngüsü, anahtar kelimeler, gelir formülü)
    engine/rules.ts          Filtre / koşul / sayım değerlendirme
    engine/modifiers.ts      Hava + Tamer + albüm pasiflerinin derlenmesi
    engine/events.ts         Olay akışı (UI ve Unity oynatıcısı bunu oynatır)
    engine/custom.ts         DSL'e sığmayan tek kartlık kurallar
    day.ts                   Deste → eller, tur bağlamı (Tur Laboratuvarı ve deneyler)
    hunt.ts                  Av katmanı: yaratık canı, niyet, özellik, faz, Koruma, Tamer canı, av sonucu
    expedition.ts            Sefer kuralları, öz ödülü ve yıldız, av ve bölge kilitleri, bölge hava tahmini
    economy.ts, packs.ts     Paket fiyatı, kopya → öz, paket açma, deste doğrulama
    rng.ts, math.ts          Deterministik RNG, yuvarlama
  content/                   JSON yükleme + zod şemaları + çapraz kontroller
  sim/                       Botlar, deneyler, av simülasyonu (hunt.ts), dünya ilerlemesi (progression.ts),
                             bölge bölge kalibrasyon (calibrate-world.ts), hedef kontrolü
  art/prompts.ts             İçerikten ChatGPT prompt'u üretimi (CLI ve Art Studio ortak)
  ui/                        React arayüzü (Stage, CardView, olay oynatıcı, dünya haritası, av ekranı)
  state/                     zustand store'ları: game.ts (profil, koleksiyon, sefer), hunt.ts (av akışı)
  generated/art/             Web görselleri (üretilir, git dışı)
scripts/
  sim/simulate.ts            Simülasyon CLI (pool.ts + worker.ts: oyunları çekirdeklere dağıtır)
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

### 4.4 Av katmanı (GDD v0.8)

`src/core/hunt.ts` tur çözücünün üstüne oturur, onu değiştirmez. Motorun bu katman için verdiği üç küçük kanca:

| Kanca | Ne işe yarar |
|---|---|
| `{ op: 'guard' }` efekti | Koruma: tur sonu saldırısını emer. Kart çarpanı uygulanmaz; yetenek ölçeği, hava ve Tamer uygulanır. |
| `slumberAtStart` modifier'ı | Tur başında bir slotu uyutur (Kükreme niyeti). Yırtma/Kuyruk Savurma mevcut `durabilityAtStart` ile yazılır, Ward bunları da engeller. |
| `RoundContext.hit` | Her yetenek çözümünden sonra çağrılır (ability olayıyla aynı sıra). Av katmanı geliri hasara çevirir; olay nesnesi oluşmadığı için simülasyonda ucuzdur. |

Tur akışı: niyet → niyetin tur başı modifier'ları → tur çözülür, her vuruş sırasıyla direnç/zayıflık → Yarı Saydam →
Savuşturma (her geçişin ilk Strike'ı) → Zırh → Kabuk süzgecinden geçip yaratığın canından düşer → can 0'da yaratık
o tetikte bayılır (ikinci can çubuğu varsa bir kez döner), olay akışı orada kesilir → bayılmadıysa tur sonunda
niyet uygulanır: saldırı Koruma kadar azalır, kalanı Tamer'ın canından düşer → faz eşiği geçildiyse niyet döngüsü
değişir. Sonuçlar: `captured`, `escaped` (6 tur bitti), `fled` (Kaçış Hazırlığı), `tamerDown`, `nightfall`
(Kadim kuşatmanın günü bitti, yaratık ertesi gün kaldığı candan devam eder).

`src/core/expedition.ts` seferin saf kurallarıdır: Erzak ile dinlenme, öz ödülü (taban × hız × seri), yıldızlar,
yaralı yaratık (kaçan yaratığa verilen hasarın %25'i seferde kalır), kilitler (Final yakalama sayısıyla, Efsanevi
bölge kitabı + İz ile, Kadim bir avdan sonra) ve bölgenin tohumlu 5 günlük hava tahmini (`regionForecast`).
Profil ve av akışı (`src/state`) yalnızca bu fonksiyonları çağırır.

### 4.5 Dünya ve biyomlar (GDD v0.9)

Dünya (`regions.json → world`) sekiz bölgeden oluşur; her bölgenin seviyesi, biyomu, iklimi, kitap buff'ı ve
dünya haritasındaki alanı (`area`, dünya birimi) vardır. Avların ve kampın konumu bölge alanında 0..1'dir.
`regionUnlocked`: başlangıç bölgesi açıktır, diğerleri kilitlerinde listelenen bölgelerin **Final** avı
bayıltılınca açılır (Kül Vadisi → Kıyı/Orman → Yayla/Çöl → Bataklık/Mağaralar → Ejder Zirvesi). Sefer tek bir
bölgede geçer (`huntAvailability` → `elsewhere`); kitabı tamamlanan bölgelerin buff'ları dünyadaki tüm avlarda
geçerlidir (`worldPassives`). Biyomun görünüşü (parşömen tonu, serpiştirilen arazi işaretleri) içerikte değil,
`src/ui/expedition/mapStyle.ts` → `BIOME_STYLE`'dadır; bölgeye özgü nehir, göl, nişan ve yer adları
`regions.json → map.features`'tadır. Dünya haritası (`WorldMap.tsx`) araziyi tek bir SVG'de bir kez çizer ve
yalnızca `viewBox`'ı kaydırır; yakınlık 0,4'ün altında bölge rozetleri, üstünde yaratık düğümleri gösterilir.

## 5. Simülasyon ve denge

```
npm run sim -- check                 GDD hedeflerinin hepsi (✓/✗ tablo), --strict ile CI'da kırar
npm run sim -- arrange --days 500    Dizilim becerisi: usta / acemi / rastgele bot
npm run sim -- weather               Hava uyumu: havaya kurulmuş deste / en uygunsuz deste
npm run sim -- cards                 Kart gücü: marjinal katkı, nadirlik içi z-skoru (▲▼ aykırılar)
npm run sim -- hunts                 Her av: hedef profil ve başlangıç destesi (bayıltma oranı, tur, Tamer kaybı)
npm run sim -- hunts --hunt storm_hound --deck firtina --weather stormy --bot master
npm run sim -- world                 Dünya ilerlemesi: tipik oyuncu kaç saatte nereye varır (--samples 32 --bot casual|aware)
npm run sim -- calibrate             Referans desteler + yaratık canları, bölge bölge → content/generated/hunts.json
npm run sim -- decks                 Preset desteler: dizilim etkisi + deste × hava gelir matrisi
npm run sim -- review --set v1       Öneri kart seti incelemesi → Docs/proposals/kart-seti-v1.md
```

**Kart önerisi → onay akışı:** yeni kartlar `content/proposals/<set>/cards.json`'a yazılır (oyuna girmez) →
`npm run content:check -- --set <set>` → `npm run sim -- review --set <set>` (güç, sinerji ortakları, nadirlik
eğrisi, element destelerinde dizilim etkisi, hava uyumu) → Tur Laboratuvarı'nda `?set=<set>` ile elle deneme →
onaydan sonra `content/cards.json`'a taşınır ve yaratık canları yeniden kalibre edilir. Sinerji ölçümü: iki kart birlikte
masadayken, her biri rastgele kartla değiştirildiği duruma göre usta dizilimle fazladan gelir.

Her çalıştırma `sim-results/` altına JSON bırakır (sürümler arası karşılaştırma için).

**Botlar.** `random`, `novice` (tek geçişli açgözlü), `master` (tüm dizilimler). Deste kurucu bot, kart değerini
*marjinal katkı* ile ölçer (rastgele masaya kartı eklemenin gelire kattığı fark) ve desteyi iteratif kurar —
sinerjileri (Sayım, aura, saf deste, kopya) iki yönlü yakalar.

**Av botları** (`src/sim/hunt.ts`): `aware` yaratığın niyetini ve özelliklerini bilir, tüm dizilimleri av
sonucuyla dener (hasar + gelen saldırıyı karşılayan Koruma; bayıltan dizilim her zaman önde). `master` ve
`novice` yaratığı yok sayar (v0.6 ustası ve acemisi). `aware / master` farkı, "niyetler dizilim kararı yaratıyor
mu" sorusunun ölçüsüdür (`intentAwareness` hedefi, yalnızca niyetin dizilim sorduğu turlarda, aynı elle eşli).
Oyun içindeki "en iyi dizilim" karşılaştırması ve Hızlı Av da `aware` botu kullanır.

**Dünya ilerlemesi** (`src/sim/progression.ts`). "Tipik oyuncu" dünyayı baştan oynar: kampta özünü Standart
pakete çevirir, gideceği bölgenin en sık havasına göre koleksiyonundan deste kurar (deste kurucu bot), sefere
çıkar; her gün bayıltmadığı en kolay yaratığı seçer, zırhını söndüren hava 2 gün içinde geliyorsa bekler, canı
niyet döngüsünün beklenen hasarına yetmiyorsa dinlenir ya da kampa döner, yapacak av kalmayınca yakaladıklarını
kopya ve öz için yeniden avlar (★★★ ise Hızlı Av). Takıldığı bölgeyi erteler, yeni bölge açılınca geri gelir.
Dizilim becerisi `casual` (turların %60'ında niyeti bilerek dizer) ya da `aware`. Süre modeli: tur başına planlama
+ adım başına oynatma (`economy.json → timing`) + av, kamp, paket ve deste düzenleme ekranları (`OVERHEAD`).
Rapor: ana hikâye (tüm Finaller), bölge kitapları ve tüm avlar için saat; bölge başına varış ve kalış süresi.
Şu anki dünya (6 Ekim 2026, 30 oyun, ortalama oyuncu): ana hikâye 10,4 sa, bölge kitapları 11,3 sa, tüm avlar 14,2 sa.

**Kalibrasyon.** Her yaratığın `target`'ı vardır: deste + hava + hedef tur (ör. ref, Sakin, 4,5). Deste `"ref"` ise
**referans destesi** kullanılır: dünya ilerlemesi o noktaya kadar 24 kez oynatılır (bölgeye giriş → Sıradanlar,
4. yakalama → Zorlu ve Final, kitap tamam → Efsanevi ve Kadim), oyuncuların koleksiyonlarının medyanından avın hedef
havasına göre deste kurulur. Bölgeler oyuncunun gezdiği sırayla kalibre edilir, böylece her bölgenin zorluğu oraya
gelen oyuncunun gerçekten kurabileceği desteye bağlanır (elinde olmayan desteyle kalibre edilmiş av olmaz). Can,
`aware` botun (Tamer ölümsüz) medyan kesirli bayıltma turu hedefe eşit olana kadar ayarlanır: önce oransal adım,
sonra hedefi kuşatan aralıkta ikiye bölme (bayıltma turu cana göre artan bir fonksiyondur). Ortak tohumlar
gürültüyü azaltır, sonuç 10'un katına yuvarlanır. Kadim kuşatmada her gün o günün havasına kurulmuş referans destesiyle
oynanır. Oyun ve sonraki simülasyonlar `content/generated/hunts.json`'ı (canlar + `refDecks` + `huntDecks`) okur.

**Av hedefleri** (`content/balance-targets.json`): `huntRound` (her av hedef turun ±0,5'inde), `starterHunts`
(başlangıç destesi başlangıç bölgesinin Sıradan avlarını en az %80 bayıltır), `intentAwareness` (≥ %4), `weatherHunt`
(zırhı söndüren hava bayıltmayı en az 1 tur öne çeker), `tamerSafety` (ortalama oyuncu tam canla girdiği hiçbir avda
%10'dan fazla bayılmaz), `expedition` (başlangıç destesiyle 3 Sıradan avdan sonra Tamer canı
%20-60: can taşınır ve hissedilir), `dayLength` (av 3-8 dk).

**İş akışı (her içerik değişikliğinde):**

```
content düzenle → npm run content:check → npm test → npm run sim -- cards → npm run sim -- calibrate
→ npm run sim -- check → content/generated/hunts.json ile birlikte commit
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

`npm run dev` → OYNA → dünya haritası (`ExpeditionScreen`): sürükle/yakınlaş, bölge rozetinden bölge kartı (biyom,
iklim, devler, kitap ödülü, kilit); odaktaki bölgenin 5 günlük havası, Tamer canı, Erzak, İz, çanta; kamptan
odaktaki bölgeye sefere çık → haritadan yaratık seç (niyet döngüsü, özellikler, ödül) → av (`HuntScreen`): yaratığın niyetine göre
5 kartı diz, BAŞLAT, olay akışını izle (vuruşlar, Koruma, yaratığın hamlesi; x1/x2/x4/Atla) → her tur sonunda
**aynı elin en iyi dizilimi** (yaratığı bilen bot) ile karşılaştırma → av sonucu (yıldız, öz dökümü, yeni kilitler)
→ haritaya dön: dinlen, kampa dön ya da sonraki av. İlerleme tarayıcıda (localStorage, `canavar-deste-v08`)
saklanır; aynı profil tohumu + gün + av = aynı eller. Ayarlar → "Playtest: tüm kartlar açık" koleksiyon kısıtını kaldırır.

Her av `HuntLog` olarak kaydedilir (el, dizilim, niyet, hasar, Koruma, en iyi hasar, planlama saniyesi). Ana menü
Ayarlar → "Av kayıtlarını indir" JSON verir: gerçek oyuncu verisi simülasyon varsayımlarıyla karşılaştırılır.
Kod: `src/state/game.ts` (profil, koleksiyon, sefer), `src/state/hunt.ts` (av akışı, Hızlı Av),
`src/ui/screens/ExpeditionScreen.tsx`, `HuntScreen.tsx`, `src/ui/expedition/` (dünya haritası, bölge kartı, sonuç).

## 8. Unity'ye geçiş

`npm run art:export-unity -- --unity <UnityProjesi>` şunu yazar:

- `Assets/BeastTamer/Art/{Cards,Tamers,Weather}/*.png` — `BeastTamerArtPostprocessor.cs` bunları otomatik olarak
  UI Sprite ayarlarıyla import eder.
- `Assets/BeastTamer/Content/*.json` — içerik (hunts, regions dahil) + `hunts-balance.json` (Newtonsoft JSON ile okunur:
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
2. ✅ Av sistemi (GDD v0.8): yaratık canı, niyetler, özellikler, Koruma, Tamer canı; Kül Vadisi (8 yaratık, Final,
   Efsanevi ve Kadim av); sefer, Erzak, İz, çanta; koleksiyon sahipliği, Market'te gerçek paket alımı, Hızlı Av.
3. ✅ Simülasyonla yaratık canı kalibrasyonu ve av hedefleri (`sim -- calibrate`, `sim -- check`).
4. Playtest: 3-4 testçiyle "oyunun amacı var mıydı?", niyete göre dizilim değişti mi, kampa dönme kararı.
5. ✅ Dünya (GDD v0.9): 8 biyom, 116 av, bölge kilitleri, dünya haritası; dünya ilerleme simülasyonu ve referans
   desteyle bölge bölge kalibrasyon (`sim -- world`, `sim -- calibrate`).
6. Kural katmanı (Final ve Kule), Kule ve Dev Av modları.
7. Tarayıcıda denge paneli (sim'i Web Worker'da çalıştırıp grafikle gösterme).
