# API Family Tree (FR)

Bienvenue dans la documentation en français. Cette page décrit les composants principaux et donne des exemples d'utilisation simples.


Bienvenue dans la documentation de l'API Family Tree. Cette documentation présente les composants principaux, un exemple d'utilisation et des liens utiles pour aller plus loin.

## Exemple rapide

```javascript
import * as f3 from 'family-tree';
import 'family-tree/dist/styles/family-tree.css';

const data = [
	{ id: '1', data: { 'first name': 'John', 'last name': 'Doe', birthday: '1980', gender: 'M' }, rels: { spouses: ['2'], children: ['3'] } },
	{ id: '2', data: { 'first name': 'Jane', 'last name': 'Doe', birthday: '1982', gender: 'F' }, rels: { spouses: ['1'], children: ['3'] } },
	{ id: '3', data: { 'first name': 'Bob', 'last name': 'Doe', birthday: '2005', gender: 'M' }, rels: { parents: ['1','2'] } }
];

const f3Chart = f3.createChart('#FamilyChart', data);
f3Chart.setCardHtml().setCardDisplay([['first name','last name'],['birthday']]);
f3Chart.updateTree({ initial: true });
```

## Composants principaux

- `f3Chart` — classe principale pour créer et configurer l'arbre
- `f3Card` — rendu HTML des cartes
- `f3EditTree` — outils d'édition, formulaires et historique

## Ressources

- Référentiel source (amont) : https://github.com/donatso/family-chart
- Exemples live : https://donatso.github.io/family-chart-doc/examples/