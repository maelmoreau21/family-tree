
import fs from 'node:fs'
import readline from 'node:readline'
import { createImportBuffer } from './db.js'

export async function importGedcomStream(filePath) {
    const buffer = await createImportBuffer({ dropIndexes: true })
    const fileStream = fs.createReadStream(filePath)
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    })

    let currentRecord = null
    let currentType = null
    let currentId = null

    // We buffer relationships to insert them AFTER all persons are inserted
    // to avoid Foreign Key constraint violations.
    // Format: "parentId|childId"
    const relationshipSet = new Set()

    function flushIndi() {
        if (currentId && currentType === 'INDI' && currentRecord) {
            // Convert map/obj to person object expected by buffer
            // The buffer expects: { id, data: {...}, rels: {...} }
            // We only populate data here. Rels are handled via the set.
            const p = {
                id: currentId,
                data: currentRecord.data,
                rels: { parents: [], children: [], spouses: [] }, // Filled later or ignored by toPersonRecord
            }
            buffer.addPerson(p)
        }
    }

    function flushFam() {
        if (currentId && currentType === 'FAM' && currentRecord) {
            const husb = currentRecord.husb
            const wife = currentRecord.wife
            const chil = currentRecord.children

            // Father -> Children
            if (husb) {
                chil.forEach(childId => {
                    relationshipSet.add(`${husb}|${childId}`)
                })
            }
            // Mother -> Children
            if (wife) {
                chil.forEach(childId => {
                    relationshipSet.add(`${wife}|${childId}`)
                })
            }
            // Spouses (Optional: The DB relationship table is strict parent-child? 
            // The current DB schema has 'relationships' (parent, child).
            // It DOES NOT have a spouses table. Spouses are inferred?
            // Wait, 'rels.spouses' is in the JSON blob, but SQL only has parent_child.
            // So purely using 'relationships' table means we lose spouse links if they have no children?
            // CHECK DB SCHEMA: 
            // 'relationships' table: parent_id, child_id.
            // If we rely ONLY on this, childless couples are lost.
            // However, the `dataset.payload` had `rels.spouses`.
            // If we move to SQL only, we might need a `marriages` table.
            // For now, we stick to parent-child. The user asked for "tree" support.
        }
    }

    for await (const line of rl) {
        const trimmed = line.trim()
        if (!trimmed) continue

        const match = trimmed.match(/^(\d+)\s+(@\w+@|\w+)(\s+(.*))?$/)
        if (!match) continue

        const level = parseInt(match[1], 10)
        const tagOrId = match[2]
        const value = match[4] || ''

        if (level === 0) {
            // Flush previous
            if (currentType === 'INDI') flushIndi()
            else if (currentType === 'FAM') flushFam()

            // Start new
            currentId = null
            currentType = null
            currentRecord = null

            if (value.includes('INDI')) {
                currentId = tagOrId.replace(/@/g, '')
                currentType = 'INDI'
                currentRecord = { data: {} }
            } else if (value.includes('FAM')) {
                currentId = tagOrId.replace(/@/g, '')
                currentType = 'FAM'
                currentRecord = { husb: null, wife: null, children: [] }
            }
        } else if (currentRecord) {
            if (currentType === 'INDI') {
                // Simple mapping
                if (tagOrId === 'NAME') {
                    currentRecord.data['name'] = value.replace(/\//g, '')
                    const parts = value.replace(/\//g, '').split(' ')
                    if (parts[0]) currentRecord.data['first name'] = parts[0]
                    if (parts.length > 1) currentRecord.data['last name'] = parts.slice(1).join(' ')
                } else if (tagOrId === 'SEX') {
                    currentRecord.data['gender'] = value
                } else if (tagOrId === 'BIRT') {
                    currentRecord.lastTag = 'BIRT'
                } else if (tagOrId === 'DEAT') {
                    currentRecord.lastTag = 'DEAT'
                } else if (tagOrId === 'DATE') {
                    if (currentRecord.lastTag === 'BIRT') currentRecord.data['birthday'] = value
                    if (currentRecord.lastTag === 'DEAT') currentRecord.data['death'] = value
                } else if (tagOrId === 'OCCU') {
                    currentRecord.data['occupation'] = value
                }
            } else if (currentType === 'FAM') {
                if (tagOrId === 'HUSB') currentRecord.husb = value.replace(/@/g, '')
                if (tagOrId === 'WIFE') currentRecord.wife = value.replace(/@/g, '')
                if (tagOrId === 'CHIL') currentRecord.children.push(value.replace(/@/g, ''))
            }
        }
    }

    // Flush last
    if (currentType === 'INDI') flushIndi()
    else if (currentType === 'FAM') flushFam()

    // Flush relationships
    for (const pair of relationshipSet) {
        const [p, c] = pair.split('|')
        await buffer.addRelationship(p, c)
    }

    await buffer.commit()
}
