import { describe, it, expect } from 'vitest'
import {
  generateSelect,
  generateInsert,
  generateUpdate,
  generateDelete,
  generateAlterAddColumn,
} from '../src/lib/sql/generate'

describe('SQL generators', () => {
  describe('generateSelect', () => {
    it('generates a SELECT statement with LIMIT 100', async () => {
      const result = await generateSelect('public', 'users')
      expect(result).toBe(`SELECT
  *
FROM
  public.users
LIMIT
  100;`)
    })

    it('quotes mixed-case table names in schema-qualified SELECT', async () => {
      const result = await generateSelect('public', 'LiteLLM_TableSome')
      expect(result).toBe(`SELECT
  *
FROM
  public."LiteLLM_TableSome"
LIMIT
  100;`)
    })

    it('quotes unsafe schema names and embedded double quotes', async () => {
      const result = await generateSelect('Tenant Schema', 'weird"table')
      expect(result).toBe(`SELECT
  *
FROM
  "Tenant Schema"."weird""table"
LIMIT
  100;`)
    })
  })

  describe('generateInsert', () => {
    it('generates an INSERT statement with column placeholders', async () => {
      const columns = [
        { name: 'id', type: 'integer', nullable: false },
        { name: 'name', type: 'varchar', nullable: true },
        { name: 'email', type: 'varchar', nullable: false },
      ]
      const result = await generateInsert('public', 'users', columns)
      expect(result).toBe(`INSERT INTO public.users (
  id,
  name,
  email
)
VALUES (
  '<id>',
  '<name>',
  '<email>'
);`)
    })

    it('returns empty string for empty columns', async () => {
      const result = await generateInsert('public', 'users', [])
      expect(result).toBe('')
    })

    it('quotes reserved words used as identifiers', async () => {
      const columns = [
        { name: 'select', type: 'text', nullable: true },
        { name: 'from', type: 'text', nullable: true },
      ]

      const result = await generateInsert('public', 'order', columns)

      expect(result).toBe(`INSERT INTO public."order" (
  "select",
  "from"
)
VALUES (
  '<select>',
  '<from>'
);`)
    })

    it('quotes mixed-case, space, and double-quote column names in INSERT', async () => {
      const columns = [
        { name: 'DisplayName', type: 'text', nullable: true },
        { name: 'User ID', type: 'integer', nullable: false },
        { name: 'quoted"column', type: 'text', nullable: true },
      ]

      const result = await generateInsert('public', 'users', columns)

      expect(result).toBe(`INSERT INTO public.users (
  "DisplayName",
  "User ID",
  "quoted""column"
)
VALUES (
  '<DisplayName>',
  '<User ID>',
  '<quoted"column>'
);`)
    })

    it('does not corrupt safe identifiers containing internal replacement tokens', async () => {
      const columns = [
        { name: 'User ID', type: 'integer', nullable: false },
        { name: 'xpgconsole_ident_0_tokeny', type: 'text', nullable: true },
      ]

      const result = await generateInsert('public', 'users', columns)

      expect(result).toBe(`INSERT INTO public.users (
  "User ID",
  xpgconsole_ident_0_tokeny
)
VALUES (
  '<User ID>',
  '<xpgconsole_ident_0_tokeny>'
);`)
    })
  })

  describe('generateUpdate', () => {
    it('generates an UPDATE statement with PK in WHERE', async () => {
      const columns = [
        { name: 'id', type: 'integer', nullable: false },
        { name: 'name', type: 'varchar', nullable: true },
        { name: 'email', type: 'varchar', nullable: false },
      ]
      const result = await generateUpdate('public', 'users', columns, ['id'])
      expect(result).toBe(`UPDATE public.users
SET
  name = '<name>',
  email = '<email>'
WHERE
  id = '<id>';`)
    })

    it('uses placeholder comment when no PK', async () => {
      const columns = [
        { name: 'name', type: 'varchar', nullable: true },
        { name: 'email', type: 'varchar', nullable: false },
      ]
      const result = await generateUpdate('public', 'users', columns, [])
      expect(result).toBe(`UPDATE public.users
SET
  name = '<name>',
  email = '<email>'
WHERE
  /* condition */;`)
    })

    it('handles composite primary keys', async () => {
      const columns = [
        { name: 'user_id', type: 'integer', nullable: false },
        { name: 'role_id', type: 'integer', nullable: false },
        { name: 'created_at', type: 'timestamp', nullable: false },
      ]
      const result = await generateUpdate('public', 'user_roles', columns, ['user_id', 'role_id'])
      expect(result).toBe(`UPDATE public.user_roles
SET
  created_at = '<created_at>'
WHERE
  user_id = '<user_id>'
  AND role_id = '<role_id>';`)
    })

    it('returns empty string for empty columns', async () => {
      const result = await generateUpdate('public', 'users', [], ['id'])
      expect(result).toBe('')
    })

    it('quotes unsafe columns and primary keys in UPDATE', async () => {
      const columns = [
        { name: 'User ID', type: 'integer', nullable: false },
        { name: 'DisplayName', type: 'text', nullable: true },
      ]

      const result = await generateUpdate('public', 'Accounts', columns, ['User ID'])

      expect(result).toBe(`UPDATE public."Accounts"
SET
  "DisplayName" = '<DisplayName>'
WHERE
  "User ID" = '<User ID>';`)
    })

    it('quotes reserved words in UPDATE', async () => {
      const columns = [
        { name: 'from', type: 'text', nullable: true },
        { name: 'select', type: 'text', nullable: true },
      ]

      const result = await generateUpdate('public', 'order', columns, ['from'])

      expect(result).toBe(`UPDATE public."order"
SET
  "select" = '<select>'
WHERE
  "from" = '<from>';`)
    })
  })

  describe('generateDelete', () => {
    it('generates a DELETE statement with PK in WHERE', async () => {
      const result = await generateDelete('public', 'users', ['id'])
      expect(result).toBe(`DELETE FROM public.users
WHERE
  id = '<id>';`)
    })

    it('uses placeholder comment when no PK', async () => {
      const result = await generateDelete('public', 'users', [])
      expect(result).toBe(`DELETE FROM public.users
WHERE
  /* condition */;`)
    })

    it('handles composite primary keys', async () => {
      const result = await generateDelete('public', 'user_roles', ['user_id', 'role_id'])
      expect(result).toBe(`DELETE FROM public.user_roles
WHERE
  user_id = '<user_id>'
  AND role_id = '<role_id>';`)
    })

    it('quotes unsafe table names and unsafe primary keys in DELETE', async () => {
      const result = await generateDelete('public', 'Audit Log', ['User ID', 'quoted"key'])

      expect(result).toBe(`DELETE FROM public."Audit Log"
WHERE
  "User ID" = '<User ID>'
  AND "quoted""key" = '<quoted"key>';`)
    })

    it('quotes reserved words in DELETE primary keys', async () => {
      const result = await generateDelete('public', 'order', ['select', 'from'])

      expect(result).toBe(`DELETE FROM public."order"
WHERE
  "select" = '<select>'
  AND "from" = '<from>';`)
    })
  })

  describe('generateAlterAddColumn', () => {
    it('quotes mixed-case table names in ALTER TABLE ADD COLUMN', async () => {
      const result = await generateAlterAddColumn('public', 'Accounts')

      expect(result).toBe(`ALTER TABLE public."Accounts"
  ADD COLUMN column_name data_type;`)
    })

    it('quotes unsafe schema and table names in ALTER TABLE ADD COLUMN', async () => {
      const result = await generateAlterAddColumn('Tenant Schema', 'Audit Log')

      expect(result).toBe(`ALTER TABLE "Tenant Schema"."Audit Log"
  ADD COLUMN column_name data_type;`)
    })
  })
})
