import { useEffect, useState } from 'react'
import { FamilyChart } from './components/FamilyChart'
import { fetchSubtree, fetchTreeSummary, type Person } from './services/api'
import { SearchWidget } from './components/SearchWidget'
import './index.css'

function App() {
  const [data, setData] = useState<Person[]>([])
  const [mainId, setMainId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function init() {
      try {
        // 1. Get Summary to find a main ID (or use first one)
        const summary = await fetchTreeSummary()
        if (summary.length === 0) {
          setLoading(false)
          return
        }

        // Prefer one marked as 'main' if endpoints supported it, but summary is just list
        // We'll pick the first one for now or 'unknown-person' if exists?
        const initialId = summary[0].id
        setMainId(initialId)

        // 2. Load Subtree
        const payload = await fetchSubtree(initialId)
        setData(payload.data)
      } catch (err) {
        setError(String(err))
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  const handleSearchSelect = async (selectedId: string) => {
    setLoading(true)
    try {
      const payload = await fetchSubtree(selectedId)
      // Merge Logic: simple array concatenation + dedup
      setData(prev => {
        const seen = new Set(prev.map(p => p.id))
        const newOnes = payload.data.filter(p => !seen.has(p.id))
        return [...prev, ...newOnes]
      })
      setMainId(selectedId)
    } catch (e) {
      console.error(e)
      setError('Impossible de charger ce profil')
    } finally {
      setLoading(false)
    }
  }

  if (loading && data.length === 0) return <div className="chart-loading">Chargement...</div>
  if (error) return <div className="error">{error}</div>

  return (
    <div className="layout">
      {/* Sidebar Overlay */}
      <div className="controls" style={{ transform: 'none', opacity: 1, left: 20, top: 20 }}>
        <div className="search-panel">
          <SearchWidget onSelect={handleSearchSelect} />
        </div>
      </div>

      <div className="workspace">
        <FamilyChart
          data={data}
          mainId={mainId}
          config={{
            orientation: 'vertical',
            scale: 1,
            cardXSpacing: 250,
            cardYSpacing: 150
          }}
        />
      </div>
    </div>
  )
}

export default App
