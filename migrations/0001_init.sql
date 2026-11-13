-- Every row belongs to one signed-in user (their Cloudflare Access email).
-- Primary keys include user_email so two users can never collide on ids
-- (e.g. both importing the same export file).

CREATE TABLE people (
  user_email TEXT NOT NULL,
  id         TEXT NOT NULL,
  name       TEXT NOT NULL,
  done       INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_email, id)
);

CREATE TABLE items (
  user_email  TEXT NOT NULL,
  id          TEXT NOT NULL,
  person_id   TEXT NOT NULL,
  name        TEXT NOT NULL,
  price_pence INTEGER NOT NULL DEFAULT 0,
  url         TEXT,
  bought      INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL,
  PRIMARY KEY (user_email, id),
  FOREIGN KEY (user_email, person_id) REFERENCES people (user_email, id) ON DELETE CASCADE
);

CREATE INDEX items_by_person ON items (user_email, person_id);
