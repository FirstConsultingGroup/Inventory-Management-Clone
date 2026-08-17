import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './globals.css'
import App from './App.tsx'
import { Toaster } from 'react-hot-toast'
import ReduxProvider from './components/ReduxProvider.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ReduxProvider>
      <App />
      <Toaster />
    </ReduxProvider>
  </StrictMode>,
)
