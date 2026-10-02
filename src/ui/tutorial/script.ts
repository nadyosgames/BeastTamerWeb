/**
 * Eğitim senaryosu: hava ve Tamer'sız, 3 slotluk sabit eller. Her tur tek bir fikir öğretir
 * (dizme ve geçiş → sıra → Howl ve Isı). `goal` verilen turda BAŞLAT ancak hedef dizilimle açılır.
 * Metinler kart adlarını içerikten alır; kart yeniden adlandırılırsa eğitim de güncel kalır.
 */
import { content } from '../content.ts'

export interface TutorialRound {
  title: string
  cards: string[]
  /** Kartları dizmeden önce okunan anlatım. */
  intro: string
  /** Slot dizilimi (kart id'leri, boş = null) hedefe uyuyor mu. */
  goal?: (ids: (string | null)[]) => boolean
  goalHint?: string
  /** Kartlar highlight edilir (hangi kartlara dikkat edilmeli). */
  focus?: string[]
  playing: string
  done: string
}

const n = (id: string) => content.card(id).name
const leftOf = (ids: (string | null)[], a: string, b: string) => {
  const i = ids.indexOf(a)
  return i >= 0 && ids[i + 1] === b
}

export const TUTORIAL: TutorialRound[] = [
  {
    title: 'Kartları diz',
    cards: ['magma_pup', 'clay_golem', 'bubble_fish'],
    intro:
      'Her turda elindeki tüm kartları yukarıdaki slotlara dizersin. Bir kartı tutup boş bir slota sürükle; tıklarsan ilk boş slota gider. Slottaki kartları sürükleyerek yer değiştirebilirsin.',
    playing:
      'Kartlar soldan sağa sırayla tetiklenir; bir tam sıraya geçiş denir. Her tetik 1 dayanıklılık (🛡) harcar. Dayanıklılığı biten kart pasife geçer, hepsi bitince tur kapanır.',
    done: `Bir kartın dayanıklılığı kaç kez tetikleneceğidir. ${n('bubble_fish')} tek dayanıklılıkla erken bitti, ama Last Breath yeteneği ona son bir +3 verdi. Bu turda sıra fark etmedi; sıradakinde edecek.`,
  },
  {
    title: 'Sıra önemlidir',
    cards: ['spark_fox', 'baby_dragon', 'torch_lizard'],
    intro: `Çoğu kart komşusuna ya da yerine bakar. ${n('spark_fox')}: sağındaki kart Dragon ise x2,5. ${n('torch_lizard')}: en soldaysa x2. Kartın üzerine gelirsen yeteneklerin açıklamasını görürsün.`,
    goal: (ids) => ids[0] === 'torch_lizard' && leftOf(ids, 'spark_fox', 'baby_dragon'),
    goalHint: `${n('torch_lizard')} en sola, ${n('spark_fox')} ise ${n('baby_dragon')} kartının hemen soluna.`,
    focus: ['spark_fox', 'torch_lizard'],
    playing: `${n('spark_fox')} her tetikte x2,5 alıyor, çünkü sağında bir Dragon var. Kartın altındaki tür etiketi (BEAST, DRAGON…) bu koşullar için önemlidir.`,
    done: 'Tur sonunda dizilimin, aynı elle bulunabilecek en iyi dizilimle karşılaştırılır. Amaç her elde en yüksek geliri bulmaktır.',
  },
  {
    title: 'Howl ve Isı',
    cards: ['coral_crab', 'ember_hedgehog', 'baby_dragon'],
    intro: `Howl tur başında bir kez çalışır: ${n('coral_crab')} sağındaki kartın dayanıklılığını +1 yapar, yani o kart bir kez daha tetiklenir. Isı masada biriken ortak bir sayaçtır: ${n('ember_hedgehog')} ve ${n('baby_dragon')} Isı ekler, ${n('ember_hedgehog')} Isı kadar bonus alır.`,
    goal: (ids) => ids[0] === 'baby_dragon' && leftOf(ids, 'coral_crab', 'ember_hedgehog'),
    goalHint: `${n('baby_dragon')} en sola: Isı'yı erkenden başlatır. ${n('coral_crab')} ise ${n('ember_hedgehog')} kartının hemen soluna: fazladan tetik en çok Isı'dan beslenen karta yarar.`,
    focus: ['coral_crab', 'ember_hedgehog'],
    playing: 'Sağdaki kayıtta "↳" satırlarını izle: Howl\'un verdiği dayanıklılık ve biriken Isı orada, kaynağıyla birlikte yazar. Üstte de masadaki Isı görünür.',
    done: 'Gerçek oyunda her gün 30 kartlık desteden 5\'erli eller gelir ve 6 tur oynarsın. Hava bazı elementleri güçlendirir, Tamer\'ın pasifi tüm desteyi etkiler.',
  },
]
