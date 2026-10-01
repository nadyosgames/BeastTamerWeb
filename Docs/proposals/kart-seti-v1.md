# Kart Seti v1 — İnceleme (ONAYLANDI)

Üretildi: 01.10.2026 19:01:54 · `npm run sim -- review --set v1` · tohum 20261001 · 83 sn

**Durum:** 1 Ekim 2026'da onaylandı ve `content/cards.json`'a taşındı (preset desteler `content/decks.json`). Ateş için onay sonrası "Alev Zinciri" (ardışık sol Ateş kartı sayımı) eklendi; bu belge o son hali gösterir.

Tarayıcıda dene: `npm run dev` → `http://localhost:5173/#lab` ya da OYNA.

## Nasıl okunur

- **Değer**: kartın tur başına ortalama gelir katkısı. Rastgele 4 kartlık masaya eklenir, iki masa da **usta dizilimle** oynanır, fark alınır.
  - *Karışık*: masadaki diğer kartlar tüm setten. *Element*: yalnızca kartın kendi element(ler)inden (o elementin destesinde nasıl çalıştığı).
- **z**: aynı nadirlikteki kartlara göre sapma. ▲ (> 1,5) fazla güçlü, ▼ (< −1,5) zayıf olabilir.
- **Sinerji ortakları**: iki kart birlikteyken, her biri rastgele bir kartla değiştirildiği duruma göre fazladan kazanılan gelir (tur başına). Aynı kartın iki kopyası da sayılır (Sürü, Ejder gibi).

## Özet

| Element | Common | Uncommon | Rare | Epic | Legendary | Mythic | Toplam | Tipler |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| Ateş | 8 | 6 | 5 | 3 | 2 | 1 | 25 | beast 6, dragon 6, swarm 3, avian 3, golem 3, serpent 2, flora 1, ghost 1 |
| Su | 8 | 6 | 5 | 3 | 2 | 1 | 25 | beast 13, serpent 6, ghost 3, flora 1, avian 1, dragon 1 |
| Toprak | 8 | 6 | 5 | 3 | 2 | 1 | 25 | beast 8, flora 7, golem 6, avian 2, swarm 1, serpent 1 |
| Rüzgar | 8 | 6 | 5 | 3 | 2 | 1 | 25 | avian 11, beast 5, ghost 3, flora 2, dragon 2, swarm 1, serpent 1 |
| Elektrik | 8 | 6 | 5 | 3 | 2 | 1 | 25 | beast 14, serpent 4, golem 3, dragon 2, swarm 1, ghost 1 |

Hibritler (10, her element çifti için bir tane): Buhar Kaplumbağası (Ateş+Su), Kor Şimşek Ejderi (Ateş+Elektrik), Çamur Kaplumbağası (Su+Toprak), Yağmur Kuşu (Su+Rüzgar), Volkan Kaplumbağası (Toprak+Ateş), Kum Fırtınası Kartalı (Toprak+Rüzgar), Şimşek Atmacası (Rüzgar+Elektrik), Ateş Atmacası (Rüzgar+Ateş), Elektrikli Yılanbalığı (Elektrik+Su), Mıknatıs Golemi (Elektrik+Toprak).

## Simülasyon kontrolleri

### Nadirlik eğrisi (ortalama değer, tur başına)

| Nadirlik | Ortalama | Ateş | Su | Toprak | Rüzgar | Elektrik |
|---|---:|---:|---:|---:|---:|---:|
| Common | **18.8** | 20.9 | 17.3 | 18.6 | 16.5 | 20.5 |
| Uncommon | **22.6** | 25.7 | 20.3 | 23.3 | 18.8 | 24.9 |
| Rare | **25.8** | 28.7 | 22.7 | 24.7 | 25.3 | 27.9 |
| Epic | **34.2** | 35.0 | 32.8 | 32.2 | 34.8 | 36.3 |
| Legendary | **59.4** | 68.7 | 57.3 | 69.0 | 49.3 | 52.7 |
| Mythic | **66.3** | 54.0 | 48.2 | 70.1 | 74.6 | 84.4 |

✓ Nadirlik arttıkça güç artıyor.

### Element destelerinde dizilimin etkisi

Her element için yalnızca o elementin kartlarından deste kuran bot (havasız, Gezgin), sonra o desteyle günler oynanır. GDD hedefi: usta/acemi **x1,25–1,50**.

| Deste | Usta/Acemi | Usta/Rastgele | Gün geliri (usta) | Gün süresi | Destenin çekirdeği |
|---|---:|---:|---:|---:|---|
| Ateş | ✗ x1.16 | x1.16 | 888 | 4.8 dk | Anka Kuşu ×3, Magma Titanı ×3, Kor Ejderi ×3, Lav Semenderi ×3, Buhar Kaplumbağası ×3, Volkan Kaplumbağası ×3 |
| Su | ✗ x1.09 | x1.12 | 790 | 5.2 dk | Leviathan Yavrusu ×3, Yaşlı Gelgit Kaplumbağası ×3, Sis Kraliçesi ×3, Gelgit Yılanı ×3, Sis Hayaleti ×3, Yağmur Kuşu ×3 |
| Toprak | ✗ x1.06 | x1.08 | 876 | 5.1 dk | Kadim Ağaç ×3, Yosun Devi ×3, Granit Golem ×3, Dağ Kaplumbağası ×3, Yaşlı Meşe ×3, Kil Golemi ×3 |
| Rüzgar | ✗ x1.07 | x1.11 | 814 | 4.7 dk | Bilge Baykuş ×3, Kum Fırtınası Kartalı ×3, Şimşek Atmacası ×3, Grifon Yavrusu ×3, Yağmur Kuşu ×3, Ateş Atmacası ×3 |
| Elektrik | ✗ x1.20 | x1.26 | 924 | 4.8 dk | İletken Yengeç ×3, Plazma Yılanı ×3, Gök Gürültüsü Ejderi ×3, Kor Şimşek Ejderi ×3, Kondansatör Golemi ×3, Akım Gelinciği ×3 |

### Hava uyumu (tüm set koleksiyonuyla)

Her hava için o havaya kurulmuş deste ile en uygunsuz deste karşılaştırılır. GDD hedefi: **x1,30–1,50**.

| Hava | Uygun deste | En uygunsuz deste | Oran |
|---|---:|---:|---:|
| Güneşli | 1379.8 | 1088.8 (Rüzgarlı destesi) | x1.27 |
| Yağmurlu | 1478.2 | 1288.6 (Sarsıntılı destesi) | x1.15 |
| Fırtınalı | 1361.6 | 1094.7 (Sarsıntılı destesi) | x1.24 |
| Rüzgarlı | 1391.0 | 1272.0 (Sarsıntılı destesi) | x1.09 |
| Sarsıntılı | 1353.3 | 1214.5 (Rüzgarlı destesi) | x1.11 |
| Sisli | 1323.5 | 1130.8 (Rüzgarlı destesi) | x1.17 |
| Kuraklık | 1223.3 | 1064.8 (Sarsıntılı destesi) | x1.15 |

✗ Ortalama x1.17

### En güçlü 20 sinerji

| Çift | Elementler | Fazladan gelir / tur |
|---|---|---:|
| Kraken + Dört Rüzgar Ruhu | Su / Rüzgar | +53.4 |
| Sürü Annesi ×2 | Ateş | +33.3 |
| Kraken + Deniz Ejderi | Su / Su | +30.5 |
| Yosun Muhafızı + Dünya Ağacı | Su / Toprak | +28.8 |
| Dünya Ağacı + Toprak Ana | Toprak / Toprak | +28.2 |
| Fırtına Golemi + Tufan Ejderi | Elektrik / Elektrik | +26.5 |
| Kızıl Kurt + Kraken | Ateş / Su | +25.9 |
| Kraken + Bulut Ejderi | Su / Rüzgar | +25.5 |
| Fırtına Golemi ×2 | Elektrik | +25.5 |
| İletken Yengeç + Fırtına Golemi | Elektrik / Elektrik | +25.3 |
| Ayna Denizanası + Dört Rüzgar Ruhu | Su / Rüzgar | +25.1 |
| Girdap Ahtapotu + Dört Rüzgar Ruhu | Su / Rüzgar | +24.1 |
| Kraken + Grifon Yavrusu | Su / Rüzgar | +23.5 |
| Kraken + Hortum Ejderi | Su / Rüzgar | +22.9 |
| Kondansatör Golemi ×2 | Elektrik | +22.2 |
| Kraken + Zümrüdüanka | Su / Rüzgar | +21.6 |
| Kraken + Fırtına Golemi | Su / Elektrik | +21.0 |
| Statik Tavşan + Fırtına Golemi | Elektrik / Elektrik | +20.6 |
| Ayna Denizanası + Hortum Ejderi | Su / Rüzgar | +20.5 |
| Kıvılcım Tilkisi + Ebedi Alev | Ateş / Ateş | +20.4 |

