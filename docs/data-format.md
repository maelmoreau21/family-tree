# Format des données (FR)

Chaque personne est un objet avec `id`, `data` et `rels`.

Cette page décrit le format JSON attendu par Family Tree. Les exemples sont en français mais le format est identique pour toutes les langues.

## Structure de base

Chaque personne est représentée par un objet avec au minimum :

- `id` (string) — identifiant unique de la personne
- `data` (object) — attributs descriptifs (prénom, nom, date de naissance, etc.)
- `rels` (object) — relations (`parents`, `spouses`, `children`)

Exemple minimal :

```json
{
	"id": "1",
	"data": { "first name": "John", "last name": "Doe", "gender": "M", "birthday": "1980" },
	"rels": { "spouses": ["2"], "children": ["3"] }
}
```

## Propriétés recommandées

- `first name`, `last name`, `birthday`, `death`, `gender` sont courantes et utilisées par le rendu.
- Tout champ personnalisé peut être ajouté dans `data` (ex. `occupation`, `notes`, `location`).

## Relations

- `parents`: tableau d'IDs (0, 1 ou 2 éléments)
- `spouses`: tableau d'IDs (permet plusieurs unions)
- `children`: tableau d'IDs

Les relations doivent idéalement être bidirectionnelles (si A indique B comme enfant, B devrait lister A comme parent) pour éviter des incohérences d'affichage.

## Compatibilité et migration

Le loader convertit automatiquement les formats hérités (par ex. `father`/`mother`) en `rels.parents` pour conserver la rétrocompatibilité.

## Conseils pour gros jeux de données

- Validez les IDs uniques avant import.
- Privilégiez des IDs stables (pas d'UUID changeant à chaque import).
- Pour les recherches avancées, activez FTS5 côté serveur.
Voir la documentation anglaise pour exemples complets.