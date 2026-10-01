import { create } from 'zustand'

export type Screen = 'menu' | 'lab' | 'art'
const SCREENS: Screen[] = ['menu', 'lab', 'art']

const fromHash = (): Screen => {
  const h = window.location.hash.slice(1) as Screen
  return SCREENS.includes(h) ? h : 'menu'
}

/** Ekran yönlendirme. Hash ile senkron: sayfa yenilenince aynı ekranda kalır (#lab, #art). */
export const useNav = create<{ screen: Screen; go: (s: Screen) => void }>((set) => ({
  screen: fromHash(),
  go: (screen) => {
    window.location.hash = screen === 'menu' ? '' : screen
    set({ screen })
  },
}))

window.addEventListener('hashchange', () => useNav.setState({ screen: fromHash() }))
