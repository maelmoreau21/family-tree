
/**
 * Simple GEDCOM Parser and Generator
 */

function parseGedcom(content) {
    const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
    const persons = {};
    const families = {};
    let current = null;
    let currentType = null;

    for (const line of lines) {
        const match = line.match(/^(\d+)\s+(@\w+@|\w+)(?:\s+(.*))?$/);
        if (!match) continue;

        const level = parseInt(match[1], 10);
        const tagOrId = match[2];
        const value = match[3] || '';

        if (level === 0) {
            if (tagOrId.startsWith('@')) {
                const id = tagOrId.replace(/@/g, '');
                if (value === 'INDI') {
                    current = { id, data: { gender: '' }, rels: { spouses: [], children: [], parents: [] } };
                    persons[id] = current;
                    currentType = 'INDI';
                } else if (value === 'FAM') {
                    current = { id, husb: null, wife: null, children: [] };
                    families[id] = current;
                    currentType = 'FAM';
                } else {
                    current = null;
                    currentType = null;
                }
            } else {
                current = null;
                currentType = null;
            }
        } else if (current) {
            if (currentType === 'INDI') {
                switch (tagOrId) {
                    case 'NAME':
                        const parts = value.split('/');
                        current.data['first name'] = parts[0] ? parts[0].trim() : '';
                        if (parts[1]) current.data['last name'] = parts[1].trim();
                        break;
                    case 'SEX':
                        current.data.gender = value === 'M' ? 'M' : (value === 'F' ? 'F' : '');
                        break;
                    case 'BIRT':
                        current._nextDateType = 'birthday';
                        current._nextPlaceType = 'birthplace';
                        break;
                    case 'DEAT':
                        current._nextDateType = 'death';
                        current._nextPlaceType = 'deathplace';
                        break;
                    case 'DATE':
                        if (current._nextDateType) {
                            current.data[current._nextDateType] = value;
                            delete current._nextDateType;
                        }
                        break;
                    case 'PLAC':
                        if (current._nextPlaceType) {
                            current.data[current._nextPlaceType] = value;
                            delete current._nextPlaceType;
                        }
                        break;
                    case 'NOTE':
                        current.data.bio = (current.data.bio ? current.data.bio + '\n' : '') + value;
                        break;
                }
            } else if (currentType === 'FAM') {
                switch (tagOrId) {
                    case 'HUSB':
                        current.husb = value.replace(/@/g, '');
                        break;
                    case 'WIFE':
                        current.wife = value.replace(/@/g, '');
                        break;
                    case 'CHIL':
                        current.children.push(value.replace(/@/g, ''));
                        break;
                }
            }
        }
    }

    // Convert to app format
    const personList = Object.values(persons);

    // Link relationships
    Object.values(families).forEach(fam => {
        const father = persons[fam.husb];
        const mother = persons[fam.wife];
        const children = fam.children.map(cid => persons[cid]).filter(Boolean);

        if (father && mother) {
            if (!father.rels.spouses.includes(mother.id)) father.rels.spouses.push(mother.id);
            if (!mother.rels.spouses.includes(father.id)) mother.rels.spouses.push(father.id);
        }

        children.forEach(child => {
            if (father) {
                if (!child.rels.parents.includes(father.id)) child.rels.parents.push(father.id);
                if (!father.rels.children.includes(child.id)) father.rels.children.push(child.id);
            }
            if (mother) {
                if (!child.rels.parents.includes(mother.id)) child.rels.parents.push(mother.id);
                if (!mother.rels.children.includes(child.id)) mother.rels.children.push(child.id);
            }
        });
    });

    // Cleanup temporary fields
    personList.forEach(p => {
        delete p._nextDateType;
        delete p._nextPlaceType;
    });

    return { data: personList, config: {} };
}

