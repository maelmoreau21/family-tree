import { describe, it, expect } from 'vitest';
import { createLinks } from '../src/layout/create-links';
import type { TreeDatum } from '../src/types/treeData';

function createFamily() {
  const parent: TreeDatum = {
    data: {
      id: 'parent',
      data: { gender: 'M' },
      rels: { parents: [], spouses: [], children: ['child'] }
    },
    tid: 'parent',
    x: 20,
    y: 10,
    depth: 0,
    sx: 60,
    sy: 15,
    children: []
  };

  const child: TreeDatum = {
    data: {
      id: 'child',
      data: { gender: 'F' },
      rels: { parents: ['parent'], spouses: [], children: [] }
    },
    tid: 'child',
    x: 100,
    y: 80,
    depth: 1,
    parents: []
  };

  parent.children = [child];
  child.parents = [parent];
  child.parent = parent;
  child.psx = parent.sx;
  child.psy = parent.sx;

  return { parent, child };
}

describe('createLinks', () => {
  it('creates vertical elbow paths when the tree is vertical', () => {
    const { parent, child } = createFamily();

    const links = createLinks(parent, false);
    const childLink = links.find(link => link.target === child);

    expect(childLink).toBeDefined();
    if (!childLink) return;

    const halfwayY = child.y + (parent.y - child.y) / 2;
    const expected = [
      [parent.sx!, parent.y],
      [parent.sx!, halfwayY],
      [parent.sx!, halfwayY],
      [child.x, halfwayY],
      [child.x, halfwayY],
      [child.x, child.y]
    ];

    expect(childLink.d).toEqual(expected);
    expect(childLink.curve).toBe(true);
  });

  it('creates horizontal elbow paths when the tree is horizontal', () => {
    const { parent, child } = createFamily();

    const links = createLinks(parent, true);
    const childLink = links.find(link => link.target === child);

    expect(childLink).toBeDefined();
    if (!childLink) return;

    const halfwayX = child.x + (parent.x - child.x) / 2;
    const parentSpouseY = parent.sx!;
    const expected = [
      [parent.x, parentSpouseY],
      [halfwayX, parentSpouseY],
      [halfwayX, parentSpouseY],
      [halfwayX, child.y],
      [halfwayX, child.y],
      [child.x, child.y]
    ];

    expect(childLink.d).toEqual(expected);
    expect(childLink.curve).toBe(true);
  });

  it('falls back to parent coordinates when no stored anchors exist', () => {
    const { parent, child } = createFamily();
    child.psx = undefined;
    child.psy = undefined;
    parent.sx = undefined;
    parent.sy = undefined;

    const links = createLinks(parent, false);
    const childLink = links.find(link => link.target === child);

    expect(childLink).toBeDefined();
    if (!childLink) return;

    const lastPoint = childLink.d[childLink.d.length - 1];
    expect(lastPoint).toEqual([child.x, child.y]);
  });
});
