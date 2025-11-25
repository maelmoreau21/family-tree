
/**
 * Tree Operations Utility
 */

function getBranchIds(data, rootId, direction) {
    const idsToDelete = new Set();
    const personMap = new Map(data.map(p => [p.id, p]));

    if (!personMap.has(rootId)) return [];

    function traverseAscending(currentId) {
        if (idsToDelete.has(currentId)) return;
        idsToDelete.add(currentId);

        const person = personMap.get(currentId);
        if (!person) return;

        if (person.rels && person.rels.parents) {
            person.rels.parents.forEach(parentId => traverseAscending(parentId));
        }
    }

    function traverseDescending(currentId) {
        if (idsToDelete.has(currentId)) return;
        idsToDelete.add(currentId);

        const person = personMap.get(currentId);
        if (!person) return;

        if (person.rels && person.rels.children) {
            person.rels.children.forEach(childId => traverseDescending(childId));
        }
    }

    if (direction === 'ascending') {
        traverseAscending(rootId);
    } else if (direction === 'descending') {
        traverseDescending(rootId);
    }

    return Array.from(idsToDelete);
}

export { getBranchIds };