### Dikkat edilecekler

**Nadirliğine göre aykırı güç:**

- ▲ **İletken Yengeç** (Epic, Elektrik) — değer 41.6, z 2.30
- ▲ **Grifon Yavrusu** (Rare, Rüzgar) — değer 36.7, z 2.27
- ▲ **Ocak Golemi** (Uncommon, Ateş) — değer 33.4, z 2.08
- ▲ **Alev Zambağı** (Uncommon, Ateş) — değer 33.2, z 2.05
- ▲ **Kızıl Kurt** (Rare, Ateş) — değer 34.5, z 1.80
- ▲ **Güneş Ejderi** (Legendary, Ateş) — değer 76.7, z 1.71
- ▲ **Kondansatör Golemi** (Uncommon, Elektrik) — değer 31.1, z 1.64
- ▲ **Şimşek Koçu** (Uncommon, Elektrik) — değer 31.0, z 1.63
- ▲ **Bulut Ejderi** (Epic, Rüzgar) — değer 39.4, z 1.61
- ▲ **Alev Tazısı** (Uncommon, Ateş) — değer 30.7, z 1.57
- ▲ **Fırtına Salyangozu** (Common, Elektrik) — değer 25.4, z 1.56
- ▼ **Dalga Yunusu** (Uncommon, Su) — değer 14.8, z -1.52
- ▼ **Kabarcık Balığı** (Common, Su) — değer 12.3, z -1.53
- ▼ **Ateş Atmacası** (Rare, Rüzgar+Ateş) — değer 18.5, z -1.54
- ▼ **Sis Kraliçesi** (Epic, Su) — değer 29.2, z -1.56
- ▼ **Çarpan Böcek** (Common, Elektrik) — değer 12.0, z -1.59
- ▼ **Hortum Ejderi** (Legendary, Rüzgar) — değer 42.9, z -1.62
- ▼ **Derin Fener Balığı** (Rare, Su) — değer 16.6, z -1.94
- ▼ **Sarsıntı Köstebeği** (Rare, Toprak) — değer 16.0, z -2.05
- ▼ **Fırtına Güvesi** (Common, Rüzgar) — değer 9.0, z -2.30

## Kartlar

### Ateş (25)

Kimlik: Isı (üret ve harca), Ateş zinciri (komşu Ateş), saf deste, Patlama (son tetik), Ejder ve Sürü.

