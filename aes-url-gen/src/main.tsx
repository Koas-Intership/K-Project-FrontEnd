import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import Generator from './pages/Generator.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Generator />
  </StrictMode>,
)
