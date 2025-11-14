-- Rollback migration

ALTER TABLE users
    DROP COLUMN IF EXISTS banned;

DROP TABLE IF EXISTS reports;
DROP TABLE IF EXISTS blocks;
