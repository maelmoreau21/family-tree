
export function parseGEDCOM(content) {
    const lines = content.split(/\r?\n/);
    const persons = new Map(); // id -> { id, data: {}, rels: { parents: [], children: [], spouses: [] } }
    const families = new Map(); // famId -> { husb, wife, children: [] }

    let currentIndi = null;
    let currentFam = null;

    lines.forEach(line => {
        line = line.trim();
        if (!line) return;

        // Parse level, id (optional), tag, value
        // Format: Level [Xref] Tag [LineValue]
        const parts = line.match(/^(\d+)\s+(@\w+@)?\s*(\w+)(?:\s+(.*))?$/);
        if (!parts) return;

        const level = parseInt(parts[1], 10);
        const xref = parts[2];
        const tag = parts[3];
        const value = parts[4];

        if (level === 0) {
            currentIndi = null;
            currentFam = null;
            if (xref && tag === 'INDI') {
                currentIndi = {
                    id: xref.replace(/@/g, ''),
                    data: { gender: 'M' }, // Default
                    rels: { parents: [], children: [], spouses: [] }
                };
                persons.set(currentIndi.id, currentIndi);
            } else if (xref && tag === 'FAM') {
                currentFam = { id: xref, husb: null, wife: null, children: [] };
                families.set(xref, currentFam);
            }
        } else if (currentIndi) {
            switch (tag) {
                case 'NAME':
                    if (value) {
                        const nameParts = value.replace(/\//g, '').split(' ');
                        currentIndi.data['first name'] = nameParts[0] || '';
                        currentIndi.data['last name'] = nameParts.slice(1).join(' ') || '';
                    }
                    break;
                case 'SEX':
                    currentIndi.data.gender = value === 'F' ? 'F' : 'M';
                    break;
                case 'BIRT':
                case 'DEAT':
                    currentIndi._lastTag = tag;
                    break;
                case 'DATE':
                    if (currentIndi._lastTag === 'BIRT') currentIndi.data.birthday = value;
                    if (currentIndi._lastTag === 'DEAT') currentIndi.data.death = value;
                    break;
                case 'PLAC':
                    if (currentIndi._lastTag === 'BIRT') currentIndi.data.birthplace = value;
                    if (currentIndi._lastTag === 'DEAT') currentIndi.data.deathplace = value;
                    break;
                case 'NOTE':
                    if (currentIndi.data.bio) {
                        currentIndi.data.bio += '\n' + value;
                    } else {
                        currentIndi.data.bio = value;
                    }
                    break;
                case 'FAMC': // Child of family
                    // We handle relationships via FAM records usually, but this links back
                    break;
                case 'FAMS': // Spouse in family
                    // Handled via FAM
                    break;
            }
        } else if (currentFam) {
            switch (tag) {
                case 'HUSB':
                    currentFam.husb = value.replace(/@/g, '');
                    break;
                case 'WIFE':
                    currentFam.wife = value.replace(/@/g, '');
                    break;
                case 'CHIL':
                    currentFam.children.push(value.replace(/@/g, ''));
                    break;
            }
        }
    });

    // Process relationships from Families to Persons
    families.forEach(fam => {
        const father = persons.get(fam.husb);
        const mother = persons.get(fam.wife);
        const children = fam.children.map(id => persons.get(id)).filter(Boolean);

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

    return Array.from(persons.values());
}

export function toGEDCOM(data) {
    if (!Array.isArray(data)) return '';

    let ged = "0 HEAD\n1 SOUR FamilyTreeApp\n1 GEDC\n2 VERS 5.5.1\n2 FORM LINEAGE-LINKED\n1 CHAR UTF-8\n";

    const famMap = new Map(); // Generate FAM records dynamically
    let famCounter = 1;

    const getFamId = (p1, p2) => {
        const key = [p1, p2].sort().join('-');
        if (!famMap.has(key)) {
            famMap.set(key, { id: `@F${famCounter++}@`, p1, p2, children: [] });
        }
        return famMap.get(key);
    };

    data.forEach(p => {
        ged += `0 @${p.id}@ INDI\n`;
        const fname = p.data['first name'] || '';
        const lname = p.data['last name'] ? `/${p.data['last name']}/` : '';
        ged += `1 NAME ${fname} ${lname}\n`.trim() + "\n";
        ged += `1 SEX ${p.data.gender || 'U'}\n`;

        if (p.data.birthday) {
            ged += "1 BIRT\n";
            ged += `2 DATE ${p.data.birthday}\n`;
            if (p.data.birthplace) ged += `2 PLAC ${p.data.birthplace}\n`;
        }

        if (p.data.death) {
            ged += "1 DEAT\n";
            ged += `2 DATE ${p.data.death}\n`;
            if (p.data.deathplace) ged += `2 PLAC ${p.data.deathplace}\n`;
        }

        if (p.data.bio) {
            ged += `1 NOTE ${p.data.bio.replace(/\n/g, '\n2 CONC ')}\n`;
        }

        // Process families where this person is a parent (spouse link)
        if (p.rels.spouses) {
            p.rels.spouses.forEach(spouseId => {
                const fam = getFamId(p.id, spouseId);
                ged += `1 FAMS ${fam.id}\n`;
            });
        }

        // Process families where this person is a child
        if (p.rels.parents && p.rels.parents.length > 0) {
            // Assuming parents are a couple. If multiple sets of parents, this basic logic might need enhancement,
            // but for now let's group parents into a family
            const parents = p.rels.parents.slice(0, 2); // Take first two as a couple
            if (parents.length >= 1) {
                // Sort to ensure same key regardless of order
                const p1 = parents[0];
                const p2 = parents[1] || 'UNKNOWN';
                // Note: If p2 is unknown, we might create a 1-parent family. 
                // But our getFamId requires 2 keys effectively. 
                // To correspond to standard GEDCOM, we link child to the family of the parents.

                // Let's iterate families to find which one has these parents
                // Optimization: Pre-calculate child-parent links or just find match
            }
        }
    });

    // Re-iterate to fix FAMC/CHIL relations accurately
    // We need to group children by parent pairs
    const families = new Map(); // key: "p1-p2", val: {id, husb, wife, chil: []}

    data.forEach(child => {
        if (child.rels.parents && child.rels.parents.length > 0) {
            const p1 = child.rels.parents[0];
            const p2 = child.rels.parents[1];

            let key;
            if (p2) {
                key = [p1, p2].sort().join('-');
            } else {
                key = p1; // Single parent
            }

            if (!families.has(key)) {
                families.set(key, {
                    id: `@F${families.size + 1}@`,
                    husb: p1,
                    wife: p2,
                    children: []
                });
            }
            families.get(key).children.push(child.id);
        }
    });

    // Write FAM records
    families.forEach(fam => {
        ged += `0 ${fam.id} FAM\n`;
        if (fam.husb) ged += `1 HUSB @${fam.husb}@\n`;
        if (fam.wife) ged += `1 WIFE @${fam.wife}@\n`;
        fam.children.forEach(cid => {
            ged += `1 CHIL @${cid}@\n`;
        });
    });

    // Add FAMC to individuals now that we have FAM IDs
    // (We need to inject this back into INDI records or do 2-pass write. 2-pass string manip is messy.
    // Better approach: Build object structure first then dump string.)

    // Refined approach for toGEDCOM:
    // 1. Build Families Map first based on Child->Parents relationships.
    // 2. Output INDIs, referencing those Families (FAMC).
    // 3. Output FAMs, referencing INDIs (HUSB/WIFE/CHIL).

    return generateGEDCOMString(data);
}

function generateGEDCOMString(data) {
    let ged = "0 HEAD\n1 SOUR FamilyTreeApp\n1 GEDC\n2 VERS 5.5.1\n2 FORM LINEAGE-LINKED\n1 CHAR UTF-8\n";

    const parentPairs = new Map(); // "sorted_parent_ids" -> famId
    let famCounter = 1;

    // 1. Identify Families based on children's parents
    data.forEach(p => {
        if (p.rels.parents && p.rels.parents.length > 0) {
            const sortedParents = [...p.rels.parents].sort().join('-');
            if (!parentPairs.has(sortedParents)) {
                parentPairs.set(sortedParents, `@F${famCounter++}@`);
            }
        }
        // Also consider spouses who might not have children together yet
        if (p.rels.spouses) {
            p.rels.spouses.forEach(sp => {
                const pair = [p.id, sp].sort().join('-');
                if (!parentPairs.has(pair)) {
                    parentPairs.set(pair, `@F${famCounter++}@`);
                }
            });
        }
    });

    // 2. Output Individuals
    data.forEach(p => {
        ged += `0 @${p.id}@ INDI\n`;
        const fname = p.data['first name'] || '';
        const lname = p.data['last name'] ? `/${p.data['last name']}/` : '';
        ged += `1 NAME ${fname} ${lname}\n`.trim() + "\n";
        ged += `1 SEX ${p.data.gender || 'U'}\n`;

        if (p.data.birthday) {
            ged += "1 BIRT\n";
            ged += `2 DATE ${p.data.birthday}\n`;
            if (p.data.birthplace) ged += `2 PLAC ${p.data.birthplace}\n`;
        }
        if (p.data.death) {
            ged += "1 DEAT\n";
            ged += `2 DATE ${p.data.death}\n`;
            if (p.data.deathplace) ged += `2 PLAC ${p.data.deathplace}\n`;
        }
        if (p.data.bio) {
            // Simple note handling
            ged += `1 NOTE ${p.data.bio.replace(/\n/g, ' ')}\n`;
        }

        // FAMS (Spouse in family)
        if (p.rels.spouses) {
            p.rels.spouses.forEach(sp => {
                const pair = [p.id, sp].sort().join('-');
                if (parentPairs.has(pair)) {
                    ged += `1 FAMS ${parentPairs.get(pair)}\n`;
                }
            });
        }

        // FAMC (Child of family)
        if (p.rels.parents && p.rels.parents.length > 0) {
            const pair = [...p.rels.parents].sort().join('-');
            if (parentPairs.has(pair)) {
                ged += `1 FAMC ${parentPairs.get(pair)}\n`;
            }
        }
    });

    // 3. Output Families
    parentPairs.forEach((famId, pairKey) => {
        ged += `0 ${famId} FAM\n`;
        const parents = pairKey.split('-');
        // Naive assignment of HUSB/WIFE based on gender could be better, but for now just list them.
        // GEDCOM standard prefers Male=HUSB, Female=WIFE.
        const p1 = data.find(d => d.id === parents[0]);
        const p2 = data.find(d => d.id === parents[1]);

        [p1, p2].forEach(p => {
            if (!p) return;
            if (p.data.gender === 'M') ged += `1 HUSB @${p.id}@\n`;
            else ged += `1 WIFE @${p.id}@\n`;
        });

        // Find children for this couple
        const children = data.filter(d => {
            if (!d.rels.parents) return false;
            const dParams = [...d.rels.parents].sort().join('-');
            return dParams === pairKey;
        });

        children.forEach(c => {
            ged += `1 CHIL @${c.id}@\n`;
        });
    });

    ged += "0 TRLR\n";
    return ged;
}
