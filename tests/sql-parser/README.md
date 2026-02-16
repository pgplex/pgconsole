# SQL Parser Test Suite

## Structure

Each test case is a directory containing:
- `query.sql` - The SQL query to parse
- `ast.json` - The expected AST output (statements array)

## Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test --watch

# Run with UI
pnpm test:ui
```

## Adding New Test Cases

1. Create a new directory (e.g., `my-new-test/`)
2. Add `query.sql` with the SQL to test
3. Run `pnpm run test:fixture` to generate `ast.json`
4. Review the generated AST
5. Run `pnpm test` to verify

## Updating Fixtures

After modifying the parser:

```bash
pnpm run test:fixture
git diff tests/sql-parser
```

Review changes and commit both code and updated fixtures together.
