import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { SiteShell } from './components/Layout/SiteShell'
import { PrivacyPolicy } from './pages/PrivacyPolicy'
import { TermsOfService } from './pages/TermsOfService'
import { BookDemo } from './pages/BookDemo'
import { Contact } from './pages/Contact'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SiteShell />} />
        <Route path="/privacy_policy" element={<PrivacyPolicy />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/TOS" element={<TermsOfService />} />
        <Route path="/terms-of-service" element={<TermsOfService />} />
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/book-demo" element={<BookDemo />} />
        <Route path="/demo" element={<BookDemo />} />
        <Route path="/contact" element={<Contact />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
