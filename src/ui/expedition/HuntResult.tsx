import { motion } from 'motion/react'
import { content } from '../content.ts'
import { CardView } from '../components/CardView.tsx'
import { GameIcon } from '../components/GameIcon.tsx'
import { PreyMedallion } from '../components/HuntBits.tsx'
import { huntName, OUTCOME_TITLE, STARS } from '../hunt.ts'
import type { HuntSummary } from '../../state/game.ts'
import './HuntResult.css'

/**
 * Av sonucu: yakalandıysa kart ve ödül dökümü, kaçtıysa yara ve öneri, Tamer düştüyse çanta kaybı.
 * Hem av ekranının sonunda hem de Hızlı Av'da gösterilir.
 */
export function HuntResult({
  summary,
  damage,
  tamerHp,
  tamerMax,
  quick = false,
  rounds,
  onClose,
}: {
  summary: HuntSummary
  damage: number
  tamerHp: number | null
  tamerMax: number
  quick?: boolean
  rounds?: { intent: string; damage: number; best: number; guard: number }[]
  onClose: () => void
}) {
  const hunt = content.hunt(summary.hunt)
  const card = content.card(hunt.card)
  const won = summary.outcome === 'captured'
  const r = summary.reward
  return (
    <div className="overlay">
      <section role="dialog" aria-modal="true" aria-label={OUTCOME_TITLE[summary.outcome]} className={`overlay__panel panel hunt-result hunt-result--${summary.outcome}`}>
        <header className="hunt-result__head">
          <motion.h3 initial={{ scale: 1.6, rotate: -8, opacity: 0 }} animate={{ scale: 1, rotate: -3, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 16 }}>
            {OUTCOME_TITLE[summary.outcome]}
          </motion.h3>
          <span className="muted">{quick ? 'Hızlı Av' : huntName(hunt)} · {damage} hasar</span>
        </header>
        <div className="hunt-result__body">
          <div className="hunt-result__hero">
            {won ? (
              <motion.div initial={{ y: 40, opacity: 0, rotate: 6 }} animate={{ y: 0, opacity: 1, rotate: -2 }} transition={{ delay: 0.25, type: 'spring', stiffness: 200, damping: 18 }}>
                <CardView card={card} keywordTooltip={false} />
              </motion.div>
            ) : (
              <PreyMedallion hunt={hunt} size={230} dim={summary.outcome !== 'nightfall'} />
            )}
          </div>
          <div className="hunt-result__info">
            {won && (
              <>
                <p className="hunt-result__stars" aria-label={`${summary.stars} yıldız`}>{STARS(summary.stars)}</p>
                <p className="hunt-result__note">{summary.stars === 3 ? 'Kusursuz av: Hızlı Av açıldı.' : summary.stars === 2 ? '★★★ için 4. turda ve Tamer canının en fazla %10\'unu kaybederek bayılt.' : '★★ için 5. turda ya da önce bayılt.'}</p>
                {r && (
                  <table className="hunt-result__reward">
                    <tbody>
                      <tr><td>Taban ({card.rarity})</td><td>{r.base}</td></tr>
                      {r.speedPct > 0 && <tr><td>Hız ({r.remainingRounds} tur erken)</td><td>+%{r.speedPct}</td></tr>}
                      {r.streakPct > 0 && <tr><td>Seri</td><td>+%{r.streakPct}</td></tr>}
                      {summary.duplicateEssence > 0 && <tr><td>Kopya fazlası → öz</td><td>+{summary.duplicateEssence}</td></tr>}
                      <tr className="hunt-result__total"><td><GameIcon name="gem" size={26} /> Çantaya</td><td>+{r.essence + summary.duplicateEssence}</td></tr>
                    </tbody>
                  </table>
                )}
                <p>{summary.cardAdded ? <><b>{card.name}</b> koleksiyonuna katıldı.</> : <>Bu karttan destede kullanılabilecek kadar var: kopya öze dönüştü.</>}</p>
              </>
            )}
            {(summary.outcome === 'escaped' || summary.outcome === 'fled') && (
              <>
                <p>{summary.outcome === 'fled' ? 'Kaçış Hazırlığı tuttu: yaratık son anda sıvıştı.' : 'Son tur bitti, yaratık hâlâ ayaktaydı.'}</p>
                {summary.woundedHp !== null && <p><b>Yaralı kaldı:</b> bu sefer boyunca {summary.woundedHp} canla gelir.</p>}
                <p className="muted">Seri bozuldu. Havaya uygun bir deste, Koruma ya da niyetlere göre dizilim dene.</p>
              </>
            )}
            {summary.outcome === 'nightfall' && (
              <>
                <p>Kuşatmanın {summary.siegeDay}. günü bitti. Yaratık kaldığı canla yarın döner.</p>
                <p className="muted">Yarın başka bir deste seçmelisin; bugün oynanan kartlar yarın −1 dayanıklılıkla başlar. Gece Tamer tam dinlenir.</p>
              </>
            )}
            {summary.outcome === 'tamerDown' && (
              <>
                <p>Tamer'ın canı bitti ve kampa taşındı. Sefer sona erdi.</p>
                {summary.bagLost + summary.bagBanked > 0
                  ? <p><b>Çantanın yarısı kayboldu:</b> −{summary.bagLost} öz. Kalan <b>{summary.bagBanked}</b> öz bakiyene geçti.</p>
                  : <p>Çanta boştu, öz kaybı yok.</p>}
                <p className="muted">Bayıltılan yaratıklar asla kaybolmaz.</p>
              </>
            )}
            {tamerHp !== null && summary.outcome !== 'tamerDown' && (
              <p className="hunt-result__tamer">Tamer'ın canı: <b>{tamerHp}</b> / {tamerMax}</p>
            )}
            {summary.newlyUnlocked.length > 0 && (
              <p className="hunt-result__unlock">✦ Haritada yeni av: <b>{summary.newlyUnlocked.map((id) => content.hunt(id).tier === 'legendary' || content.hunt(id).tier === 'ancient' ? '??? (gizli yaratık)' : huntName(content.hunt(id))).join(', ')}</b></p>
            )}
            {summary.newRegions.length > 0 && <p className="hunt-result__unlock hunt-result__unlock--region">✦ Dünya haritasında yeni bölge açıldı: <b>{summary.newRegions.map((id) => content.region(id).name).join(', ')}</b></p>}
            {summary.newTamers.length > 0 && <p className="hunt-result__unlock">✦ Yeni Tamer: <b>{summary.newTamers.map((id) => content.tamer(id).name).join(', ')}</b></p>}
            {summary.bookCompleted && <p className="hunt-result__unlock">✦ Bölge kitabı tamamlandı! Kalıcı buff: <b>{content.region(hunt.region).buff.text}</b></p>}
            {rounds && rounds.length > 0 && (
              <table className="hunt-result__rounds">
                <thead>
                  <tr><th>Tur</th><th>Niyet</th><th>Hasar</th><th>En iyi</th><th>Koruma</th></tr>
                </thead>
                <tbody>
                  {rounds.map((x, i) => (
                    <tr key={i}>
                      <td>{i + 1}</td>
                      <td>{x.intent}</td>
                      <td className={x.damage >= x.best ? 'good' : ''}>{x.damage}</td>
                      <td>{x.best}</td>
                      <td>{x.guard || '–'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
        <footer className="hunt-result__actions">
          <button className="btn primary" onClick={onClose}>{summary.outcome === 'tamerDown' ? 'KAMPA DÖN' : 'HARİTAYA DÖN'}</button>
        </footer>
      </section>
    </div>
  )
}
