export const SQL_KEYWORDS = {
  // Statement-starting keywords
  statements: [
    'SELECT',
    'INSERT INTO',
    'UPDATE',
    'DELETE FROM',
    'WITH',
    'CALL',
    'CREATE',
    'ALTER',
    'DROP',
    'TRUNCATE',
    'EXPLAIN',
    'ANALYZE',
    'BEGIN',
    'COMMIT',
    'ROLLBACK',
    'GRANT',
    'REVOKE',
  ],
  // Clause keywords (structural parts of queries)
  clauses: [
    'FROM',
    'WHERE',
    'JOIN',
    'LEFT JOIN',
    'RIGHT JOIN',
    'INNER JOIN',
    'FULL JOIN',
    'CROSS JOIN',
    'NATURAL JOIN',
    'ON',
    'USING',
    'AND',
    'OR',
    'NOT',
    'ORDER BY',
    'GROUP BY',
    'HAVING',
    'LIMIT',
    'OFFSET',
    'FETCH',
    'UNION',
    'UNION ALL',
    'INTERSECT',
    'EXCEPT',
    'AS',
    'DISTINCT',
    'ALL',
    'INTO',
    'VALUES',
    'SET',
    'RETURNING',
    'WITH',
    'LATERAL',
    'WINDOW',
    'FOR UPDATE',
    'FOR SHARE',
  ],
  // ORDER BY modifiers
  orderByModifiers: ['ASC', 'DESC', 'NULLS FIRST', 'NULLS LAST'],
  // GROUP BY advanced keywords
  groupByKeywords: ['ROLLUP', 'CUBE', 'GROUPING SETS'],
  // Expression operators and constructs
  operators: [
    // Comparison/set operators
    'IN',
    'NOT IN',
    'EXISTS',
    'NOT EXISTS',
    'BETWEEN',
    'NOT BETWEEN',
    'BETWEEN SYMMETRIC',
    // Pattern matching
    'LIKE',
    'NOT LIKE',
    'ILIKE',
    'NOT ILIKE',
    'SIMILAR TO',
    'NOT SIMILAR TO',
    // NULL/boolean testing
    'IS NULL',
    'IS NOT NULL',
    'IS TRUE',
    'IS NOT TRUE',
    'IS FALSE',
    'IS NOT FALSE',
    'IS UNKNOWN',
    'IS NOT UNKNOWN',
    'IS DISTINCT FROM',
    'IS NOT DISTINCT FROM',
    // CASE expression
    'CASE',
    'WHEN',
    'THEN',
    'ELSE',
    'END',
    // Other
    'CAST',
    'ANY',
    'SOME',
    'TRUE',
    'FALSE',
    'NULL',
  ],
}

// Get all keywords as a flat array
export function getAllKeywords(): string[] {
  return [
    ...SQL_KEYWORDS.statements,
    ...SQL_KEYWORDS.clauses,
    ...SQL_KEYWORDS.orderByModifiers,
    ...SQL_KEYWORDS.groupByKeywords,
    ...SQL_KEYWORDS.operators,
  ]
}

// Get ORDER BY modifiers (ASC, DESC, NULLS FIRST, etc.)
export function getOrderByModifiers(): string[] {
  return SQL_KEYWORDS.orderByModifiers
}

// Get GROUP BY advanced keywords (ROLLUP, CUBE, etc.)
export function getGroupByKeywords(): string[] {
  return SQL_KEYWORDS.groupByKeywords
}

// Get join-related keywords
export function getJoinKeywords(): string[] {
  return ['JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'FULL JOIN', 'CROSS JOIN', 'NATURAL JOIN']
}

// Get keywords that follow a table in FROM/JOIN context
export function getPostTableKeywords(): string[] {
  return ['ON', 'USING', 'AS', 'WHERE', 'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'FULL JOIN', 'CROSS JOIN', 'ORDER BY', 'GROUP BY', 'LIMIT']
}

// Get keywords for expression context (WHERE, HAVING, ON conditions)
export function getExpressionKeywords(): string[] {
  return [...SQL_KEYWORDS.operators, 'AND', 'OR', 'NOT']
}

// Get statement-starting keywords
export function getStatementKeywords(): string[] {
  return SQL_KEYWORDS.statements
}

// Get clause keywords (for after SELECT, FROM, etc.)
export function getClauseKeywords(): string[] {
  return SQL_KEYWORDS.clauses
}

// Keywords that should trigger autocomplete after selection
export const RETRIGGER_KEYWORDS = new Set([
  // Statements that expect columns/tables
  'SELECT',
  'INSERT INTO',
  'UPDATE',
  'DELETE FROM',
  // Statements that expect procedures
  'CALL',
  // DDL statements
  'CREATE',
  'CREATE TABLE',
  'CREATE TEMP TABLE',
  'CREATE TEMPORARY TABLE',
  'CREATE UNLOGGED TABLE',
  'CREATE OR REPLACE',
  'CREATE TEMP',
  'CREATE TEMPORARY',
  'CREATE UNLOGGED',
  'CREATE INDEX',
  'CREATE UNIQUE INDEX',
  // Clauses that expect tables
  'FROM',
  'JOIN',
  'LEFT JOIN',
  'RIGHT JOIN',
  'INNER JOIN',
  'FULL JOIN',
  'CROSS JOIN',
  'NATURAL JOIN',
  'LATERAL',
  'INTO',
  // Clauses that expect columns/expressions
  'WHERE',
  'AND',
  'OR',
  'ON',
  'SET',
  'ORDER BY',
  'GROUP BY',
  'HAVING',
  'RETURNING',
  'USING',
  // ORDER BY modifiers (can follow with comma, NULLS, LIMIT, etc.)
  'ASC',
  'DESC',
  // Conditional
  'WHEN',
  'THEN',
  'ELSE',
  // CREATE TABLE specific
  'PRIMARY KEY',
  'FOREIGN KEY',
  'REFERENCES',
  'DEFAULT',
  'CHECK',
  'UNIQUE',
  'NOT NULL',
  'INHERITS',
  'PARTITION BY',
  'PARTITION BY RANGE',
  'PARTITION BY LIST',
  'PARTITION BY HASH',
])
