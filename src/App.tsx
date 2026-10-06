import { useNav } from './state/nav.ts'
import { ArtStudio } from './ui/screens/ArtStudio.tsx'
import { LabScreen } from './ui/screens/LabScreen.tsx'
import { MainMenu } from './ui/screens/MainMenu.tsx'
import { ExpeditionScreen } from './ui/screens/ExpeditionScreen.tsx'
import { HuntScreen } from './ui/screens/HuntScreen.tsx'
import { Stage } from './ui/Stage.tsx'
import { CollectionScreen } from './ui/screens/CollectionScreen.tsx'
import { MarketScreen } from './ui/screens/MarketScreen.tsx'

export default function App() {
  const screen = useNav((s) => s.screen)
  return (
    <Stage>
      {screen === 'menu' && <MainMenu />}
      {screen === 'play' && <ExpeditionScreen />}
      {screen === 'run' && <HuntScreen />}
      {screen === 'lab' && <LabScreen />}
      {screen === 'art' && <ArtStudio />}
      {(screen === 'collection' || screen === 'decks') && <CollectionScreen key={screen} decks={screen === 'decks'} />}
      {screen === 'market' && <MarketScreen />}
    </Stage>
  )
}