| Kart | Nadirlik | Tip | Dyn | Yetenek | Karışık | Element | z | Sinerji ortakları |
|---|---|---|---:|---|---:|---:|---:|---|
| **Kıvılcım Tilkisi** | Common | beast | 2 | Harvest: +4. Sağındaki kart Dragon ise x2,5. | 17.5 | 23.4 | 1.1 | Ebedi Alev +20.4, Deniz Ejderi +14.7, Kor Ejderi +13.8, Yavru Ejder +13.0 · ✗ Kıvılcım Tilkisi -8.2, Kraken -5.5 |
| **Köz Kirpisi** | Common | beast | 2 | Harvest: masaya +1 Isı. +2 ve masadaki Isı kadar +1. | 13.7 | 21.5 | 0.6 | Ebedi Alev +9.6, Volkan Kaplumbağası +7.9, Volkan Yılanı +7.2, Toprak Ana +5.8 · ✗ Magma Yavrusu -6.7, Kraken -6.4 |
| **Alev Sürüsü** | Common | swarm | 1 | Harvest: +2 ve solundaki ardışık her Ateş kartı için +3 (Alev Zinciri). | 9.8 | 22.1 | 0.8 | Sürü Annesi +11.3, Alev Zambağı +7.5, Taş Dev +6.1, Volkan Yılanı +5.7 · ✗ Fırtına Golemi -5.8, Bobin Kaplumbağası -5.3 |
| **Yavru Ejder** | Common | dragon | 2 | Harvest: masaya +1 Isı. +3 ve masadaki her başka Dragon için +2. | 12.8 | 21.4 | 0.6 | Kıvılcım Tilkisi +13.0, Ebedi Alev +11.8, Kanatlı Ejder +10.5, Kor Ejderi +10.0 · ✗ Fırtına Golemi -9.6, Kızıl Kurt -6.3 |
| **Kor Böceği** | Common | swarm | 1 | Harvest: +4 ve masadaki her başka Swarm için +3. | 11.1 | 14.9 | -0.9 | Sürü Annesi +15.7, Volkan Yılanı +9.5, Fırtına Güvesi +7.7, Kaya Böceği +7.5 · ✗ Ayna Denizanası -6.0, Dört Rüzgar Ruhu -5.4 |
| **Meşale Kertenkelesi** | Common | beast | 3 | Harvest: +3. En soldaysa x2. | 22.1 | 24.0 | 1.2 | Volkan Yılanı +7.9, Güneş Ejderi +6.9, Girdap Ahtapotu +6.2, Kraken +6.2 · ✗ Fırtına Kartalı -12.0, Kasırga Kartalı -10.8 |
| **Kül Kargası** | Common | avian | 2 | Harvest: +3. Last Breath: sağındaki kartı bir kez daha tetikler. | 18.2 | 23.5 | 1.1 | Zümrüdüanka +17.8, Hortum Ejderi +11.2, Volkan Yılanı +5.4, Dört Rüzgar Ruhu +5.0 · ✗ Tufan Ejderi -6.3, Kül Kargası -4.9 |
| **Magma Yavrusu** | Common | golem | 2 | Harvest: +5. | 15.6 | 16.8 | -0.5 | Kristal Golem +10.6, Granit Golem +6.9, Volkan Yılanı +6.0, Alev Zambağı +5.8 · ✗ Köz Kirpisi -6.7, Tufan Ejderi -5.8 |
| **Alev Tazısı** | Uncommon | beast | 2 | Harvest: +3 ve sağındaki her Ateş kartı için +2. | 15.3 | 30.7 | ▲ 1.6 | Volkan Yılanı +9.8, Kızıl Kurt +8.5, Ocak Golemi +7.7, Güneş Ejderi +7.2 · ✗ Tufan Ejderi -5.9, Fırtına Golemi -5.5 |
| **Alev Zambağı** | Uncommon | flora | 2 | Slumber 2. Harvest: +2 ve sağındaki her Ateş kartı için +3. | 12.1 | 33.2 | ▲ 2.1 | Volkan Yılanı +16.3, Ocak Golemi +9.6, Kor Ejderi +8.2, Magma Titanı +7.8 · ✗ Dört Rüzgar Ruhu -6.3, Tufan Ejderi -5.1 |
| **Alev Ruhu** | Uncommon | ghost | 1 | Harvest: +3. Haunt: masaya +1 Isı ve +2. | 17.4 | 20.9 | -0.3 | Volkan Yılanı +7.0, Taş Golemi +5.7, Volkan Kaplumbağası +5.5, Çamur Kaplumbağası +5.2 · ✗ Ateş Atmacası -6.0, Tufan Ejderi -5.7 |
| **Ocak Golemi** | Uncommon | golem | 3 | Heavy. Harvest: +2 ve solundaki ardışık her Ateş kartı için +2 (Alev Zinciri). | 15.1 | 33.4 | ▲ 2.1 | Alev Zambağı +9.6, Volkan Yılanı +8.3, Ebedi Alev +8.1, Kristal Golem +8.0 · ✗ Kraken -7.3, Ayna Denizanası -6.8 |
| **Kanatlı Ejder** | Uncommon | dragon | 2 | Harvest: +4. Solundaki kart Dragon ise x2. | 15.0 | 20.5 | -0.4 | Ebedi Alev +12.1, Kıvılcım Tilkisi +10.7, Yavru Ejder +10.5, Deniz Ejderi +8.2 · ✗ Kızıl Kurt -7.5, Fırtına Golemi -6.1 |
| **Anka Yavrusu** | Uncommon | avian | 1 | Rebirth. Harvest: +4. Last Breath: masaya +1 Isı. | 13.9 | 15.8 | -1.3 | Volkan Yılanı +9.0, Dağ Kaplumbağası +5.5, Zümrüdüanka +5.4, Magma Titanı +4.3 · ✗ Fırtına Golemi -7.4, Tufan Ejderi -5.4 |
| **Lav Semenderi** | Rare | serpent | 3 | Harvest: +3. Son tetikte x6, önceki tetiklerde x0,5. | 26.3 | 28.3 | 0.5 | Kraken +14.9, Volkan Yılanı +5.9, Alev Zambağı +5.0, Dünya Ağacı +4.2 · ✗ Dört Rüzgar Ruhu -8.6, Kor Şimşek Ejderi -5.5 |
| **Kor Ejderi** | Rare | dragon | 3 | Overload. Harvest: +5 ve solundaki ardışık her Ateş kartı için +2 (Alev Zinciri). | 19.6 | 32.5 | 1.4 | Kıvılcım Tilkisi +13.8, Yavru Ejder +10.0, Alev Zambağı +8.2, Volkan Yılanı +7.5 · ✗ Bulut Ejderi -6.8, Tohum İspinozu -6.2 |
| **Sürü Annesi** | Rare | swarm | 3 | Aura: diğer Swarm kartları Harvest'te +3. Harvest: +3 ve masadaki her başka Swarm için +2. | 16.5 | 25.6 | -0.0 | Sürü Annesi +33.3, Fırtına Güvesi +17.6, Kor Böceği +15.7, Kaya Böceği +12.8 · ✗ Fırtına Golemi -5.2, Tufan Ejderi -4.9 |
| **Buhar Kaplumbağası** (Ateş+Su) | Rare | beast | 3 | Harvest: +3 ve masadaki Isı kadar +1. Tek geçişlerde x1,5. | 20.8 | 22.5 | -0.7 | Bulut Ejderi +10.0, Volkan Yılanı +7.6, Kızıl Kurt +7.1, Ocak Golemi +6.3 · ✗ Ay Balinası -6.5, Bobin Kaplumbağası -5.5 |
| **Kızıl Kurt** | Rare | beast | 3 | Harvest: +4. Her Beast komşusu için +4. | 34.5 | 31.3 | ▲ 1.8 | Kraken +25.9, Ayna Denizanası +16.5, Mercan Kaplumbağası +14.7, Mercan Yengeci +13.5 · ✗ Kor Şimşek Ejderi -11.1, Elektrikli Yılanbalığı -9.6 |
| **Kor Şimşek Ejderi** (Ateş+Elektrik) | Epic | dragon | 2 | Harvest: masaya +1 Isı. +4 ve masadaki Isı kadar +1. Sağ bağlantı uyumluysa x1,5. | 26.2 | 31.7 | -0.8 | Tufan Ejderi +15.0, Kondansatör Golemi +11.9, Şimşek Koçu +10.7, Ebedi Alev +8.6 · ✗ Kızıl Kurt -11.1, Akım Gelinciği -7.5 |
| **Magma Titanı** | Epic | golem | 4 | Heavy. Harvest: +4. Epilogue: solundaki her Ateş kartı için +4. | 23.1 | 35.4 | 0.4 | Granit Golem +8.4, Kristal Golem +8.1, Volkan Yılanı +7.9, Alev Zambağı +7.8 · ✗ Toprak Ana -8.5, Mıknatıs Golemi -6.9 |
| **Anka Kuşu** | Epic | avian | 2 | Rebirth. Harvest: +5. Last Breath: solundaki ve sağındaki kartı bir kez daha tetikler. | 33.3 | 38.1 | 1.2 | Zümrüdüanka +15.9, Kraken +10.2, Hortum Ejderi +10.0, Volkan Yılanı +9.3 · ✗ Yosun Muhafızı -6.1, Yıldırım Kurdu -5.0 |
| **Güneş Ejderi** | Legendary | dragon | 3 | Overload. Harvest: +10. Dizilen tüm kartlar Ateş ise x3. | 27.9 | 76.7 | ▲ 1.7 | Ayna Denizanası +11.2, Mercan Kaplumbağası +9.4, Volkan Yılanı +8.7, Kraken +8.0 · ✗ Kızıl Kurt -8.9, Zümrüdüanka -6.7 |
| **Volkan Yılanı** | Legendary | serpent | 3 | Harvest: masaya +1 Isı. +3 ve solundaki ardışık her Ateş kartı için +2. Son tetikte x3. | 28.8 | 60.7 | 0.1 | Ebedi Alev +17.9, Alev Zambağı +16.3, Volkan Kaplumbağası +16.3, Alev Tazısı +9.8 · ✗ Yıldırım Ruhu -6.6, Dinamo Hamsteri -6.3 |
| **Ebedi Alev** | Mythic | dragon | 3 | Howl: diğer tüm Ateş kartlarına +1 dayanıklılık. Harvest: +5 ve masadaki Isı kadar +1. | 26.7 | 54.0 | -0.9 | Kıvılcım Tilkisi +20.4, Volkan Yılanı +17.9, Kanatlı Ejder +12.1, Yavru Ejder +11.8 · ✗ Taş Dev -7.3, Mıknatıs Golemi -5.8 |

### Su (25)

Kimlik: Gelgit (tek/çift geçiş), Kopya (komşunun geliri), dayanıklılık desteği, Rebirth / Last Breath, Ghost.

