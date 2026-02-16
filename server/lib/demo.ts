import { PGlite } from '@electric-sql/pglite'
import { PGLiteSocketServer } from '@electric-sql/pglite-socket'

let db: PGlite | undefined
let socketServer: PGLiteSocketServer | undefined

const SEED_SQL = `
CREATE TABLE departments (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  location VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE employees (
  id SERIAL PRIMARY KEY,
  first_name VARCHAR(50) NOT NULL,
  last_name VARCHAR(50) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  department_id INTEGER REFERENCES departments(id),
  title VARCHAR(100),
  salary NUMERIC(10,2),
  hire_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE projects (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  department_id INTEGER REFERENCES departments(id),
  lead_id INTEGER REFERENCES employees(id),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'on_hold')),
  start_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE VIEW employee_directory AS
SELECT
  e.id,
  e.first_name || ' ' || e.last_name AS full_name,
  e.email,
  e.title,
  d.name AS department,
  d.location
FROM employees e
LEFT JOIN departments d ON e.department_id = d.id
ORDER BY e.last_name, e.first_name;

INSERT INTO departments (name, location) VALUES
  ('Engineering', 'San Francisco'),
  ('Marketing', 'New York'),
  ('Sales', 'Chicago'),
  ('Human Resources', 'San Francisco');

INSERT INTO employees (first_name, last_name, email, department_id, title, salary, hire_date) VALUES
  ('Alice', 'Chen', 'alice.chen@example.com', 1, 'Staff Engineer', 185000, '2021-03-15'),
  ('Bob', 'Smith', 'bob.smith@example.com', 1, 'Senior Engineer', 165000, '2022-01-10'),
  ('Carol', 'Johnson', 'carol.johnson@example.com', 2, 'Marketing Director', 155000, '2020-06-01'),
  ('David', 'Williams', 'david.williams@example.com', 3, 'Sales Manager', 130000, '2023-02-20'),
  ('Eva', 'Martinez', 'eva.martinez@example.com', 1, 'Engineer', 140000, '2023-07-01'),
  ('Frank', 'Brown', 'frank.brown@example.com', 2, 'Content Strategist', 110000, '2023-09-15'),
  ('Grace', 'Lee', 'grace.lee@example.com', 4, 'HR Manager', 125000, '2021-11-01'),
  ('Henry', 'Taylor', 'henry.taylor@example.com', 3, 'Account Executive', 120000, '2024-01-08'),
  ('Iris', 'Garcia', 'iris.garcia@example.com', 1, 'Engineering Manager', 175000, '2020-09-12'),
  ('Jack', 'Wilson', 'jack.wilson@example.com', 2, 'Designer', 115000, '2024-03-01');

INSERT INTO projects (name, description, department_id, lead_id, status, start_date) VALUES
  ('Platform Redesign', 'Modernize the core platform architecture', 1, 1, 'active', '2024-01-15'),
  ('Brand Refresh', 'Update brand guidelines and marketing materials', 2, 3, 'active', '2024-02-01'),
  ('Q1 Sales Campaign', 'Enterprise outreach for Q1', 3, 4, 'completed', '2024-01-01'),
  ('Employee Portal', 'Internal HR self-service portal', 4, 7, 'active', '2024-03-01'),
  ('API v2', 'Next generation public API', 1, 9, 'on_hold', '2024-04-01');

-- Materialized view: department summary stats
CREATE MATERIALIZED VIEW department_stats AS
SELECT
  d.id AS department_id,
  d.name AS department,
  COUNT(e.id) AS employee_count,
  COALESCE(ROUND(AVG(e.salary), 2), 0) AS avg_salary,
  COALESCE(MIN(e.hire_date), CURRENT_DATE) AS earliest_hire,
  COUNT(p.id) AS project_count
FROM departments d
LEFT JOIN employees e ON e.department_id = d.id
LEFT JOIN projects p ON p.department_id = d.id
GROUP BY d.id, d.name;

-- Function: look up employees by department name
CREATE FUNCTION get_employees_by_department(dept_name TEXT)
RETURNS TABLE(id INT, full_name TEXT, title VARCHAR, salary NUMERIC) AS $$
BEGIN
  RETURN QUERY
  SELECT e.id, e.first_name || ' ' || e.last_name, e.title, e.salary
  FROM employees e
  JOIN departments d ON e.department_id = d.id
  WHERE d.name = dept_name
  ORDER BY e.last_name;
END;
$$ LANGUAGE plpgsql STABLE;

-- Procedure: give a percentage raise to all employees in a department
CREATE PROCEDURE give_department_raise(dept_name TEXT, pct NUMERIC)
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE employees SET salary = ROUND(salary * (1 + pct / 100), 2)
  WHERE department_id = (SELECT id FROM departments WHERE name = dept_name);
END;
$$;

-- analytics schema
CREATE SCHEMA analytics;

CREATE TABLE analytics.page_views (
  id SERIAL PRIMARY KEY,
  path VARCHAR(200) NOT NULL,
  visitor_id UUID NOT NULL,
  referrer VARCHAR(500),
  duration_ms INTEGER,
  viewed_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE analytics.events (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  visitor_id UUID NOT NULL,
  properties JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO analytics.page_views (path, visitor_id, referrer, duration_ms) VALUES
  ('/', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'https://google.com', 4200),
  ('/pricing', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '/', 8500),
  ('/', 'b1ffcd00-ad1c-5f09-cc7e-7ccace491b22', 'https://github.com', 3100),
  ('/docs', 'b1ffcd00-ad1c-5f09-cc7e-7ccace491b22', '/', 12400),
  ('/pricing', 'c200de11-be2d-4a00-dd8f-8ddbdf502c33', 'https://twitter.com', 6700),
  ('/', 'c200de11-be2d-4a00-dd8f-8ddbdf502c33', NULL, 2300);

INSERT INTO analytics.events (name, visitor_id, properties) VALUES
  ('signup_click', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '{"plan": "pro"}'),
  ('page_scroll', 'b1ffcd00-ad1c-5f09-cc7e-7ccace491b22', '{"depth": 75}'),
  ('signup_click', 'c200de11-be2d-4a00-dd8f-8ddbdf502c33', '{"plan": "free"}'),
  ('feature_click', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '{"feature": "sql-editor"}');

CREATE VIEW analytics.daily_summary AS
SELECT
  viewed_at::date AS day,
  COUNT(*) AS views,
  COUNT(DISTINCT visitor_id) AS unique_visitors,
  ROUND(AVG(duration_ms)) AS avg_duration_ms
FROM analytics.page_views
GROUP BY viewed_at::date;
`

export async function startDemoDatabase(): Promise<number> {
  db = await PGlite.create({ debug: 0 })
  await db.exec(SEED_SQL)

  return new Promise((resolve, reject) => {
    socketServer = new PGLiteSocketServer({ db: db!, port: 0 })
    socketServer.addEventListener('listening', (event) => {
      const detail = (event as CustomEvent).detail
      resolve(detail.port)
    })
    socketServer.addEventListener('error', (event) => {
      reject(new Error(`Failed to start demo database: ${event}`))
    })
    socketServer.start()
  })
}

export async function stopDemoDatabase(): Promise<void> {
  await socketServer?.stop()
  await db?.close()
  db = undefined
  socketServer = undefined
}
