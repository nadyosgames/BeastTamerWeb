import { useMemo, useState, type DragEvent } from 'react'
import { fullPrompt, listArtAssets, type ArtAssetRef } from '../../art/prompts.ts'
import type { ArtKind } from '../../content/index.ts'
import { content } from '../content.ts'
import { useNav } from '../../state/nav.ts'
import { artUrl } from '../art.ts'
import { CardView } from '../components/CardView.tsx'
import './ArtStudio.css'

/**
 * ChatGPT görsel akışı için çalışma ekranı (yalnızca `npm run dev`):
 *  1. Prompt'u kopyala → ChatGPT'ye yapıştır, görseli üret ve indir.
 *  2. İndirilen dosyayı ilgili karta sürükle → dev sunucusu master + web sürümlerini üretir.
 *  3. Kart çerçeve içinde anında güncellenir (Vite HMR).
 */
const KINDS: { kind: ArtKind; label: string }[] = [
  { kind: 'cards', label: 'Kartlar' },
  { kind: 'tamers', label: "Tamer'lar" },
  { kind: 'weather', label: 'Hava' },
]

type Status = { state: 'busy' | 'ok' | 'error'; msg: string }

export function ArtStudio() {
  const go = useNav((s) => s.go)
  const assets = useMemo(() => listArtAssets(content), [])
  const [kind, setKind] = useState<ArtKind>('cards')
  const [onlyMissing, setOnlyMissing] = useState(false)
  const [styleAnchor, setStyleAnchor] = useState(true)
  const [status, setStatus] = useState<Record<string, Status>>({})
  const [over, setOver] = useState<string | null>(null)

  const has = (a: ArtAssetRef) => artUrl(a.kind, a.id) !== null
  const list = assets.filter((a) => a.kind === kind && (!onlyMissing || !has(a)))
  const count = (k: ArtKind) => {
    const all = assets.filter((a) => a.kind === k)
    return `${all.filter(has).length}/${all.length}`
  }

  const copy = async (a: ArtAssetRef) => {
    await navigator.clipboard.writeText(fullPrompt(a, content.art, styleAnchor))
    setStatus((s) => ({ ...s, [a.key]: { state: 'ok', msg: "Prompt kopyalandı → ChatGPT'ye yapıştır" } }))
  }

  const upload = async (a: ArtAssetRef, file: File) => {
    if (!import.meta.env.DEV) return
    setStatus((s) => ({ ...s, [a.key]: { state: 'busy', msg: 'İşleniyor…' } }))
    try {
      const res = await fetch(`/__art/upload?kind=${a.kind}&id=${a.id}&name=${encodeURIComponent(file.name)}`, {
        method: 'POST',
        body: file,
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error)
      setStatus((s) => ({
        ...s,
        [a.key]: { state: 'ok', msg: `Kaydedildi (${body.sourceSize.width}×${body.sourceSize.height} → ${body.width}×${body.height})` },
      }))
    } catch (e) {
      setStatus((s) => ({ ...s, [a.key]: { state: 'error', msg: (e as Error).message } }))
    }
  }

  const onDrop = (a: ArtAssetRef) => (e: DragEvent) => {
    e.preventDefault()
    setOver(null)
    const file = e.dataTransfer.files[0]
    if (file) void upload(a, file)
  }

  return (
    <div className="art">
      <header className="art__top">
        <button className="btn small" onClick={() => go('menu')}>
          ← GERİ
        </button>
        <h2>ART STUDIO</h2>
        <div className="chip-row">
          {KINDS.map((k) => (
            <button key={k.kind} className={`btn small ${kind === k.kind ? 'active' : ''}`} onClick={() => setKind(k.kind)}>
              {k.label} {count(k.kind)}
            </button>
          ))}
        </div>
        <label className="art__toggle">
          <input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} /> yalnızca eksikler
        </label>
        <label className="art__toggle" title={content.art.styleAnchor}>
          <input type="checkbox" checked={styleAnchor} onChange={(e) => setStyleAnchor(e.target.checked)} /> stil referansı
          cümlesi
        </label>
      </header>

      <div className="art__help panel">
        <b>Akış:</b> 1) <i>Prompt'u kopyala</i> → ChatGPT'de üret (her istekte tek görsel, hep aynı sohbet) · 2) beğendiğin ilk
        görseli <code>art/style-ref/{kind}.png</code> olarak sakla ve sonraki isteklere ekle · 3) indirilen dosyayı karta
        sürükle · ChatGPT boyutu <b>{content.art.kinds[kind].chatgptSize}</b> → master{' '}
        <b>
          {content.art.kinds[kind].master.width}×{content.art.kinds[kind].master.height}
        </b>
        {!import.meta.env.DEV && <span className="bad"> · Yükleme yalnızca npm run dev ile çalışır.</span>}
      </div>

      <div className={`art__grid art__grid--${kind} scroll`}>
        {list.map((a) => {
          const st = status[a.key]
          const url = artUrl(a.kind, a.id)
          return (
            <div
              key={a.key}
              className={`art__item panel ${over === a.key ? 'is-over' : ''}`}
              onDragOver={(e) => {
                e.preventDefault()
                setOver(a.key)
              }}
              onDragLeave={() => setOver(null)}
              onDrop={onDrop(a)}
            >
              <div className="art__preview">
                {a.kind === 'cards' ? (
                  <CardView card={content.card(a.id)} size="sm" />
                ) : url ? (
                  <img src={url} alt={a.name} />
                ) : (
                  <div className="art__empty">görsel yok</div>
                )}
              </div>
              <div className="art__meta">
                <div className="art__name">
                  {has(a) ? '✅' : '⬜'} {a.name}
                </div>
                <code>{a.key}</code>
                <p className="art__prompt">{a.prompt}</p>
                <div className="chip-row">
                  <button className="btn small" onClick={() => void copy(a)}>
                    Prompt'u kopyala
                  </button>
                  <label className="btn small">
                    Dosya seç
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      hidden
                      onChange={(e) => e.target.files?.[0] && void upload(a, e.target.files[0])}
                    />
                  </label>
                </div>
                {st && <div className={`art__status art__status--${st.state}`}>{st.msg}</div>}
              </div>
              {over === a.key && <div className="art__drop">Bırak → {a.key}</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