| Kart | Nadirlik | Tip | Dyn | Yetenek | Karışık | Element | z | Sinerji ortakları |
|---|---|---|---:|---|---:|---:|---:|---|
| **Mercan Kaplumbağası** | Common | beast | 2 | Harvest: +2 ve soldaki kartın bu geçişteki gelirinin tamamı. | 24.9 | 22.3 | 1.4 | Dört Rüzgar Ruhu +20.1, Kızıl Kurt +14.7, Kasırga Kartalı +14.0, Hortum Ejderi +13.6 · ✗ Kraken -9.9, Nehir Yılanbalığı -8.3 |
| **Damla Kurbağası** | Common | beast | 3 | Harvest: +3. Tek geçişlerde x2, çift geçişlerde x0,5. | 17.3 | 18.1 | -0.2 | Kızıl Kurt +6.6, Kraken +4.8, Mantar Kurbağası +3.4, Kil Golemi +3.3 · ✗ Fırtına Golemi -5.2, Elektrikli Yılanbalığı -4.8 |
| **Mercan Yengeci** | Common | beast | 2 | Howl: sağındaki kartın dayanıklılığını +1 yapar. Harvest: +3. | 16.6 | 14.8 | -0.5 | Kızıl Kurt +13.5, Dünya Ağacı +10.7, Taş Dev +8.2, Yaşlı Meşe +5.5 · ✗ Ayna Denizanası -5.3, Girdap Ahtapotu -5.0 |
| **Kabarcık Balığı** | Common | beast | 1 | Harvest: +4. Last Breath: +3. | 12.3 | 10.9 | ▼ -1.5 | Kızıl Kurt +7.1, Taş Dev +6.3, Taş Golemi +5.1, Çamur Kaplumbağası +4.4 · ✗ Kraken -7.3, Tufan Ejderi -5.8 |
| **Gelgit Su Samuru** | Common | beast | 2 | Harvest: +2. Tek geçişlerde x3. | 11.9 | 13.2 | -1.3 | Kızıl Kurt +7.0, Bilge Baykuş +3.9, Yaşlı Gelgit Kaplumbağası +3.8, Diken Çalısı +3.1 · ✗ Kraken -10.3, İletken Yengeç -3.4 |
| **Resif Foku** | Common | beast | 2 | Harvest: +2 ve masadaki her başka Su kartı için +1. | 10.2 | 20.1 | 0.3 | Resif Foku +5.0, Kızıl Kurt +5.0, Yaşlı Gelgit Kaplumbağası +3.7, Sis Hayaleti +3.5 · ✗ Fırtına Golemi -7.2, Güneş Ejderi -5.0 |
| **Sis Perisi** | Common | ghost | 1 | Harvest: +2. Haunt: başka bir kart pasife geçtiğinde +2. | 14.4 | 13.7 | -1.0 | Taş Dev +7.2, Taş Golemi +6.5, Diken Çalısı +4.8, Mıknatıs Golemi +4.4 · ✗ Kraken -10.1, Kor Şimşek Ejderi -4.8 |
| **Nehir Yılanbalığı** | Common | serpent | 2 | Heavy. Harvest: +1 ve sağındaki kartın bu geçişteki gelirinin tamamı. | 19.2 | 16.8 | 0.1 | Dört Rüzgar Ruhu +19.6, Deniz Ejderi +15.8, Hortum Ejderi +14.0, Karahindiba Tavşanı +7.5 · ✗ Kraken -12.1, Nehir Yılanbalığı -10.0 |
| **Girdap Ahtapotu** | Uncommon | beast | 2 | Heavy. Harvest: +1, solundaki ve sağındaki kartın bu geçişteki gelirinin %75'i. | 23.4 | 21.0 | 0.2 | Dört Rüzgar Ruhu +24.1, Hortum Ejderi +20.1, Kasırga Kartalı +13.4, Kızıl Kurt +12.2 · ✗ Kraken -15.0, Girdap Ahtapotu -11.3 |
| **İnci Denizatı** | Uncommon | serpent | 1 | Rebirth. Harvest: +4. Last Breath: +6. | 17.0 | 19.4 | -0.6 | Yaşlı Gelgit Kaplumbağası +2.8, Dağ Kaplumbağası +2.8, Leviathan Yavrusu +2.7, Taş Dev +2.5 · ✗ Nehir Yılanbalığı -4.8, Yağmur Kuşu -3.4 |
| **Dalga Yunusu** | Uncommon | beast | 2 | Swift. Harvest: +3. Tek geçişlerde x2. | 13.5 | 14.8 | ▼ -1.5 | Kızıl Kurt +9.5, Bora Tazısı +5.2, Diken Topu +4.8, Kök Bekçisi +4.6 · ✗ Fırtına Golemi -7.3, Kraken -6.0 |
| **Yosun Muhafızı** | Uncommon | flora | 3 | Howl: sağındaki kartın dayanıklılığını +2 yapar. Harvest: +2. | 24.2 | 18.9 | 0.3 | Dünya Ağacı +28.8, Dört Rüzgar Ruhu +14.3, Yaşlı Meşe +12.9, Taş Dev +8.7 · ✗ Yosun Muhafızı -8.6, Girdap Ahtapotu -7.5 |
| **Sis Hayaleti** | Uncommon | ghost | 2 | Harvest: +3. Haunt: başka bir kart pasife geçtiğinde +3. | 22.2 | 22.4 | -0.0 | Sis Kraliçesi +3.9, Sarsıntı Köstebeği +3.8, Resif Foku +3.5, Kor Ejderi +3.3 · ✗ Fırtına Golemi -5.1, Tufan Ejderi -4.3 |
| **Gelgit Çağıran** | Uncommon | serpent | 2 | Harvest: +3. Last Breath: solundaki kartı bir kez daha tetikler. | 17.8 | 14.9 | -0.9 | Hortum Ejderi +8.6, Bulut Ejderi +5.8, Taş Dev +5.5, Kum Fırtınası Kartalı +5.2 · ✗ Elektrikli Yılanbalığı -7.8, Gelgit Çağıran -4.0 |
| **Ayna Denizanası** | Rare | beast | 2 | Heavy. Harvest: solundaki ve sağındaki kartın bu geçişteki gelirinin tamamı. | 26.6 | 22.7 | 0.2 | Dört Rüzgar Ruhu +25.1, Hortum Ejderi +20.5, Deniz Ejderi +18.6, Kızıl Kurt +16.5 · ✗ Ayna Denizanası -15.3, Kraken -12.4 |
| **Çamur Kaplumbağası** (Su+Toprak) | Rare | beast | 3 | Heavy. Harvest: +2 ve masadaki her pasif kart için +1. Tek geçişlerde x1,5. | 21.6 | 20.4 | -0.9 | Kızıl Kurt +6.1, Fırtına Güvesi +5.8, Hortum Ejderi +5.6, Gök Yılanı +5.5 · ✗ Diken Çalısı -6.8, Volkan Kaplumbağası -5.3 |
| **Yağmur Kuşu** (Su+Rüzgar) | Rare | avian | 2 | Swift. Harvest: +2 ve masadaki her farklı element için +1. Tek geçişlerde x2. | 24.9 | 20.7 | -0.2 | Yaşlı Gelgit Kaplumbağası +9.2, Toprak Ana +8.0, Kök Bekçisi +7.4, Zümrüdüanka +6.7 · ✗ Yağmur Kuşu -8.2, Kızıl Kurt -6.6 |
| **Derin Fener Balığı** | Rare | serpent | 2 | Harvest: +3. Last Breath: masadaki her pasif kart için +2. | 16.6 | 15.7 | ▼ -1.9 | Demir Kaplumbağa +3.8, Alev Tazısı +3.7, Mantar Kurbağası +3.4, Anka Yavrusu +3.0 · ✗ Tufan Ejderi -8.8, Kraken -6.1 |
| **Gelgit Yılanı** | Rare | serpent | 3 | Harvest: +3. Tek geçişlerde x2. Last Breath: +4. | 22.4 | 23.8 | -0.4 | Kraken +5.6, Mantar Kurbağası +3.4, Bulut Ejderi +3.4, Girdap Ahtapotu +2.7 · ✗ İletken Yengeç -4.5, Fırtına Golemi -4.5 |
| **Leviathan Yavrusu** | Epic | serpent | 3 | Rebirth. Harvest: +5. Last Breath: +8. | 31.5 | 34.5 | 0.1 | Kraken +4.6, Yaşlı Gelgit Kaplumbağası +4.0, Rüzgar Tilkisi +3.5, Resif Foku +3.4 · ✗ Tufan Ejderi -6.9, Taş Dev -6.0 |
| **Sis Kraliçesi** | Epic | ghost | 3 | Aura: diğer Ghost kartları Harvest'te +2. Harvest: +3. Haunt: +3. | 25.5 | 29.2 | ▼ -1.6 | Sis Kraliçesi +12.3, Dört Rüzgar Ruhu +8.3, Girdap Ruhu +5.7, Sis Hayaleti +3.9 · ✗ Toprak Ana -4.8, Kraken -4.3 |
| **Yaşlı Gelgit Kaplumbağası** | Epic | beast | 4 | Howl: diğer tüm Su kartlarına +1 dayanıklılık. Harvest: +3. | 18.9 | 34.7 | 0.1 | Yağmur Kuşu +9.2, Kraken +6.9, Elektrikli Yılanbalığı +5.9, Yaşlı Gelgit Kaplumbağası +5.3 · ✗ Dört Rüzgar Ruhu -7.4, Taş Dev -7.2 |
| **Kraken** | Legendary | beast | 3 | Heavy. Harvest: +3, solundaki ve sağındaki kartın bu geçişteki gelirinin %125'i. | 53.6 | 51.0 | -0.6 | Dört Rüzgar Ruhu +53.4, Deniz Ejderi +30.5, Kızıl Kurt +25.9, Bulut Ejderi +25.5 · ✗ Girdap Ahtapotu -15.0, Ayna Denizanası -12.4 |
| **Deniz Ejderi** | Legendary | dragon | 3 | Harvest: +6. Tek geçişlerde x2. Last Breath: solundaki ve sağındaki kartı bir kez daha tetikler. | 51.9 | 61.0 | 0.2 | Kraken +30.5, Ayna Denizanası +18.6, Nehir Yılanbalığı +15.8, Kıvılcım Tilkisi +14.7 · ✗ İletken Yengeç -5.6, Tufan Ejderi -5.4 |
| **Ay Balinası** | Mythic | beast | 3 | Howl: diğer tüm kartlara +1 dayanıklılık. Harvest: +4. Tek geçişlerde x2. | 45.7 | 48.2 | -1.4 | Dünya Ağacı +18.3, Kraken +14.3, Kızıl Kurt +13.0, Ayna Denizanası +10.5 · ✗ Buhar Kaplumbağası -6.5, Fırtına Salyangozu -5.6 |

