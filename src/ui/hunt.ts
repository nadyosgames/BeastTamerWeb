import type { HuntOutcome } from '../core/hunt.ts'
import type { HuntDef, HuntTier, Intent, PreyTrait } from '../core/types.ts'
import { content } from './content.ts'
import { ELEMENT_LABEL } from './labels.ts'

/** Av arayüzünün metinleri: niyet, özellik, kademe ve sonuç etiketleri (tek kaynak). */

export const TIER_LABEL: Record<HuntTier, string> = {
  ordinary: 'Sıradan Av',
  hard: 'Zorlu Av',
  final: 'Bölge Finali',
  legendary: 'Efsanevi Av',
  mythic: 'Mitik Av',
  ancient: 'Kadim Av',
}

export const TIER_TEXT: Record<HuntTier, string> = {
  ordinary: 'Özellik yok, sade niyetler.',
  hard: 'Bir özellik ve daha sert niyetler. Doğru deste ve hava ister.',
  final: 'İki fazlı: canı yarıya inince niyetleri ve özellikleri değişir.',
  legendary: 'Kendi havasını getirir; canı bitince bir kez daha doğar.',
  mythic: 'Bölgeler arası; oyun kuralını büker.',
  ancient: 'Kuşatma: birkaç gün sürer, canı günler arasında kalıcıdır, her gün başka hava ve başka deste.',
}

export function intentName(intent: Intent): string {
  switch (intent.kind) {
    case 'claw':
      return `Pençe ${intent.damage}`
    case 'rend':
      return 'Yırtma'
    case 'tailSweep':
      return 'Kuyruk Savurma'
    case 'roar':
      return 'Kükreme'
    case 'evade':
      return 'Savuşturma'
    case 'recover':
      return `Toparlanma ${intent.amount}`
    case 'charge':
      return 'Şarj'
    case 'flee':
      return 'Kaçış Hazırlığı'
    case 'scorch':
      return 'Alev Yağmuru'
  }
}

/** Niyetin ne yaptığı (ikon tooltip'i ve av kartı). */
export function intentText(intent: Intent, charged = false): string {
  switch (intent.kind) {
    case 'claw':
      return charged
        ? `Tur sonunda Tamer'a ${intent.damage * 2} hasar (Şarj ile iki katı). Koruma emer; bu tur bayıltırsan vuramaz.`
        : `Tur sonunda Tamer'a ${intent.damage} hasar. Koruma emer; bu tur bayıltırsan vuramaz.`
    case 'rend':
      return `Tur başında ${intent.slot}. slottaki kart −1 dayanıklılık. Ward korur: oraya ucuz ya da Ward'lı bir kart koy.`
    case 'tailSweep':
      return `Tur başında en sağdaki ${intent.count} kart −1 dayanıklılık. Sağ uca dayanıklı kartlar koy.`
    case 'roar':
      return `${intent.slot}. slottaki kart ilk geçişte uyur. Oraya Slumber'lı ya da zayıf bir kart koy.`
    case 'evade':
      return 'Bu tur her geçişin ilk Strike\'ı boşa gider. Önce vuracak ucuz bir kart (Swift) yem olur.'
    case 'recover':
      return `Tur sonunda yaratık ${intent.amount} can kazanır. Bu tur fazladan vur.`
    case 'charge':
      return 'Saldırmaz; sonraki Pençe iki katı vurur. Ya iki turda bayılt ya da Koruma ayır.'
    case 'flee':
      return `Canı %${intent.belowPct}'un altındayken bu tur ${intent.damage} hasar alamazsa kaçar. Turun en güçlü dizilimini kur.`
    case 'scorch':
      return 'Tur başında tüm kartlar −1 dayanıklılık (en az 1). Ward korur.'
  }
}

export function traitName(t: PreyTrait): string {
  switch (t.kind) {
    case 'armor':
      return `Zırh ${t.amount}`
    case 'shell':
      return `Kabuk ${t.amount}`
    case 'veiled':
      return 'Yarı Saydam'
    case 'agile':
      return 'Çevik'
    case 'thorns':
      return `Diken ${t.amount}`
    case 'resist':
      return `${ELEMENT_LABEL[t.element]} Direnci`
    case 'weak':
      return `${ELEMENT_LABEL[t.element]} Zayıflığı`
  }
}

export function traitText(t: PreyTrait): string {
  switch (t.kind) {
    case 'armor': {
      const off = t.offIn?.length ? ` ${t.offIn.map((w) => content.weatherById.get(w)?.name ?? w).join(', ')} günde söner.` : ''
      return `Her vuruştan ${t.amount} düşer: az ve büyük vuruşlu kartlar (Overload, çarpanlar) işe yarar.${off}`
    }
    case 'shell':
      return `Her turun ilk ${t.amount} hasarı emilir.`
    case 'veiled':
      return '1. geçişte hasarın yarısı işler: dayanıklı ve Slumber\'lı kartlar işe yarar.'
    case 'agile':
      return 'Her tur Savuşturma: her geçişin ilk Strike\'ı boşa gider.'
    case 'thorns':
      return `Turda Strike yapan her kart Tamer'a ${t.amount} hasar yansıtır (kart başına bir kez, tur sonunda; Koruma emer).`
    case 'resist':
      return `${ELEMENT_LABEL[t.element]} vuruşları −%${t.pct}.`
    case 'weak':
      return `${ELEMENT_LABEL[t.element]} vuruşları +%${t.pct}.`
  }
}

export const OUTCOME_TITLE: Record<HuntOutcome, string> = {
  captured: 'YAKALANDI!',
  escaped: 'KAÇTI',
  fled: 'KAÇTI',
  tamerDown: 'TAMER DÜŞTÜ',
  nightfall: 'GECE ÇÖKTÜ',
}

export function huntName(hunt: HuntDef): string {
  return content.card(hunt.card).name
}

export function weatherName(id: string): string {
  return content.weatherById.get(id)?.name ?? id
}

export const STARS = (n: number, of = 3) => '★'.repeat(n) + '☆'.repeat(Math.max(0, of - n))
