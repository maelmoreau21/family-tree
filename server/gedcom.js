
/**
 * Simple GEDCOM 5.5.1 Parser
 * Converts GEDCOM data into the internal JSON format used by Family Tree.
 */

export function parseGedcom(buffer) {
    const content = buffer.toString('utf-8');
    const lines = content.split(/\r?\n/);

    const individuals = new Map();
    const families = new Map();

    let currentRecord = null;
    let currentType = null; // 'INDI' or 'FAM'

    // Helper to clean values
    const clean = (str) => str ? str.trim().replace(/@/g, '') : '';

    for (let line of lines) {
        line = line.trim();
        if (!line) continue;

        // Parse line: Level + Optional ID + Tag + Value
        const match = line.match(/^(\d+)\s+(@\w+@)?\s*(\w+)(?:\s+(.*))?$/);
        if (!match) continue;

        const level = parseInt(match[1], 10);
        const id = match[2] ? clean(match[2]) : null;
        const tag = match[3];
        const value = match[4] ? match[4].trim() : '';

        if (level === 0) {
            // New Record
            if (id && tag === 'INDI') {
                currentType = 'INDI';
                currentRecord = {
                    id: id,
                    data: { gender: '' },
                    rels: { parents: [], spouses: [], children: [] },
                    temp: { fams: [], famc: [] } // Temporary storage for family links
                };
                individuals.set(id, currentRecord);
            } else if (id && tag === 'FAM') {
                currentType = 'FAM';
                currentRecord = {
                    id: id,
                    husb: null,
                    wife: null,
                    children: []
                };
                families.set(id, currentRecord);
            } else {
                currentRecord = null;
                currentType = null;
            }
        } else if (currentRecord) {
            // Process properties based on current record type
            if (currentType === 'INDI') {
                processIndiTag(currentRecord, tag, value, level);
            } else if (currentType === 'FAM') {
                processFamTag(currentRecord, tag, value);
            }
        }
    }

    // Resolve Relationships
    resolveRelationships(individuals, families);

    return Array.from(individuals.values()).map(indi => {
        // Cleanup temporary fields
        delete indi.temp;
        return indi;
    });
}

function processIndiTag(indi, tag, value, level) {
    switch (tag) {
        case 'NAME':
            if (value) {
                const parts = value.split('/');
                indi.data['first name'] = parts[0] ? parts[0].trim() : '';
                indi.data['last name'] = parts[1] ? parts[1].trim() : '';
            }
            break;
        case 'SEX':
            indi.data.gender = value === 'M' ? 'M' : (value === 'F' ? 'F' : '');
            break;
        case 'BIRT':
            indi.temp.lastEvent = 'BIRT';
            break;
        case 'DEAT':
            indi.temp.lastEvent = 'DEAT';
            break;
        case 'DATE':
            if (indi.temp.lastEvent === 'BIRT') indi.data.birthday = value;
            if (indi.temp.lastEvent === 'DEAT') indi.data.death = value;
            break;
        case 'PLAC':
            if (indi.temp.lastEvent === 'BIRT') indi.data.birthplace = value;
            if (indi.temp.lastEvent === 'DEAT') indi.data.deathplace = value;
            break;
        case 'OCCU':
            indi.data.metiers = value;
            break;
        case 'NATI':
            indi.data.nationality = value;
            break;
        case 'FAMC': // Child of family
            indi.temp.famc.push(value.replace(/@/g, ''));
            break;
        case 'FAMS': // Spouse in family
            indi.temp.fams.push(value.replace(/@/g, ''));
            break;
    }
}

function processFamTag(fam, tag, value) {
    switch (tag) {
        case 'HUSB':
            fam.husb = value.replace(/@/g, '');
            break;
        case 'WIFE':
            fam.wife = value.replace(/@/g, '');
            break;
        case 'CHIL':
            fam.children.push(value.replace(/@/g, ''));
            break;
    }
}

function resolveRelationships(individuals, families) {
    families.forEach(fam => {
        const father = individuals.get(fam.husb);
        const mother = individuals.get(fam.wife);
        const children = fam.children.map(id => individuals.get(id)).filter(Boolean);

        // Link Spouses
        if (father && mother) {
            if (!father.rels.spouses.includes(mother.id)) father.rels.spouses.push(mother.id);
            if (!mother.rels.spouses.includes(father.id)) mother.rels.spouses.push(father.id);
        }

        // Link Parents -> Children
        children.forEach(child => {
            if (father) {
                if (!father.rels.children.includes(child.id)) father.rels.children.push(child.id);
                if (!child.rels.parents.includes(father.id)) child.rels.parents.push(father.id);
            }
            if (mother) {
                if (!mother.rels.children.includes(child.id)) mother.rels.children.push(child.id);
                if (!child.rels.parents.includes(mother.id)) child.rels.parents.push(mother.id);
            }
        });
    });
}