### Toprak (25)

Kimlik: Humus (pasif kart sayısı), Heavy, "solundaki pasifse", kök desteği (Howl), Büyüme, Golem ve Flora.

| Kart | Nadirlik | Tip | Dyn | Yetenek | Karışık | Element | z | Sinerji ortakları |
|---|---|---|---:|---|---:|---:|---:|---|
| **Taş Golemi** | Common | golem | 3 | Harvest: +2. Solundaki kart pasifse +5. | 22.6 | 23.7 | 1.2 | Granit Golem +9.2, Tohum İspinozu +7.6, Sis Perisi +6.5, Kök Bekçisi +5.9 · ✗ Taş Golemi -10.6, Güneş Ejderi -6.1 |
| **Kök Bekçisi** | Common | flora | 1 | Howl: solundaki ve sağındaki kartlara +1 dayanıklılık. Harvest: +1. | 16.4 | 22.7 | 0.9 | Yaşlı Meşe +8.1, Dünya Ağacı +8.0, Yağmur Kuşu +7.4, Fırtına Kartalı +6.6 · ✗ Tohum İspinozu -10.7, Kök Bekçisi -6.9 |
| **Çakıl Köstebeği** | Common | beast | 2 | Harvest: +2 ve masadaki her pasif kart için +1. | 10.7 | 13.4 | -1.3 | Kızıl Kurt +7.0, Hortum Ruhu +3.8, Fırtına Güvesi +3.4, Gök Yılanı +2.6 · ✗ Toprak Ana -10.8, Kondansatör Golemi -4.8 |
| **Filiz** | Common | flora | 3 | Harvest: +1 ve bu turdaki her önceki tetiği için +2. | 12.6 | 16.0 | -0.7 | Bulut Ejderi +8.4, Yosun Muhafızı +5.0, Toprak Ana +4.4, Dört Rüzgar Ruhu +3.6 · ✗ Ebedi Alev -4.3, Ayna Denizanası -4.2 |
| **Kil Golemi** | Common | golem | 2 | Harvest: +4 ve masadaki her başka Golem için +1. | 14.8 | 20.8 | 0.5 | Kristal Golem +11.3, Granit Golem +9.7, Gök Yılanı +4.8, Ayna Denizanası +4.0 · ✗ Kanatlı Ejder -4.4, Fırtına Salyangozu -4.4 |
| **Mantar Kurbağası** | Common | flora | 1 | Harvest: +3. Last Breath: masadaki her pasif kart için +1. | 9.3 | 16.1 | -0.6 | Taş Dev +5.5, Dağ Kaplumbağası +4.3, Taş Golemi +3.9, Kaya Kertenkelesi +3.5 · ✗ Elektrikli Yılanbalığı -3.2, Gök Gürültüsü Ejderi -3.2 |
| **Yuva Porsuğu** | Common | beast | 3 | Heavy. Harvest: +2. Solundaki kart pasifse +5. | 20.9 | 21.2 | 0.6 | Rüzgar Tilkisi +6.0, Kök Bekçisi +5.3, Hortum Ruhu +4.9, Kaya Böceği +4.9 · ✗ Kum Fırtınası Kartalı -6.2, Yuva Porsuğu -5.8 |
| **Kaya Böceği** | Common | swarm | 1 | Harvest: +3 ve masadaki her başka Swarm için +3. | 8.3 | 14.7 | -1.0 | Sürü Annesi +12.8, Kor Böceği +7.5, Kaya Böceği +7.1, Fırtına Güvesi +6.7 · ✗ Kızıl Kurt -6.9, Kraken -6.4 |
| **Kaya Kertenkelesi** | Uncommon | beast | 3 | Heavy. Harvest: +1 ve masadaki her pasif kart için +2. | 19.7 | 17.0 | -0.6 | Kızıl Kurt +7.4, Hortum Ruhu +6.8, Kaya Böceği +5.0, Kök Bekçisi +4.5 · ✗ Diken Çalısı -8.3, Toprak Ana -7.5 |
| **Diken Çalısı** | Uncommon | flora | 3 | Slumber 2. Harvest: +2 ve masadaki her pasif kart için +2. | 28.2 | 22.4 | 1.1 | Mercan Yengeci +5.0, Sis Perisi +4.8, Gelgit Çağıran +4.7, Sarmaşık Yılanı +4.3 · ✗ Toprak Ana -10.8, Taş Dev -9.0 |
| **Demir Kaplumbağa** | Uncommon | beast | 3 | Ward. Harvest: +4. | 18.9 | 19.9 | -0.5 | Kızıl Kurt +5.9, Rüzgar Tilkisi +5.0, Bulut Ejderi +3.9, Derin Fener Balığı +3.8 · ✗ Taş Dev -6.2, Toprak Ana -5.3 |
| **Kristal Golem** | Uncommon | golem | 3 | Harvest: +3. Komşularından biri Golem ise x2. | 15.8 | 24.4 | 0.4 | Kristal Golem +14.9, Granit Golem +12.9, Kil Golemi +11.3, Magma Yavrusu +10.6 · ✗ Toprak Ana -7.1, Tufan Ejderi -5.2 |
| **Sarmaşık Yılanı** | Uncommon | serpent | 2 | Harvest: +3. Last Breath: sağındaki kartın dayanıklılığını +1 yapar. | 17.4 | 20.9 | -0.3 | Dünya Ağacı +10.2, Hortum Ejderi +7.0, Taş Dev +5.2, Bulut Baykuşu +5.0 · ✗ Tufan Ejderi -5.0, Magma Titanı -4.9 |
| **Tohum İspinozu** | Uncommon | avian | 1 | Harvest: +2. Last Breath: solundaki ve sağındaki kartlara +1 dayanıklılık. | 20.1 | 26.4 | 0.7 | Zümrüdüanka +14.5, Dünya Ağacı +12.5, Taş Golemi +7.6, Taş Dev +6.2 · ✗ Kök Bekçisi -10.7, Girdap Ahtapotu -6.6 |
| **Yosun Devi** | Rare | golem | 4 | Heavy. Harvest: +3. Epilogue: masadaki her pasif kart için +2. | 25.1 | 27.7 | 0.4 | Granit Golem +8.8, Kristal Golem +5.7, Sürü Annesi +4.1, Alev Zambağı +3.5 · ✗ Kum Fırtınası Kartalı -7.3, Fırtına Golemi -6.5 |
| **Volkan Kaplumbağası** (Toprak+Ateş) | Rare | beast | 4 | Heavy. Harvest: +2, masadaki Isı kadar +1 ve her pasif kart için +1. | 24.6 | 27.8 | 0.4 | Volkan Yılanı +16.3, Rüzgar Tilkisi +11.4, Yavru Ejder +8.6, Ateş Atmacası +8.3 · ✗ Toprak Ana -8.8, Diken Çalısı -7.8 |
| **Yaşlı Meşe** | Rare | flora | 4 | Slumber 2. Harvest: +2 ve bu turdaki her önceki tetiği için +2. | 24.8 | 26.1 | 0.1 | Yosun Muhafızı +12.9, Toprak Ana +8.3, Kök Bekçisi +8.1, Kadim Ağaç +6.0 · ✗ Taş Dev -9.5, Volkan Kaplumbağası -5.9 |
| **Granit Golem** | Rare | golem | 4 | Heavy. Harvest: +3 ve masadaki her başka Golem için +2. | 19.2 | 25.7 | -0.0 | Granit Golem +15.5, Kristal Golem +12.9, Kil Golemi +9.7, Taş Golemi +9.2 · ✗ Toprak Ana -7.1, Kraken -6.1 |
| **Sarsıntı Köstebeği** | Rare | beast | 2 | Harvest: +2. Last Breath: masadaki her pasif kart için +2. | 14.3 | 16.0 | ▼ -2.1 | Sis Hayaleti +3.8, Kızıl Kurt +3.2, Meltem Serçesi +3.0, Kasırga Gelinciği +2.8 · ✗ Kraken -9.2, Dört Rüzgar Ruhu -4.9 |
| **Kum Fırtınası Kartalı** (Toprak+Rüzgar) | Epic | avian | 3 | Swift. Harvest: +3, masadaki her pasif kart ve her farklı element için +1. | 30.4 | 26.2 | -1.2 | Kraken +12.8, Ayna Denizanası +10.2, Girdap Ahtapotu +7.9, Yosun Muhafızı +7.8 · ✗ Yosun Devi -7.3, Yuva Porsuğu -6.2 |
| **Kadim Ağaç** | Epic | flora | 4 | Aura: diğer Toprak kartları Harvest'te +1. Harvest: +4. | 21.5 | 33.3 | -0.3 | Yaşlı Meşe +6.0, Kadim Ağaç +5.8, Dünya Ağacı +5.5, Dağ Kaplumbağası +4.3 · ✗ Zümrüdüanka -5.0, Kıvılcım Tilkisi -4.5 |
| **Dağ Kaplumbağası** | Epic | beast | 4 | Ward. Heavy. Harvest: +3 ve masadaki her pasif kart için +1. | 32.9 | 29.7 | -0.4 | Kızıl Kurt +6.4, Anka Yavrusu +5.5, Magma Yavrusu +5.5, Mantar Kurbağası +4.3 · ✗ Taş Dev -11.3, Toprak Ana -9.0 |
| **Dünya Ağacı** | Legendary | flora | 5 | Slumber 2. Aura: diğer tüm kartlar Harvest'te +1. Harvest: +3 ve bu turdaki her önceki tetiği için +3. | 63.4 | 69.1 | 1.0 | Yosun Muhafızı +28.8, Toprak Ana +28.2, Ay Balinası +18.3, Gök Balinası Yavrusu +13.2 · ✗ Taş Dev -8.2, Fırtına Golemi -6.8 |
| **Taş Dev** | Legendary | golem | 5 | Heavy. Harvest: +2 ve masadaki her pasif kart için +3. Epilogue: her pasif kart için +2. | 68.8 | 63.3 | 0.9 | Yosun Muhafızı +8.7, Mercan Yengeci +8.2, Sis Perisi +7.2, Kabarcık Balığı +6.3 · ✗ Taş Dev -20.2, Dağ Kaplumbağası -11.3 |
| **Toprak Ana** | Mythic | beast | 6 | Howl: solundaki ve sağındaki kartlara +2 dayanıklılık. Heavy. Harvest: +2 ve masadaki her pasif kart için +2. | 70.1 | 66.4 | 0.3 | Dünya Ağacı +28.2, Dört Rüzgar Ruhu +16.0, Kızıl Kurt +13.4, Hortum Ejderi +11.8 · ✗ Toprak Ana -19.5, Taş Dev -11.2 |

