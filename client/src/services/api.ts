
export interface Person {
    id: string
    data: Record<string, string>
    rels: {
        parents: string[]
        spouses: string[]
        children: string[]
    }
}

export interface TreePayload {
    data: Person[]
    config: any
    meta: any
}

export interface SearchResult {
    id: string
    label: string
    metadata?: any
}

export async function fetchTreeSummary(): Promise<SearchResult[]> {
    const res = await fetch('/api/tree/summary')
    if (!res.ok) throw new Error('Failed to fetch summary')
    return res.json()
}

export async function fetchSubtree(mainId: string, depth = 2): Promise<TreePayload> {
    const params = new URLSearchParams({
        mode: 'subtree',
        mainId,
        ancestryDepth: depth.toString(),
        progenyDepth: depth.toString(),
        includeSiblings: 'true',
        includeSpouses: 'true'
    })
    const res = await fetch(`/api/tree?${params}`)
    if (!res.ok) throw new Error('Failed to fetch subtree')
    return res.json()
}

export async function searchPersons(query: string): Promise<SearchResult[]> {
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=15`)
    if (!res.ok) throw new Error('Search failed')
    return res.json()
}
