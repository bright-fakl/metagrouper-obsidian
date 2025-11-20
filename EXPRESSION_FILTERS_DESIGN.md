# Expression-Based Filter System Design

## Overview

Replace the current group-based filter system with an expression-based system where:
- Users define individual filters with unique labels
- Users write boolean expressions combining filters
- Supports arbitrary nesting and complex logic

## Motivation

Current system requires duplicating filters to express complex logic like:
`(property1 = value1) AND (NOT has property2 OR property2 = false)`

With groups, this requires duplicating property1 filter in multiple groups.

## New Structure

### FilterConfig v2

```typescript
interface FilterConfigV2 {
  version: 2;
  filters: LabeledFilter[];     // Flat list of labeled filters
  expression: string;            // Boolean expression, e.g., "(A & B) | (C & !D)"
}

interface LabeledFilter {
  label: string;                 // Unique label: A, B, C, etc.
  filter: Filter;                // The actual filter (tag, property, etc.)
  enabled?: boolean;             // Can disable individual filters
}
```

### Expression Syntax

**Operators:**
- `&` or `AND` - Logical AND (higher precedence)
- `|` or `OR` - Logical OR (lower precedence)
- `!` or `NOT` - Logical NOT (prefix, highest precedence)
- `()` - Grouping for precedence

**Examples:**
- Simple: `A & B & C`
- Complex: `(A & B) | (C & !D)`
- Nested: `A & (B | C) & (D | (E & F))`

**Operator Precedence:**
1. `!` / `NOT` (highest)
2. `&` / `AND`
3. `|` / `OR` (lowest)
4. `()` for explicit grouping

## Implementation Plan

### 1. Type System

Update `src/types/filters.ts`:
- Keep `FilterConfig` as union type: `FilterConfigV1 | FilterConfigV2`
- Add `FilterConfigV2` and `LabeledFilter` interfaces
- Add type guards: `isFilterConfigV1()`, `isFilterConfigV2()`

### 2. Expression Parser

Create `src/filters/expression-parser.ts`:
- Tokenizer: Convert string to tokens
- Parser: Build AST from tokens
- Supports both `&` and `AND`, `|` and `OR`, `!` and `NOT`
- Validates syntax and filter label references

```typescript
interface ParseResult {
  ast: ExpressionNode | null;
  errors: string[];
}

type ExpressionNode =
  | { type: 'filter'; label: string }
  | { type: 'not'; operand: ExpressionNode }
  | { type: 'and'; left: ExpressionNode; right: ExpressionNode }
  | { type: 'or'; left: ExpressionNode; right: ExpressionNode };
```

### 3. Expression Evaluator

Create `src/filters/expression-evaluator.ts`:
- Traverse AST and evaluate each node
- Look up filter results by label
- Return boolean result

### 4. Migration

Create `src/filters/filter-migration.ts`:
- Detect v1 format
- Convert groups to expression format
- Generate labels (A, B, C, ...)
- Build expression from group structure

**Migration Logic:**
```
Group 1: [filter1, filter2, filter3]
Group 2: [filter4, filter5]
combineWithOr: true

Becomes:
filters: [
  { label: "A", filter: filter1 },
  { label: "B", filter: filter2 },
  { label: "C", filter: filter3 },
  { label: "D", filter: filter4 },
  { label: "E", filter: filter5 },
]
expression: "(A & B & C) | (D & E)"
```

### 5. Settings UI

Update `src/settings/settings-tab.ts`:
- Replace group UI with:
  - List of labeled filters (each with label, filter type, and delete button)
  - Expression text input with validation
  - Live validation feedback
  - Helper text with available labels
- Add button to generate label for new filter
- Show validation errors below expression input

### 6. Filter Evaluator Integration

Update `src/filters/filter-evaluator.ts`:
- Add method: `evaluateExpression(file, config: FilterConfigV2)`
- Parse expression once (cache AST?)
- Evaluate each filter
- Traverse AST with results

### 7. Backward Compatibility

- Keep v1 evaluation logic
- Auto-migrate v1 to v2 on first save
- Show migration notice to user

## UI Mockup

```
┌─ Filters ────────────────────────────────────────┐
│                                                   │
│ Individual Filters:                               │
│                                                   │
│ [A] Tag: prefix "#project"              [Delete] │
│ [B] Property "status" equals "active"   [Delete] │
│ [C] Property "done" is true            [Delete] │
│                                                   │
│ [+ Add Filter]                                    │
│                                                   │
│ Boolean Expression:                               │
│ ┌───────────────────────────────────────────────┐ │
│ │ (A & B) | (A & !C)                            │ │
│ └───────────────────────────────────────────────┘ │
│ Available labels: A, B, C                         │
│ Operators: & (AND), | (OR), ! (NOT), ()           │
│                                                   │
│ ✓ Expression is valid                            │
│                                                   │
└───────────────────────────────────────────────────┘
```

## Benefits

1. **No Duplication**: Each filter defined once
2. **Unlimited Nesting**: Arbitrary complexity
3. **Clear Logic**: Expression shows intent
4. **Easy Modification**: Edit expression without recreating filters
5. **Power User Friendly**: Familiar boolean syntax

## Open Questions

1. **Label Format**: Single letters (A-Z), numbers (F1, F2), or custom names?
   - **Proposal**: Auto-generate A-Z, allow custom labels

2. **Expression Builder**: Provide visual builder in addition to text?
   - **Proposal**: Start with text, add visual builder in Phase 4

3. **Default Expression**: What if user adds filters but no expression?
   - **Proposal**: Default to `A & B & C & ...` (AND all filters)

4. **Disabled Filters**: How to handle in expression?
   - **Proposal**: Disabled filters evaluate to `true` (don't restrict)

5. **Case Sensitivity**: `and` vs `AND`?
   - **Proposal**: Accept both (case-insensitive)

## Timeline

- Phase 3.5: Expression parser and evaluator (core logic)
- Phase 3.6: Settings UI update
- Phase 3.7: Migration and backward compatibility
- Phase 3.8: Testing and polish
