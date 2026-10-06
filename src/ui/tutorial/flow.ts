import { useHunt } from '../../state/hunt.ts'
import { useNav } from '../../state/nav.ts'
import { content } from '../content.ts'
import { TUTORIAL, TUTORIAL_HUNT, type TutorialRound } from './script.ts'

/** Eğitimi baştan başlatır ve av ekranına geçer (ana menü, rehber ve tamamlama ekranı kullanır). */
export function startTutorial() {
  useHunt.getState().startTutorial(TUTORIAL_HUNT, TUTORIAL.map((r) => r.cards.map((id) => content.card(id))))
  useNav.getState().go('run')
}

/** Dizim aşamasında hangi adımda olunduğu: kart yok → kısmen → hedef dışı → hazır. */
export function coachStep(round: TutorialRound, ids: (string | null)[]) {
  const placed = ids.filter(Boolean).length
  const full = placed === ids.length
  const goalMet = !round.goal || round.goal(ids)
  return { placed, full, goalMet, ready: full && goalMet }
}
