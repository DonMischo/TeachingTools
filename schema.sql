PRAGMA foreign_keys = ON;

BEGIN TRANSACTION;

CREATE TABLE IF NOT EXISTS teachers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    UNIQUE(first_name, last_name)
);

CREATE TABLE IF NOT EXISTS classes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,         -- z.B. "5a"
    display_name TEXT NOT NULL         -- z.B. "Klasse 5a"
);

CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    teacher_id INTEGER NOT NULL,
    class_id INTEGER NOT NULL,
    points INTEGER NOT NULL,           -- + oder -
    reason TEXT,
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    FOREIGN KEY (class_id)   REFERENCES classes(id)   ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_transactions_class_id ON transactions(class_id);
CREATE INDEX IF NOT EXISTS idx_transactions_teacher_id ON transactions(teacher_id);
CREATE INDEX IF NOT EXISTS idx_transactions_ts ON transactions(ts);

-- View für Summen pro Klasse
CREATE VIEW IF NOT EXISTS class_totals AS
SELECT
    c.id AS class_id,
    c.code AS class_code,
    c.display_name AS class_display_name,
    COALESCE(SUM(t.points), 0) AS total_points
FROM classes c
LEFT JOIN transactions t ON t.class_id = c.id
GROUP BY c.id, c.code, c.display_name;

COMMIT;