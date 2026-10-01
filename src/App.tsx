import { useNav } from './state/nav.ts'
import { ArtStudio } from './ui/screens/ArtStudio.tsx'
import { LabScreen } from './ui/screens/LabScreen.tsx'
import { MainMenu } from './ui/screens/MainMenu.tsx'
import { Stage } from './ui/Stage.tsx'

export default function App() {
  const screen = useNav((s) => s.screen)
  return (
    <Stage>
      {screen === 'menu' && <MainMenu />}
      {screen === 'lab' && <LabScreen />}
      {screen === 'art' && <ArtStudio />}
    </Stage>
  )
}
