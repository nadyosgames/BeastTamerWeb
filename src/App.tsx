import { useNav } from './state/nav.ts'
import { ArtStudio } from './ui/screens/ArtStudio.tsx'
import { LabScreen } from './ui/screens/LabScreen.tsx'
import { MainMenu } from './ui/screens/MainMenu.tsx'
import { PlanDayScreen } from './ui/screens/PlanDayScreen.tsx'
import { RunScreen } from './ui/screens/RunScreen.tsx'
import { Stage } from './ui/Stage.tsx'
import { CollectionScreen } from './ui/screens/CollectionScreen.tsx'
import { MarketScreen } from './ui/screens/MarketScreen.tsx'

export default function App() {
  const screen = useNav((s) => s.screen)
  return (
    <Stage>
      {screen === 'menu' && <MainMenu />}
      {screen === 'play' && <PlanDayScreen />}
      {screen === 'run' && <RunScreen />}
      {screen === 'lab' && <LabScreen />}
      {screen === 'art' && <ArtStudio />}
      {(screen === 'collection' || screen === 'decks') && <CollectionScreen key={screen} decks={screen === 'decks'} />}
      {screen === 'market' && <MarketScreen />}
    </Stage>
  )
}
