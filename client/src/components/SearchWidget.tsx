import { useState, useRef, useEffect } from 'react'
import { searchPersons, type SearchResult } from '../services/api'

interface SearchWidgetProps {
    onSelect: (personId: string) => void
}

export function SearchWidget({ onSelect }: SearchWidgetProps) {
    const [query, setQuery] = useState('')
    const [results, setResults] = useState<SearchResult[]>([])
    const [isOpen, setIsOpen] = useState(false)
    const debounceRef = useRef<number | null>(null)

    useEffect(() => {
        if (!query.trim()) {
            setResults([])
            setIsOpen(false)
            return
        }

        if (debounceRef.current) clearTimeout(debounceRef.current)

        debounceRef.current = setTimeout(async () => {
            try {
                const hits = await searchPersons(query)
                setResults(hits)
                setIsOpen(hits.length > 0)
            } catch (e) {
                console.error(e)
            }
        }, 300) as unknown as number

    }, [query])

    return (
        <div className="search-panel">
            <h3 className="search-title">Rechercher</h3>
            <div className="search-widget f3-search-wrapper">
                <input
                    type="text"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Nom, Prénom..."
                    onFocus={() => setIsOpen(results.length > 0)}
                    onBlur={() => setTimeout(() => setIsOpen(false), 200)}
                />

                {isOpen && (
                    <div className="f3-search-results">
                        {results.map(res => (
                            <div
                                key={res.id}
                                className="f3-search-result-item"
                                onClick={() => {
                                    setQuery(res.label)
                                    onSelect(res.id)
                                    setIsOpen(false)
                                }}
                            >
                                <strong>{res.label}</strong>
                                {res.metadata && <small>{JSON.stringify(res.metadata).slice(0, 40)}</small>}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
