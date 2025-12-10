import { useEffect, useState } from 'react'
import { FamilyChart } from './components/FamilyChart'
import { fetchSubtree, fetchTreeSummary, Person } from './services/api'
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

  if (loading) return <div className="chart-loading">Chargement...</div>
  if (error) return <div className="error">{error}</div>

  return (
    <div className="layout">
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
