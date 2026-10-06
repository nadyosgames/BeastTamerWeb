import { useGame } from '../../state/game.ts'
import { useNav } from '../../state/nav.ts'
import { useHunt, type HuntStatus } from '../../state/hunt.ts'
import { coachStep } from './flow.ts'
import { TUTORIAL } from './script.ts'
import './TutorialCoach.css'

/**
 * Eğitim anlatıcısı: oyun ekranının sol alt panelinin yerini alır. Turun aşamasına
 * (dizme / oynatma / sonuç) göre anlatır, dizim aşamasında bir sonraki adımı söyler.
 */
export function TutorialCoach({ status, roundIndex, ids }: { status: HuntStatus; roundIndex: number; ids: (string | null)[] }) {
  const round = TUTORIAL[roundIndex]
  if (!round) return null
  const step = coachStep(round, ids)
  let task: string
  if (status !== 'arrange') task = ''
  else if (step.placed === 0) task = 'Bir kartı tut ve yukarıdaki boş slota sürükle.'
  else if (!step.full) task = `Güzel! Kalan ${ids.length - step.placed} kartı da yerleştir.`
  else if (!step.goalMet) task = round.goalHint ?? ''
  else task = 'Hazır! Sağ alttaki BAŞLAT\'a bas ve turu izle.'

  return (
    <aside className="coach panel" aria-live="polite">
      <header className="coach__head">
        <span className="coach__badge">EĞİTİM {roundIndex + 1}/{TUTORIAL.length}</span>
        <b>{round.title}</b>
      </header>
      <p className="coach__text">{status === 'arrange' ? round.intro : status === 'playing' ? round.playing : round.done}</p>
      {task && <p className={`coach__task ${step.ready ? 'is-ready' : step.full && !step.goalMet ? 'is-hint' : ''}`}>{step.full && !step.goalMet ? '💡 ' : '➜ '}{task}</p>}
      {status === 'roundDone' && <p className="coach__task is-ready">➜ {roundIndex + 1 < TUTORIAL.length ? 'DEVAM ET ile sonraki derse geç.' : 'EĞİTİMİ BİTİR\'e bas.'}</p>}
    </aside>
  )
}

/** Eğitim sonu: profile işlenir, oyuncu haritaya ya da rehbere yönlendirilir. */
export function TutorialDone({ onGuide }: { onGuide: () => void }) {
  const go = useNav((s) => s.go)
  const leave = useHunt((s) => s.leave)
  const rounds = useHunt((s) => s.rounds)
  const setTutorialDone = useGame((s) => s.setTutorialDone)
  const finish = (to: 'menu' | 'play') => {
    setTutorialDone(true)
    leave()
    go(to)
  }
  const total = rounds.reduce((a, r) => a + r.damage, 0)
  const best = rounds.reduce((a, r) => a + r.best, 0)
  return (
    <div className="overlay">
      <div className="overlay__panel overlay__panel--text panel coach__done">
        <h3>Eğitim tamamlandı!</h3>
        <p>
          3 turda <b className="gold">⚔{total}</b> hasarla ilk yaratığını bayılttın (en iyi dizilimlerle ⚔{best}).
        </p>
        <ul>
          <li>Haritada bir yaratık seç ve ava çık. Her av bir gün sürer, hava her gün değişir ve 5 gün önceden görünür.</li>
          <li>Yaratığın niyetine bak: Pençe Tamer'ı vurur, Yırtma ve Kükreme belirli slotlardaki kartları hedefler.</li>
          <li>Tamer'ın canı sefer boyunca taşınır. Yorulunca dinlen ya da kampa dön; çantadaki öz kampta bakiyene geçer.</li>
          <li>Kuralları unutursan oyun ekranındaki <b>?</b> düğmesi rehberi açar.</li>
        </ul>
        <div className="chip-row coach__actions">
          <button className="btn" onClick={onGuide}>
            Nasıl oynanır rehberi
          </button>
          <button className="btn" onClick={() => finish('menu')}>
            Ana menü
          </button>
          <button className="btn primary" onClick={() => finish('play')}>
            HARİTAYA GİT
          </button>
        </div>
      </div>
    </div>
  )
}
