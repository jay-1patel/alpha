import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { LeewayThemeProvider } from './contexts/LeewayThemeContext'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <LeewayThemeProvider>
      <App />
    </LeewayThemeProvider>
  </React.StrictMode>,
)