function generateGedcom(data, rootId = null, direction = null) {
    // Filter data if rootId and direction are provided (TODO: implement filtering logic if needed here, or pass filtered data)
    // For now, we assume 'data' is already the set of persons we want to export.

    const persons = data;
    const families = {};
    let famCounter = 1;

    // Helper to get or create family
    const getFamily = (p1, p2) => {
        const id1 = p1 < p2 ? p1 : p2;
        const id2 = p1 < p2 ? p2 : p1;
        const key = `${id1}_${id2}`;
        if (!families[key]) {
            families[key] = { id: `F${famCounter++}`, husb: null, wife: null, children: [] };
        }
        return families[key];
    };

    // Build families
    persons.forEach(p => {
        // As parent (spouse)
        p.rels.spouses.forEach(spouseId => {
            // Avoid duplicates by only processing if p.id < spouseId
            if (p.id < spouseId) {
                const fam = getFamily(p.id, spouseId);
                const spouse = persons.find(s => s.id === spouseId);

                // Try to assign HUSB/WIFE based on gender
                if (p.data.gender === 'M') fam.husb = p.id;
                else if (p.data.gender === 'F') fam.wife = p.id;
                else if (!fam.husb) fam.husb = p.id;
                else fam.wife = p.id;

                if (spouse) {
                    if (spouse.data.gender === 'M') fam.husb = spouse.id;
                    else if (spouse.data.gender === 'F') fam.wife = spouse.id;
                    else if (!fam.husb) fam.husb = spouse.id;
                    else fam.wife = spouse.id;
                }
            }
        });

        // As child
        if (p.rels.parents.length > 0) {
            // Find the family of parents
            // This is tricky if parents are not married or multiple sets. 
            // Simplified: group by first two parents found.
            if (p.rels.parents.length >= 2) {
                const p1 = p.rels.parents[0];
                const p2 = p.rels.parents[1];
                const fam = getFamily(p1, p2);
                if (!fam.children.includes(p.id)) fam.children.push(p.id);
            } else if (p.rels.parents.length === 1) {
                // Single parent case - not easily representable in standard FAM without a spouse
                // We might skip or create a dummy family. 
                // For now, let's skip single parent links in FAM to keep it simple, 
                // or we'd need to create a family with only one parent.
            }
        }
    });

    let out = [];
    out.push('0 HEAD');
    out.push('1 SOUR FamilyTreeApp');
    out.push('1 GEDC');
    out.push('2 VERS 5.5.1');
    out.push('2 FORM LINEAGE-LINKED');
    out.push('1 CHAR UTF-8');

    persons.forEach(p => {
        out.push(`0 @${p.id}@ INDI`);
        const name = `${p.data['first name'] || ''} /${p.data['last name'] || ''}/`;
        out.push(`1 NAME ${name.trim()}`);
        if (p.data.gender) out.push(`1 SEX ${p.data.gender}`);

        if (p.data.birthday || p.data.birthplace) {
            out.push('1 BIRT');
            if (p.data.birthday) out.push(`2 DATE ${p.data.birthday}`);
            if (p.data.birthplace) out.push(`2 PLAC ${p.data.birthplace}`);
        }

        if (p.data.death || p.data.deathplace) {
            out.push('1 DEAT');
            if (p.data.death) out.push(`2 DATE ${p.data.death}`);
            if (p.data.deathplace) out.push(`2 PLAC ${p.data.deathplace}`);
        }

        if (p.data.bio) {
            out.push(`1 NOTE ${p.data.bio.replace(/\n/g, ' ')}`);
        }

        // Link to families
        // FAMS (Spouse)
        Object.values(families).forEach(fam => {
            if (fam.husb === p.id || fam.wife === p.id) {
                out.push(`1 FAMS @${fam.id}@`);
            }
        });

        // FAMC (Child) - find family where this person is a child
        Object.values(families).forEach(fam => {
            if (fam.children.includes(p.id)) {
                out.push(`1 FAMC @${fam.id}@`);
            }
        });
    });

    Object.values(families).forEach(fam => {
        out.push(`0 @${fam.id}@ FAM`);
        if (fam.husb) out.push(`1 HUSB @${fam.husb}@`);
        if (fam.wife) out.push(`1 WIFE @${fam.wife}@`);
        fam.children.forEach(childId => {
            out.push(`1 CHIL @${childId}@`);
        });
    });

    out.push('0 TRLR');
    return out.join('\n');
}

export { parseGedcom, generateGedcom };
