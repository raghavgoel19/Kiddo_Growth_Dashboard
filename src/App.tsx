import { Navigate, Route, Routes } from 'react-router-dom'
import Dashboard from './pages/Dashboard'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/full" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
