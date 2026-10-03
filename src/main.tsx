import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './ui/styles/global.css'
import App from './App.tsx'
import './ui/styles/retro.css'
import './ui/styles/reference.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
