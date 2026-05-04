import { Routes, Route } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { HomePage } from '@/pages/HomePage'
import { SearchPage } from '@/pages/SearchPage'
import { MethodDetailPage } from '@/pages/MethodDetailPage'
import { ImpactAnalysisPage } from '@/pages/ImpactAnalysisPage'
import { MethodTablePage } from '@/pages/MethodTablePage'
import { NotFoundPage } from '@/pages/NotFoundPage'

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/method" element={<MethodDetailPage />} />
        <Route path="/method/:entityId" element={<MethodDetailPage />} />
        <Route path="/impact" element={<ImpactAnalysisPage />} />
        <Route path="/table-access" element={<MethodTablePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
