/**
 * GEDCOM Parser & Generator
 * Handles transformation between GEDCOM text format and internal Family Tree JSON format.
 */

window.GedcomParser = class GedcomParser {
  constructor() {
    this.buffer = ''
  }

  /**
   * Parse GEDCOM text content into internal Person objects
   * @param {string} content - The raw GEDCOM file content
   * @returns {Array} Array of person objects with id, data, rels
   */
  parse(content) {
    const lines = content.split(/\r?\n/)
    const records = []
    let currentRecord = null

    // Helper to process line structure: Level, Tag, Value
    // Example: "1 NAME John /Doe/" -> { level: 1, tag: 'NAME', value: 'John /Doe/' }
    const parseLine = (line) => {
      const match = line.match(/^\s*(\d+)\s+(@\w+@|\w+)(\s+(.*))?$/)
      if (!match) return null
      return {
        level: parseInt(match[1], 10),
        tag: match[2],
        value: match[4] || ''
      }
    }

    // Pass 1: Group lines into records (INDI, FAM, etc.)
    lines.forEach(line => {
      if (!line.trim()) return
      const parsed = parseLine(line)
      if (!parsed) return

      if (parsed.level === 0) {
        if (currentRecord) records.push(currentRecord)
        currentRecord = { ...parsed, children: [] }
      } else if (currentRecord) {
        currentRecord.children.push(parsed)
      }
    })
    if (currentRecord) records.push(currentRecord)

    // Pass 2: Process records into People and Families
    const people = new Map()
    const families = new Map()

    records.forEach(rec => {
      const id = rec.tag.replace(/@/g, '')
      const type = rec.value.trim() // 'INDI' or 'FAM'

      if (type === 'INDI') {
        people.set(id, this._processIndividual(rec))
      } else if (type === 'FAM') {
        families.set(id, this._processFamily(rec))
      }
    })

    // Pass 3: Link relationships using Family records
    families.forEach((fam, famId) => {
      const { husband, wife, children } = fam
      
      // Link Parents (Husband/Wife) to each other is NOT strictly needed in this model 
      // as we link parents -> children and children -> parents.
      
      // Link Parents to Children
      const parents = [husband, wife].filter(Boolean)
      children.forEach(childId => {
        const child = people.get(childId)
        if (child) {
          // Add parents to child
          parents.forEach(pId => {
            if (!child.rels.parents.includes(pId)) child.rels.parents.push(pId)
          })
          
          // Add child to parents
          parents.forEach(pId => {
            const parent = people.get(pId)
            if (parent) {
               if (!parent.rels.children.includes(childId)) parent.rels.children.push(childId)
               
               // If there is a co-parent (the other parent), link them as spouses if desired
               const spouseId = parents.find(id => id !== pId)
               if (spouseId) {
                 if (!parent.rels.spouses) parent.rels.spouses = []
                 if (!parent.rels.spouses.includes(spouseId)) parent.rels.spouses.push(spouseId)
               }
            }
          })
        }
      })
    })

    return Array.from(people.values())
  }

  _processIndividual(record) {
    const id = record.tag.replace(/@/g, '')
    const person = {
      id: id,
      data: {
        'first name': 'Unknown',
        'last name': '',
        'gender': 'M' // Default
      },
      rels: {
        parents: [],
        children: [],
        spouses: [] 
      }
    }

    let currentTag = null

    record.children.forEach(line => {
      // Basic Tag handling
      switch (line.tag) {
        case 'NAME': {
          const nameParts = line.value.split('/').map(s => s.trim())
          person.data['first name'] = nameParts[0] || 'Unknown'
          if (nameParts[1]) person.data['last name'] = nameParts[1]
          break
        }
        case 'SEX':
          person.data['gender'] = line.value === 'F' ? 'F' : 'M'
          break
        case 'BIRT':
          currentTag = 'BIRT'
          break
        case 'DEAT':
          currentTag = 'DEAT'
          break
        case 'DATE':
          if (currentTag === 'BIRT') person.data['birth date'] = line.value
          if (currentTag === 'DEAT') person.data['death date'] = line.value
          break
        case 'PLAC':
          if (currentTag === 'BIRT') person.data['birth place'] = line.value
          if (currentTag === 'DEAT') person.data['death place'] = line.value
          break
        case 'OCCU':
          person.data['job'] = line.value
          break
        case 'NOTE':
           // Basic note support
           if (!person.data['bio']) person.data['bio'] = line.value 
           else person.data['bio'] += '\n' + line.value
           break
      }
      // Reset context if line level is 1 and it's not a container tag like BIRT/DEAT
      if (line.level === 1 && !['BIRT', 'DEAT'].includes(line.tag)) {
        currentTag = null
      }
    })

    return person
  }

  _processFamily(record) {
    const fam = {
      husband: null,
      wife: null,
      children: []
    }

    record.children.forEach(line => {
      const val = line.value.replace(/@/g, '')
      switch (line.tag) {
        case 'HUSB': fam.husband = val; break;
        case 'WIFE': fam.wife = val; break;
        case 'CHIL': fam.children.push(val); break;
      }
    })
    return fam
  }

  /**
   * Generate GEDCOM text from internal data
   * @param {Array} data - Array of person objects
   * @returns {string} GEDCOM format string
   */
  generate(data) {
    let ged = ''
    const date = new Date()
    const now = `${date.getDate()} ${date.toLocaleString('en-US', { month: 'short' }).toUpperCase()} ${date.getFullYear()}`
    
    // Header
    ged += `0 HEAD\n`
    ged += `1 SOUR FamilyTreeBuilder\n`
    ged += `2 VERS 1.0\n`
    ged += `1 DATE ${now}\n`
    ged += `1 GEDC\n`
    ged += `2 VERS 5.5.1\n`
    ged += `2 FORM LINEAGE-LINKED\n`
    ged += `1 CHAR UTF-8\n`

    // Individuals
    const familyMap = new Map() // Key: Set of parent IDs, Value: FamID

    data.forEach(p => {
      ged += `0 @${p.id}@ INDI\n`
      
      // Name
      const fname = p.data['first name'] || ''
      const lname = p.data['last name'] ? `/${p.data['last name']}/` : '//'
      ged += `1 NAME ${fname} ${lname}\n`
      if (p.data['first name']) ged += `2 GIVN ${p.data['first name']}\n`
      if (p.data['last name']) ged += `2 SURN ${p.data['last name']}\n`

      // Gender
      ged += `1 SEX ${p.data['gender'] || 'U'}\n`

      // Events
      if (p.data['birth date'] || p.data['birth place']) {
        ged += `1 BIRT\n`
        if (p.data['birth date']) ged += `2 DATE ${p.data['birth date']}\n`
        if (p.data['birth place']) ged += `2 PLAC ${p.data['birth place']}\n`
      }

      if (p.data['death date'] || p.data['death place']) {
        ged += `1 DEAT\n`
        if (p.data['death date']) ged += `2 DATE ${p.data['death date']}\n`
        if (p.data['death place']) ged += `2 PLAC ${p.data['death place']}\n`
      }

      if (p.data['job']) ged += `1 OCCU ${p.data['job']}\n`
      if (p.data['bio']) ged += `1 NOTE ${p.data['bio'].replace(/\n/g, '\n2 CONC ')}\n`

      // Collect families information based on children
      // If this person has children, we need to create/find a FAM record where this person is a parent
      // Note: This simple logic assumes a person forms families with their spouses.
      // A more robust way is to group children by their parents.
      
      // We'll reconstruct FAM records by iterating children and finding their parents. Use a second pass for FAM links.
    })

    // Families Generation
    // Strategy: iterate all people, look at their 'parents'. 
    // Group siblings by same set of parents.
    const families = []
    
    // key: "p1_p2" (sorted ids), value: { h: p1, w: p2, kids: [] }
    const famGroups = {} 

    data.forEach(child => {
      const parents = child.rels.parents || []
      if (parents.length > 0) {
        // Sort parents to create a consistent key
        const sortedParents = [...parents].sort()
        const key = sortedParents.join('_')
        
        if (!famGroups[key]) {
          famGroups[key] = { parents: sortedParents, children: [] }
        }
        famGroups[key].children.push(child.id)
      }
    })

    let famCounter = 1

    Object.values(famGroups).forEach(group => {
       const famId = `@F${famCounter++}@`
       
       // Output FAM record
       ged += `0 ${famId} FAM\n`
       
       // Assign parents (Guess husband/wife based on gender if available, otherwise order)
       // We need to look up parent data to check gender
       const parentObjs = group.parents.map(pid => data.find(d => d.id === pid)).filter(Boolean)
       
       let husb = parentObjs.find(p => p.data.gender === 'M')
       let wife = parentObjs.find(p => p.data.gender === 'F')
       
       // Fallbacks if genders correspond to same role or undefined
       const assignedIds = new Set()
       
       if (husb) {
         ged += `1 HUSB @${husb.id}@\n`
         assignedIds.add(husb.id)
       }
       if (wife && (!husb || wife.id !== husb.id)) {
         ged += `1 WIFE @${wife.id}@\n`
         assignedIds.add(wife.id)
       }
       
       // If we have remaining parents not assigned (e.g. same sex or unknown), dump them as HUSB or WIFE arbitrarily for now
       // or just list them. Standard GEDCOM expects HUSB/WIFE.
       parentObjs.forEach(p => {
         if (!assignedIds.has(p.id)) {
            // Defaulting to HUSB for extras if slot open, else WIFE? 
            // Better strategy: Just list them.
            if (!husb) { ged += `1 HUSB @${p.id}@\n`; husb = true; }
            else if (!wife) { ged += `1 WIFE @${p.id}@\n`; wife = true; }
         }
       })

       // Children
       group.children.forEach(cid => {
         ged += `1 CHIL @${cid}@\n`
       })
       
       // Now we must go back and add FAMC to children and FAMS to parents
       // Since we are streaming the string, this is tricky. 
       // Actually, we should have generated the INDI records *with* the FAM links.
       // So we need to calculate families *before* generating INDI records.
    })

    // RE-RUN Generation with pre-calculated families
    // Reset GEDCOM string for body
    ged = ''
    // Header repeat
    ged += `0 HEAD\n`
    ged += `1 SOUR FamilyTreeBuilder\n`
    ged += `2 VERS 1.0\n`
    ged += `1 DATE ${now}\n`
    ged += `1 GEDC\n`
    ged += `2 VERS 5.5.1\n`
    ged += `2 FORM LINEAGE-LINKED\n`
    ged += `1 CHAR UTF-8\n`
    
    // Assign Family IDs to groups
    Object.keys(famGroups).forEach((key, index) => {
      famGroups[key].id = `@F${index + 1}@`
    })

    // Helper to find FAMS (Family Spouse) for a person
    const getFAMS = (pid) => {
       const fams = []
       Object.values(famGroups).forEach(g => {
         if (g.parents.includes(pid)) fams.push(g.id)
       })
       return fams
    }

    // Helper to find FAMC (Family Child) for a person
    const getFAMC = (cid) => {
       const fams = []
       Object.values(famGroups).forEach(g => {
         if (g.children.includes(cid)) fams.push(g.id)
       })
       return fams
    }

    data.forEach(p => {
      ged += `0 @${p.id}@ INDI\n`
      const name = p.data['first name'] || 'Unknown'
      const surname = p.data['last name'] ? `/${p.data['last name']}/` : '//'
      ged += `1 NAME ${name} ${surname}\n`
      ged += `1 SEX ${p.data['gender'] || 'U'}\n`
      
      if (p.data['birth date'] || p.data['birth place']) {
        ged += `1 BIRT\n`
        if (p.data['birth date']) ged += `2 DATE ${p.data['birth date']}\n`
        if (p.data['birth place']) ged += `2 PLAC ${p.data['birth place']}\n`
      }
      if (p.data['death date'] || p.data['death place']) {
        ged += `1 DEAT\n`
        if (p.data['death date']) ged += `2 DATE ${p.data['death date']}\n`
        if (p.data['death place']) ged += `2 PLAC ${p.data['death place']}\n`
      }
      if (p.data['job']) ged += `1 OCCU ${p.data['job']}\n`
      
      // Link to Families
      const famc = getFAMC(p.id)
      famc.forEach(fid => ged += `1 FAMC ${fid}\n`)
      
      const fams = getFAMS(p.id)
      fams.forEach(fid => ged += `1 FAMS ${fid}\n`)
    })

    // Output Families
    Object.values(famGroups).forEach(g => {
      ged += `0 ${g.id} FAM\n`
       const parentObjs = g.parents.map(pid => data.find(d => d.id === pid)).filter(Boolean)
       const husb = parentObjs.find(p => p.data.gender === 'M')
       const wife = parentObjs.find(p => p.data.gender === 'F')
       
       const used = new Set()
       if (husb) { ged += `1 HUSB @${husb.id}@\n`; used.add(husb.id); }
       if (wife) { ged += `1 WIFE @${wife.id}@\n`; used.add(wife.id); }
       
       parentObjs.forEach(p => {
         if (!used.has(p.id)) {
           // Fallback for same-sex or unknown gender parents
           ged += `1 HUSB @${p.id}@\n` 
         }
       })

       g.children.forEach(cid => {
         ged += `1 CHIL @${cid}@\n`
       })
    })

    ged += '0 TRLR\n'
    return ged
  }
}
