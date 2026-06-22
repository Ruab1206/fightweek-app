import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App'
import CataloguePage from './pages/CataloguePage'
import FighterProfilePage from './pages/FighterProfilePage'
import ProfileEditPage from './pages/ProfileEditPage'
import './index.css'
import { ThemeProvider } from './hooks/useTheme'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/catalogue" element={<CataloguePage />} />
          <Route path="/fighter/:key" element={<FighterProfilePage />} />
          <Route path="/profile" element={<ProfileEditPage />} />
          <Route path="/*" element={<App />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>,
)
