# art/inbox — ChatGPT'den indirilen görseller buraya

Dosyayı ilgili klasöre **varlığın id'si** ile koy, sonra `npm run art:ingest` çalıştır:

```
art/inbox/cards/spark_fox.png
art/inbox/tamers/wanderer.png
art/inbox/weather/sunny.png
```

- Kökte de bırakabilirsin (`art/inbox/spark_fox.png`); id benzersizse eşleşir.
- Aynı kartın yeni denemesi: `spark_fox_v2.png` → yine `spark_fox` olarak işlenir, eskisi `art/originals/` altında arşivde kalır.
- Uzantı: png, jpg, jpeg, webp.

Daha kolayı: `npm run dev` → tarayıcıda **Art Studio** → görseli kartın üstüne sürükle-bırak.