### Rüzgar (25)

Kimlik: Karışım (farklı element), Swift, konum (ilk/son slot), Avian ve Sürü.

| Kart | Nadirlik | Tip | Dyn | Yetenek | Karışık | Element | z | Sinerji ortakları |
|---|---|---|---:|---|---:|---:|---:|---|
| **Bulut Baykuşu** | Common | avian | 2 | Harvest: +5. Masada en az 3 farklı element varsa x1,5. | 20.9 | 13.4 | 0.5 | Toprak Ana +10.1, Ayna Denizanası +7.5, Nehir Yılanbalığı +6.2, Kraken +5.4 · ✗ Tufan Ejderi -9.1, Gök Yılanı -8.4 |
| **Esinti Kedisi** | Common | beast | 2 | Swift. Harvest: +3 ve masadaki her farklı element için +1. | 17.5 | 11.5 | -0.3 | Kızıl Kurt +6.0, Diken Topu +5.3, Mercan Kaplumbağası +4.6, Girdap Ahtapotu +4.0 · ✗ Zümrüdüanka -7.9, Bulut Ejderi -6.4 |
| **Fırtına Güvesi** | Common | swarm | 1 | Swift. Harvest: +4 ve masadaki her başka Swarm için +3. | 9.0 | 7.5 | ▼ -2.3 | Sürü Annesi +17.6, Fırtına Güvesi +9.5, Kor Böceği +7.7, Çarpan Böcek +7.3 · ✗ Dört Rüzgar Ruhu -8.5, Fırtına Golemi -7.5 |
| **Meltem Serçesi** | Common | avian | 2 | Swift. Harvest: +3. İlk slottaysa x2,5. | 18.8 | 16.7 | 0.0 | Bilge Baykuş +11.2, Ayna Denizanası +7.1, Mercan Kaplumbağası +5.0, Gök Balinası Yavrusu +4.8 · ✗ Fırtına Kartalı -10.9, Kasırga Kartalı -9.4 |
| **Rüzgar Tilkisi** | Common | beast | 2 | Harvest: +3. Masada en az 4 farklı element varsa +6. | 15.6 | 6.8 | -0.8 | Volkan Kaplumbağası +11.4, Mıknatıs Golemi +6.3, Ayna Denizanası +6.1, Yuva Porsuğu +6.0 · ✗ Dört Rüzgar Ruhu -12.3, Zümrüdüanka -8.8 |
| **Karahindiba Tavşanı** | Common | flora | 2 | Harvest: +3. En sağdaysa x2,5. | 19.3 | 15.0 | 0.1 | Nehir Yılanbalığı +7.5, Ayna Denizanası +5.8, Yosun Muhafızı +5.5, Toprak Ana +5.4 · ✗ Karahindiba Tavşanı -10.5, Bulut Ejderi -6.7 |
| **Sürü İspinozu** | Common | avian | 2 | Harvest: +3 ve masadaki her başka Avian için +2. | 11.4 | 17.6 | -0.3 | Bilge Baykuş +8.0, Sürü İspinozu +8.0, Anka Kuşu +5.6, Zümrüdüanka +4.8 · ✗ Dört Rüzgar Ruhu -10.1, Bulut Ejderi -8.9 |
| **Hortum Ruhu** | Common | ghost | 1 | Swift. Harvest: +2. Haunt: +2. | 13.6 | 12.7 | -1.2 | Kaya Kertenkelesi +6.8, Bora Tazısı +5.5, Taş Golemi +5.0, Yuva Porsuğu +4.9 · ✗ Dört Rüzgar Ruhu -8.3, Kraken -6.2 |
| **Fırtına Kartalı** | Uncommon | avian | 2 | Swift. Harvest: +4. İlk slottaysa x2,5. | 24.3 | 21.6 | 0.3 | Bilge Baykuş +13.6, Ayna Denizanası +10.6, Mercan Kaplumbağası +9.8, Girdap Ahtapotu +9.4 · ✗ Fırtına Kartalı -13.4, Meşale Kertenkelesi -12.0 |
| **Kasırga Gelinciği** | Uncommon | beast | 2 | Swift. Harvest: +3 ve masadaki her farklı element için +1. | 17.5 | 11.8 | -1.0 | Toprak Ana +7.0, Kızıl Kurt +6.1, Gelgit Çağıran +5.0, Kraken +4.3 · ✗ Dört Rüzgar Ruhu -7.2, Rüzgar Tilkisi -5.5 |
| **Çan Kuşu** | Uncommon | avian | 3 | Harvest: +3. Masada en az 4 farklı element varsa x2. | 17.2 | 12.8 | -1.1 | Volkan Kaplumbağası +6.2, Dünya Ağacı +5.5, Bilge Baykuş +5.5, Magma Yavrusu +5.0 · ✗ Dört Rüzgar Ruhu -11.5, Gök Yılanı -6.8 |
| **Gök Balinası Yavrusu** | Uncommon | beast | 3 | Howl: solundaki kartın dayanıklılığını +1 yapar. Harvest: +3. | 18.7 | 17.6 | -0.8 | Dünya Ağacı +13.2, Kızıl Kurt +8.6, Meltem Serçesi +4.8, Grifon Yavrusu +4.0 · ✗ Elektrikli Yılanbalığı -7.0, Zümrüdüanka -5.7 |
| **Diken Topu** | Uncommon | flora | 2 | Harvest: +3 ve masadaki her başka Swift kart için +2. | 10.7 | 16.5 | -1.2 | Esinti Kedisi +5.3, Dalga Yunusu +4.8, Sürü Annesi +4.6, Meltem Serçesi +4.6 · ✗ Zümrüdüanka -8.2, Fırtına Golemi -4.9 |
| **Bora Tazısı** | Uncommon | beast | 2 | Swift. Harvest: +3 ve masadaki her başka Swift kart için +2. | 10.6 | 18.8 | -0.7 | Bora Tazısı +7.1, Kasırga Kartalı +7.0, Kızıl Kurt +6.3, Hortum Ruhu +5.5 · ✗ Zümrüdüanka -7.2, Tufan Ejderi -5.9 |
| **Şimşek Atmacası** (Rüzgar+Elektrik) | Rare | avian | 2 | Swift. Harvest: +3 ve masadaki her farklı element için +1. Sağ bağlantı uyumluysa x1,5. | 24.8 | 22.0 | -0.2 | İletken Yengeç +8.0, Girdap Ahtapotu +7.9, Fırtına Golemi +6.8, Bobin Kaplumbağası +6.2 · ✗ Kızıl Kurt -7.1, Kıvılcım Bobini -6.7 |
| **Ateş Atmacası** (Rüzgar+Ateş) | Rare | avian | 2 | Swift. Harvest: masaya +1 Isı. +2 ve masadaki her farklı element için +1. | 18.5 | 16.1 | ▼ -1.5 | Volkan Kaplumbağası +8.3, Zümrüdüanka +7.6, Volkan Yılanı +7.4, Ebedi Alev +7.2 · ✗ Kızıl Kurt -7.8, Alev Ruhu -6.0 |
| **Grifon Yavrusu** | Rare | avian | 3 | Harvest: +4. İlk ya da son slottaysa x2,5. | 36.7 | 34.5 | ▲ 2.3 | Kraken +23.5, Bilge Baykuş +15.2, Ayna Denizanası +9.9, Nehir Yılanbalığı +7.1 · ✗ Grifon Yavrusu -5.9, Kızıl Kurt -5.6 |
| **Bilge Baykuş** | Rare | avian | 3 | Aura: diğer Avian kartları Harvest'te +2. Harvest: +3. | 15.9 | 25.2 | -0.1 | Grifon Yavrusu +15.2, Bilge Baykuş +13.7, Fırtına Kartalı +13.6, Meltem Serçesi +11.2 · ✗ Fırtına Golemi -8.1, Dört Rüzgar Ruhu -6.3 |
| **Girdap Ruhu** | Rare | ghost | 2 | Swift. Harvest: +2. Haunt: masadaki her farklı element için +1. | 21.4 | 12.3 | -0.9 | Sis Kraliçesi +5.7, Bora Tazısı +3.7, Diken Çalısı +3.5, Çamur Kaplumbağası +3.5 · ✗ Dört Rüzgar Ruhu -13.5, Zümrüdüanka -8.2 |
| **Gök Yılanı** | Epic | serpent | 3 | Swift. Harvest: +2 ve masadaki her farklı element için +2. | 33.2 | 17.3 | -0.3 | Kraken +12.8, Ayna Denizanası +9.2, Girdap Ahtapotu +9.0, Nehir Yılanbalığı +7.3 · ✗ Dört Rüzgar Ruhu -15.7, Zümrüdüanka -11.4 |
| **Bulut Ejderi** | Epic | dragon | 3 | Harvest: +3 ve masadaki her farklı element için +2. 5 farklı element varsa x2. | 39.4 | 19.5 | ▲ 1.6 | Kraken +25.5, Elektrikli Yılanbalığı +13.3, Ayna Denizanası +10.5, Buhar Kaplumbağası +10.0 · ✗ Bulut Ejderi -10.1, Zümrüdüanka -9.5 |
| **Kasırga Kartalı** | Epic | avian | 2 | Swift. Harvest: +5. İlk slottaysa x2. Last Breath: sağındaki kartı bir kez daha tetikler. | 31.9 | 28.4 | -0.7 | Kraken +20.3, Mercan Kaplumbağası +14.0, Girdap Ahtapotu +13.4, Ayna Denizanası +13.3 · ✗ Meşale Kertenkelesi -10.8, Kasırga Kartalı -10.1 |
| **Zümrüdüanka** | Legendary | avian | 4 | Harvest: +4, masadaki her farklı element ve her başka Avian için +2. | 55.6 | 48.5 | -0.4 | Kraken +21.6, Kül Kargası +17.8, Anka Kuşu +15.9, Tohum İspinozu +14.5 · ✗ Gök Yılanı -11.4, Bulut Ejderi -9.5 |
| **Hortum Ejderi** | Legendary | dragon | 3 | Swift. Overload. Harvest: +6 ve masadaki her farklı element için +3. | 42.9 | 24.4 | ▼ -1.6 | Kraken +22.9, Ayna Denizanası +20.5, Girdap Ahtapotu +20.1, Nehir Yılanbalığı +14.0 · ✗ Hortum Ejderi -10.9, Gök Yılanı -9.8 |
| **Dört Rüzgar Ruhu** | Mythic | ghost | 3 | Swift. Harvest: +3 ve masadaki her farklı element için +3. Last Breath: diğer tüm kartlar bir kez daha tetiklenir. | 74.6 | 51.0 | 0.6 | Kraken +53.4, Ayna Denizanası +25.1, Girdap Ahtapotu +24.1, Mercan Kaplumbağası +20.1 · ✗ Gök Yılanı -15.7, Girdap Ruhu -13.5 |

