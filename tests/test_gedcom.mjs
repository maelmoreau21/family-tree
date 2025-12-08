import { parseGEDCOM, toGEDCOM } from './static/builder/gedcom.js';
import assert from 'assert';

console.log('Testing GEDCOM Parser and Generator...');

const sampleGEDCOM = `
0 HEAD
1 CHAR UTF-8
0 @I1@ INDI
1 NAME John /Doe/
1 SEX M
1 BIRT
2 DATE 1980-01-01
2 PLAC New York
0 @I2@ INDI
1 NAME Jane /Smith/
1 SEX F
1 FAMC @F1@
0 @I3@ INDI
1 NAME Baby /Doe/
1 SEX M
1 FAMC @F1@
0 @F1@ FAM
1 HUSB @I1@
1 WIFE @I2@
1 CHIL @I3@
0 TRLR
`;

// Test Parser
console.log('Parsing sample GEDCOM...');
const persons = parseGEDCOM(sampleGEDCOM);

assert.strictEqual(persons.length, 3, 'Should find 3 persons');
const john = persons.find(p => p.data['first name'] === 'John');
const jane = persons.find(p => p.data['first name'] === 'Jane');
const baby = persons.find(p => p.data['first name'] === 'Baby');

assert.ok(john, 'John found');
assert.ok(jane, 'Jane found');
assert.ok(baby, 'Baby found');

// Check relationships
assert.ok(john.rels.children.includes(baby.id), 'John should have Baby as child');
assert.ok(jane.rels.children.includes(baby.id), 'Jane should have Baby as child');
assert.ok(baby.rels.parents.includes(john.id), 'Baby should have John as parent');
assert.ok(baby.rels.parents.includes(jane.id), 'Baby should have Jane as parent');
assert.ok(john.rels.spouses.includes(jane.id), 'John should have Jane as spouse');

console.log('Parser test passed!');

// Test Generator
console.log('Generating GEDCOM from data...');
const generatedGEDCOM = toGEDCOM(persons);
console.log('Generated GEDCOM:\n', generatedGEDCOM);

assert.ok(generatedGEDCOM.includes('NAME John /Doe/'), 'Output contains John');
assert.ok(generatedGEDCOM.includes('NAME Jane /Smith/'), 'Output contains Jane');
assert.ok(generatedGEDCOM.includes('FAM'), 'Output contains Family record');
assert.ok(generatedGEDCOM.includes('HUSB'), 'Output contains HUSB');
assert.ok(generatedGEDCOM.includes('WIFE'), 'Output contains WIFE');
assert.ok(generatedGEDCOM.includes('CHIL'), 'Output contains CHIL');

console.log('Generator test passed!');

// Verify round-trip
console.log('Verifying round-trip...');
const roundTripPersons = parseGEDCOM(generatedGEDCOM);
assert.strictEqual(roundTripPersons.length, 3, 'Round trip count match');
const rtBaby = roundTripPersons.find(p => p.data['first name'] === 'Baby');
assert.ok(rtBaby.rels.parents.length >= 2, 'Round trip baby has parents');

console.log('All tests passed!');
