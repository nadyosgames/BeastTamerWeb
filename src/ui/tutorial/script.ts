/**
 * Eğitim senaryosu (GDD v0.8: av): hava ve Tamer pasifi olmadan, 3 slotluk sabit ellerle bir Kor Böceği
 * avlanır. Her tur tek bir fikir öğretir (dizme ve geçiş → sıra → Howl ve Isı); yaratığın canı, hedef
 * dizilimlerle 3. turda bayılacak şekilde seçilmiştir (27 + 44 + 29 hasar). `goal` verilen turda BAŞLAT
 * ancak hedef dizilimle açılır. Metinler kart adlarını içerikten alır; kart yeniden adlandırılırsa eğitim de güncel kalır.
 */
import type { HuntDef } from '../../core/types.ts'
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

/** Eğitim avının yaratığı: 90 can, her tur biraz daha sert Pençe. */
export const TUTORIAL_HUNT: HuntDef = {
  id: 'tutorial',
  card: 'cinder_beetle',
  region: content.regions[0].id,
  tier: 'ordinary',
  hp: 90,
  intents: [
    { kind: 'claw', damage: 3 },
    { kind: 'claw', damage: 4 },
    { kind: 'claw', damage: 5 },
  ],
  unlock: { kind: 'start' },
  pos: [0, 0],
  lore: '',
}

export const TUTORIAL: TutorialRound[] = [
  {
    title: 'Kartları diz',
    cards: ['magma_pup', 'clay_golem', 'bubble_fish'],
    intro: `Ava hoş geldin! Karşında bir ${n(TUTORIAL_HUNT.card)} var: canını 0'a indirirsen bayılır ve koleksiyonuna katılır. Elindeki tüm kartları yukarıdaki slotlara diz: bir kartı tutup boş slota sürükle ya da tıkla.`,
    playing:
      'Kartlar soldan sağa sırayla tetiklenir; bir tam sıraya geçiş denir. Her Strike yaratığa hasar verir (⚔) ve 1 dayanıklılık (🛡) harcar. Dayanıklılığı biten kart pasife geçer.',
    done: `Tur sonunda yaratık niyetini uyguladı: Pençe 3, Tamer'ın canından düştü. Sağ üstte her zaman yaratığın sıradaki niyeti yazar. ${n('bubble_fish')} erken bitti ama Last Breath ile son bir vuruş yaptı.`,
  },
  {
    title: 'Sıra önemlidir',
    cards: ['spark_fox', 'baby_dragon', 'torch_lizard'],
    intro: `Çoğu kart komşusuna ya da yerine bakar. ${n('spark_fox')}: sağındaki kart Dragon ise x2,5. ${n('torch_lizard')}: en soldaysa x2. Kartın üzerine gelirsen yeteneklerin açıklamasını görürsün.`,
    goal: (ids) => ids[0] === 'torch_lizard' && leftOf(ids, 'spark_fox', 'baby_dragon'),
    goalHint: `${n('torch_lizard')} en sola, ${n('spark_fox')} ise ${n('baby_dragon')} kartının hemen soluna.`,
    focus: ['spark_fox', 'torch_lizard'],
    playing: `${n('spark_fox')} her tetikte x2,5 alıyor, çünkü sağında bir Dragon var. Kartın altındaki tür etiketi (BEAST, DRAGON…) bu koşullar için önemlidir.`,
    done: 'Tur sonunda dizilimin, aynı elle bulunabilecek en iyi dizilimle karşılaştırılır. Yaratığın canı azaldı: bir tur daha!',
  },
  {
    title: 'Howl ve Isı',
    cards: ['coral_crab', 'ember_hedgehog', 'baby_dragon'],
    intro: `Howl tur başında bir kez çalışır: ${n('coral_crab')} sağındaki kartın dayanıklılığını +1 yapar, yani o kart bir kez daha vurur. Isı masada biriken ortak bir sayaçtır: ${n('ember_hedgehog')} ve ${n('baby_dragon')} Isı ekler, ${n('ember_hedgehog')} Isı kadar bonus alır.`,
    goal: (ids) => ids[0] === 'baby_dragon' && leftOf(ids, 'coral_crab', 'ember_hedgehog'),
    goalHint: `${n('baby_dragon')} en sola: Isı'yı erkenden başlatır. ${n('coral_crab')} ise ${n('ember_hedgehog')} kartının hemen soluna: fazladan tetik en çok Isı'dan beslenen karta yarar.`,
    focus: ['coral_crab', 'ember_hedgehog'],
    playing: 'Sağdaki kayıtta "↳" satırlarını izle: Howl\'un verdiği dayanıklılık ve biriken Isı orada yazar. Yaratığın canı biterse tur o anda biter: bayılan yaratık niyetini uygulayamaz.',
    done: 'Yaratık bayıldı! Gerçek avlarda 30 kartlık desteden 5\'erli eller gelir, en fazla 6 tur oynarsın. Yaratığın niyetine göre diz; Koruma üreten kartlar Tamer\'ı korur.',
  },
]