### Elektrik (25)

Kimlik: Kutuplaşma (uyumlu/çakışan bağlantı), Overload, Ward, Elektrik sayımı.

| Kart | Nadirlik | Tip | Dyn | Yetenek | Karışık | Element | z | Sinerji ortakları |
|---|---|---|---:|---|---:|---:|---:|---|
| **Şarj Yarasası** | Common | beast | 1 | Harvest: +4. Sağ bağlantı uyumluysa +4. | 13.0 | 13.1 | -1.3 | Fırtına Golemi +13.0, Ark Vaşağı +7.6, Tufan Ejderi +7.5, İletken Yengeç +7.5 · ✗ Şimşek Koçu -7.5, Kor Şimşek Ejderi -6.0 |
| **Kıvılcım Bobini** | Common | serpent | 2 | Harvest: +3. Sağ bağlantı uyumluysa +5. | 16.3 | 25.0 | 1.5 | Kondansatör Golemi +18.6, Şimşek Koçu +16.0, Fırtına Salyangozu +15.8, Tufan Ejderi +13.8 · ✗ Şimşek Atmacası -6.7, Ark Vaşağı -5.5 |
| **Fırtına Salyangozu** | Common | beast | 2 | Harvest: +3. Sol bağlantı uyumluysa +5. | 17.5 | 25.4 | ▲ 1.6 | Kıvılcım Bobini +15.8, Tufan Ejderi +15.1, Yıldırım Kurdu +12.5, Kondansatör Golemi +10.3 · ✗ Bulut Ejderi -8.0, Şimşek Atmacası -6.3 |
| **Statik Tavşan** | Common | beast | 2 | Harvest: +2. Her çakışan bağlantı için +4. | 17.6 | 23.4 | 1.1 | Fırtına Golemi +20.6, Tufan Ejderi +14.0, İletken Yengeç +12.1, Gerilim Kertenkelesi +12.0 · ✗ Zümrüdüanka -5.8, Rüzgar Tilkisi -5.2 |
| **Volt Faresi** | Common | beast | 2 | Harvest: +2. Her çakışan bağlantı için +4. | 15.4 | 22.3 | 0.8 | Tufan Ejderi +15.3, Bobin Kaplumbağası +12.3, Yıldırım Kurdu +11.8, Volt Faresi +11.0 · ✗ Fırtına Golemi -7.5, Ebedi Alev -4.7 |
| **Çarpan Böcek** | Common | swarm | 1 | Harvest: +3 ve masadaki her başka Swarm için +3. | 12.0 | 10.9 | ▼ -1.6 | Fırtına Golemi +10.9, Sürü Annesi +10.7, Ark Vaşağı +8.1, Bobin Kaplumbağası +7.7 · ✗ Kızıl Kurt -6.6, Gök Gürültüsü Ejderi -5.6 |
| **Bakır Kurt** | Common | serpent | 3 | Harvest: +3. İki yanı da bağlıysa x2. | 15.3 | 23.4 | 1.1 | Fırtına Golemi +13.0, Tufan Ejderi +9.4, Ark Vaşağı +8.5, Bobin Kaplumbağası +7.0 · ✗ Mercan Kaplumbağası -5.1, Kor Şimşek Ejderi -4.1 |
| **Şimşek Yavrusu** | Common | beast | 2 | Harvest: +5. | 18.7 | 19.1 | 0.1 | Gerilim Kertenkelesi +11.4, Şimşek Koçu +8.7, Kondansatör Golemi +7.3, Fırtına Golemi +7.2 · ✗ Kor Böceği -4.7, Volkan Yılanı -4.7 |
| **Gerilim Kertenkelesi** | Uncommon | beast | 2 | Harvest: +4. Sol bağlantı çakışıyorsa x2,5. | 19.8 | 21.7 | -0.2 | Tufan Ejderi +19.6, Fırtına Golemi +17.0, Mıknatıs Golemi +14.1, Statik Tavşan +12.0 · ✗ Gerilim Kertenkelesi -9.7, Şimşek Koçu -9.6 |
| **Şimşek Koçu** | Uncommon | beast | 2 | Ward. Harvest: +4. Sol bağlantı uyumluysa x2. | 23.2 | 31.0 | ▲ 1.6 | Kondansatör Golemi +18.8, Tufan Ejderi +17.6, Kıvılcım Bobini +16.0, Elektrikli Yılanbalığı +12.1 · ✗ Gerilim Kertenkelesi -9.6, Şarj Yarasası -7.5 |
| **Dinamo Hamsteri** | Uncommon | beast | 2 | Harvest: +2 ve masadaki her başka Elektrik kartı için +1. | 11.6 | 20.3 | -0.5 | Kıvılcım Bobini +9.5, Bobin Kaplumbağası +8.4, Kondansatör Golemi +8.3, Gök Gürültüsü Ejderi +7.7 · ✗ Volkan Yılanı -6.3, Alev Sürüsü -4.2 |
| **Ark Vaşağı** | Uncommon | beast | 2 | Swift. Harvest: +3. Sağ bağlantı uyumluysa x2,5. | 15.7 | 20.3 | -0.4 | İletken Yengeç +14.5, Fırtına Golemi +13.8, Plazma Yılanı +10.3, Bakır Kurt +8.5 · ✗ Fırtına İti -5.8, Kıvılcım Bobini -5.5 |
| **Kondansatör Golemi** | Uncommon | golem | 3 | Heavy. Harvest: +2. Her uyumlu bağlantı için +4. | 19.5 | 31.1 | ▲ 1.6 | Kondansatör Golemi +22.2, Şimşek Koçu +18.8, Kıvılcım Bobini +18.6, Tufan Ejderi +16.5 · ✗ Kızıl Kurt -5.8, Hortum Ejderi -5.2 |
| **Akım Gelinciği** | Uncommon | beast | 4 | Overload. Harvest: +7. | 23.4 | 25.0 | 0.5 | Fırtına Golemi +13.4, Şimşek Koçu +11.2, Tufan Ejderi +9.0, Kondansatör Golemi +6.3 · ✗ Kor Şimşek Ejderi -7.5, Elektrikli Yılanbalığı -7.5 |
| **Elektrikli Yılanbalığı** (Elektrik+Su) | Rare | serpent | 2 | Harvest: +3 ve soldaki kartın bu geçişteki gelirinin %50'si. Sağ bağlantı uyumluysa +3. | 26.0 | 29.0 | 0.7 | Dört Rüzgar Ruhu +14.1, Kondansatör Golemi +13.6, Hortum Ejderi +13.5, Bulut Ejderi +13.3 · ✗ Kızıl Kurt -9.6, Ayna Denizanası -9.3 |
| **Mıknatıs Golemi** (Elektrik+Toprak) | Rare | golem | 3 | Heavy. Harvest: +2, masadaki her pasif kart için +1, her çakışan bağlantı için +2. | 23.9 | 28.4 | 0.5 | Gerilim Kertenkelesi +14.1, Fırtına Golemi +13.3, Statik Tavşan +8.6, Tufan Ejderi +8.3 · ✗ Toprak Ana -9.8, Magma Titanı -6.9 |
| **Fırtına İti** | Rare | beast | 2 | Harvest: +4. İki bağlantısı da uyumluysa x3. | 17.6 | 26.5 | 0.1 | Tufan Ejderi +11.8, Kondansatör Golemi +11.5, Fırtına Golemi +10.8, Fırtına Salyangozu +10.3 · ✗ Şimşek Atmacası -6.5, Zümrüdüanka -6.5 |
| **Yıldırım Ruhu** | Rare | ghost | 1 | Harvest: +4. Haunt: +2, sağ bağlantı uyumluysa +3 daha. | 22.5 | 26.3 | 0.1 | Fırtına Golemi +9.7, Bobin Kaplumbağası +7.6, Tufan Ejderi +7.2, Şarj Yarasası +6.8 · ✗ Kızıl Kurt -7.9, Elektrikli Yılanbalığı -7.2 |
| **Bobin Kaplumbağası** | Rare | beast | 2 | Ward. Harvest: +3. Her çakışan bağlantı için +3. | 21.8 | 29.2 | 0.7 | İletken Yengeç +13.8, Bobin Kaplumbağası +13.6, Tufan Ejderi +13.3, Volt Faresi +12.3 · ✗ Fırtına Golemi -6.3, Buhar Kaplumbağası -5.5 |
| **Gök Gürültüsü Ejderi** | Epic | dragon | 4 | Overload. Harvest: +6. Her uyumlu bağlantı için x1,5. | 25.2 | 32.9 | -0.4 | Tufan Ejderi +20.0, Kondansatör Golemi +13.1, Yıldırım Kurdu +10.8, Fırtına Salyangozu +9.8 · ✗ Hortum Ejderi -6.6, Kızıl Kurt -5.8 |
| **Plazma Yılanı** | Epic | serpent | 3 | Harvest: +3 ve masadaki her başka Elektrik kartı için +1. Last Breath: sağındaki kartı bir kez daha tetikler. | 25.6 | 34.5 | 0.1 | Bobin Kaplumbağası +12.1, Fırtına Golemi +10.6, Ark Vaşağı +10.3, Tufan Ejderi +10.0 · ✗ Kızıl Kurt -6.5, Ayna Denizanası -5.7 |
| **İletken Yengeç** | Epic | beast | 2 | Howl: diğer tüm Elektrik kartlarına +1 dayanıklılık. Harvest: +3. | 17.8 | 41.6 | ▲ 2.3 | Fırtına Golemi +25.3, Ark Vaşağı +14.5, Bobin Kaplumbağası +13.8, Tufan Ejderi +13.0 · ✗ Bulut Ejderi -7.0, Deniz Ejderi -5.6 |
| **Yıldırım Kurdu** | Legendary | beast | 3 | Swift. Harvest: +5. İki bağlantısı da uyumluysa x3. | 24.6 | 44.5 | -1.5 | Fırtına Salyangozu +12.5, Volt Faresi +11.8, Tufan Ejderi +10.9, Gök Gürültüsü Ejderi +10.8 · ✗ Kristal Golem -5.1, Anka Kuşu -5.0 |
| **Fırtına Golemi** | Legendary | golem | 4 | Ward. Overload. Harvest: +8 ve her çakışan bağlantı için +6. | 46.3 | 60.9 | 0.1 | Tufan Ejderi +26.5, Fırtına Golemi +25.5, İletken Yengeç +25.3, Kraken +21.0 · ✗ Yavru Ejder -9.6, Kızıl Kurt -9.1 |
| **Tufan Ejderi** | Mythic | dragon | 3 | Howl: diğer tüm Elektrik kartlarına +1 dayanıklılık. Harvest: +5 ve masadaki her başka Elektrik kartı için +2. | 33.8 | 84.4 | 1.4 | Fırtına Golemi +26.5, Gök Gürültüsü Ejderi +20.0, Gerilim Kertenkelesi +19.6, Şimşek Koçu +17.6 · ✗ Bulut Baykuşu -9.1, Derin Fener Balığı -8.8 |

## Onay

Seçenekler: tümünü onayla · şu kartlar hariç onayla · şu kartları değiştir (sayı / yetenek / nadirlik / isim).
Onaylanan kartlar `content/cards.json`'a taşınır, ardından preset desteler kurulur ve kota yeniden kalibre edilir.
