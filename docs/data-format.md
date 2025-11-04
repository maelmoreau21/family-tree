# Data Format

Family Tree expects your family tree data to be an array of objects with a specific structure. This guide explains the data format in detail.

## Basic Structure

Your family tree data should be an array of objects with the following structure:

```javascript
const data = [
  {
    "id": "unique-id",           // Unique identifier (required)
    "data": {                    // Person's data (required)
      "gender": "M",             // Gender (M/F) - REQUIRED
      // All other properties are custom and optional
      "first name": "John",      // Example: First name
      "last name": "Doe",        // Example: Last name
      "birthday": "1980",        // Example: Birthday
      "avatar": "image-url"      // Example: Avatar image URL
      // Add any additional properties you need
    },
    "rels": {                    // Relationships (required)
      "parents": ["parent-id-1", "parent-id-2"], // Array of parent IDs (optional)
      "spouses": ["spouse1-id", "spouse2-id"],   // Array of spouse IDs (optional)
      "children": ["child1-id", "child2-id"]     // Array of children IDs (optional)
    }
  }
]
```

## Required Properties

### `id` (string, required)
- Unique identifier for each person
- Must be unique across all people in the tree
- Used to establish relationships between people

### `data` (object, required)
- Contains all the person's information
- Must include `gender` property
- All other properties are custom and optional

#### `gender` (string, required)
- Must be either "M" (male) or "F" (female)
- Used for proper tree layout and styling

### `rels` (object, required)
- Contains relationship information
- The object itself is required, but all keys within are optional
- Used to define family connections

## Relationship Properties (all optional)

### `parents` (array, optional)
- Array of parent IDs
- Supports one or two parents
- Each ID must reference an existing person

### `spouses` (array, optional)
- Array of spouse IDs
- Supports multiple spouses (polygamy, remarriages)
- Each ID must reference an existing person

### `children` (array, optional)
- Array of children IDs
- All children will be displayed below the person
- Each ID must reference an existing person

## Custom Data Properties

You can add any custom properties to the `data` object. Common examples include:

```javascript
{
  "id": "1",
  "data": {
    "gender": "M",
    "first name": "John",
    "last name": "Doe",
    "birthday": "1980-01-15",
    "death": "2020-12-01",
    "profession": "Engineer",
    "avatar": "https://example.com/avatar.jpg",
    "notes": "Additional information",
    "nationality": "American"
  },
  "rels": {
    "parents": ["2", "3"]
    "spouses": ["4"],
    "children": ["5", "6"]
  }
}
```

## Data Validation

Family Tree will validate your data and show warnings for:
- Missing required properties (`id`, `data`, `gender`)
- Invalid gender values (must be "M" or "F")
- References to non-existent people in relationships
- Circular relationships

## Example: Complete Family Tree

```javascript
const familyData = [
  {
    "id": "1",
    "data": {"first name": "John", "last name": "Doe", "birthday": "1980", "gender": "M"},
    "rels": {
      "spouses": ["2"],
      "children": ["3"]
    }
  },
  {
    "id": "2",
    "data": {"first name": "Jane", "last name": "Doe", "birthday": "1982", "gender": "F"},
    "rels": {
      "spouses": ["1"],
      "children": ["3"]
    }
  },
  {
    "id": "3",
    "data": {"first name": "Bob", "last name": "Doe", "birthday": "2005", "gender": "M"},
    "rels": {
      "parents": ["1", "2"]
    }
  }
]
```

## Data Format Migration (v0.9.0+)
<details>

**Note**: This migration was introduced in version 0.9.0.

### Legacy Format (Deprecated)

The previous data format used separate `father` and `mother` properties instead of the unified `parents` array. This format is still supported for backward compatibility but is deprecated.

**Legacy Format Example:**
```javascript
{
  "id": "1",
  "data": {"gender": "M", "name": "John"},
  "rels": {
    "father": "2",        // Single parent ID
    "mother": "3",        // Single parent ID
    "spouses": ["4"],
    "children": ["5"]
  }
}
```

**Current Format (Recommended):**
```javascript
{
  "id": "1", 
  "data": {"gender": "M", "name": "John"},
  "rels": {
    "parents": ["2", "3"], // Array of parent IDs
    "spouses": ["4"],
    "children": ["5"]
  }
}
```

### Automatic Migration

Family Tree automatically converts legacy data format to the new format:

- `father` and `mother` properties are converted to `parents` array
- The conversion preserves all relationship data
- Original `father`/`mother` properties are removed after conversion
- Migration happens transparently when data is loaded

### Export Behavior

The library maintains format consistency during export operations:

- **Legacy Input → Legacy Output**: If you load data with `father`/`mother` properties, `f3EditTree.exportData()` will export it back with the same format
- **New Input → New Output**: If you load data with `parents` array, exports will maintain the new format
- **Format Detection**: The library automatically detects the input format and preserves it throughout the editing session

This behavior ensures that:
- Your data format remains consistent during editing
- No unexpected format changes occur when saving/exporting
- Legacy systems continue to work without modification

</details>

## Tips for Data Preparation

### Use the Visual Builder
The best way to start is to use the [visual builder (ressource amont)](https://donatso.github.io/family-chart-doc/create-tree/), add your family tree, and check the generated data JSON. This ensures proper data structure and relationships.

### Bidirectional Relationships
For each relationship, both persons must have a record of it:
- If John has spouse Jane, then Jane must have John's ID in her `rels.spouses` array
- If Bob has parents Jane and John, then both parents must have Bob's ID in their `rels.children` array