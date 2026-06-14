-- Migration: 001_create_events_registry
-- Creates the core Event Registry tables.

BEGIN;

-- ─── Extensions ──────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Enums ───────────────────────────────────────────────────────────────────
CREATE TYPE sport_type AS ENUM (
  'FOOTBALL', 'CRICKET', 'RUGBY', 'BASKETBALL', 'BASEBALL', 'ATHLETICS', 'OTHER'
);

CREATE TYPE event_status AS ENUM (
  'DRAFT', 'SCHEDULED', 'ACTIVE', 'COMPLETED', 'CANCELLED'
);

CREATE TYPE match_status AS ENUM (
  'SCHEDULED', 'LIVE', 'COMPLETED', 'POSTPONED', 'CANCELLED'
);

CREATE TYPE host_city_status AS ENUM (
  'PENDING', 'ACTIVE', 'RETIRED'
);

-- ─── Tables ───────────────────────────────────────────────────────────────────

CREATE TABLE events (
  event_id          UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  name              VARCHAR(300)  NOT NULL,
  short_name        VARCHAR(50)   NOT NULL,
  sport             sport_type    NOT NULL,
  edition_year      SMALLINT      NOT NULL CHECK (edition_year BETWEEN 2000 AND 2100),
  organizer         VARCHAR(300)  NOT NULL,
  logo_url          TEXT,
  banner_url        TEXT,
  start_date        DATE          NOT NULL,
  end_date          DATE          NOT NULL,
  status            event_status  NOT NULL DEFAULT 'DRAFT',
  activated_at      TIMESTAMPTZ,
  deactivated_at    TIMESTAMPTZ,
  registration_open BOOLEAN       NOT NULL DEFAULT FALSE,
  max_teams         INTEGER       CHECK (max_teams > 0),
  description       TEXT,
  website_url       TEXT,
  created_by        UUID          NOT NULL,  -- FK to users (enforced app-level to avoid circular dep)
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT events_dates_check CHECK (end_date >= start_date)
);

CREATE TABLE venues (
  venue_id          UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  name              VARCHAR(300)  NOT NULL,
  city              VARCHAR(200)  NOT NULL,
  country_code      CHAR(2)       NOT NULL,
  latitude          NUMERIC(9,6)  NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude         NUMERIC(9,6)  NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  capacity          INTEGER       CHECK (capacity > 0),
  address           TEXT,
  timezone          VARCHAR(100)  NOT NULL,
  is_active         BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE teams (
  team_id           UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  name              VARCHAR(200)  NOT NULL,
  country_code      CHAR(2)       NOT NULL,
  sport             sport_type    NOT NULL,
  logo_url          TEXT,
  group_code        VARCHAR(10),
  is_active         BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- M:N pivot: which teams participate in which event
CREATE TABLE event_teams (
  event_id          UUID          NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
  team_id           UUID          NOT NULL REFERENCES teams(team_id)   ON DELETE CASCADE,
  registered_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  PRIMARY KEY (event_id, team_id)
);

CREATE TABLE host_cities (
  host_city_id      UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id          UUID          NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
  city              VARCHAR(200)  NOT NULL,
  country_code      CHAR(2)       NOT NULL,
  timezone          VARCHAR(100)  NOT NULL,
  status            host_city_status NOT NULL DEFAULT 'PENDING',
  primary_languages TEXT[]        NOT NULL DEFAULT '{"en"}',
  phrase_cards_ready BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, city, country_code)
);

CREATE TABLE matches (
  match_id          UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id          UUID          NOT NULL REFERENCES events(event_id)  ON DELETE CASCADE,
  venue_id          UUID          NOT NULL REFERENCES venues(venue_id)  ON DELETE RESTRICT,
  home_team_id      UUID          REFERENCES teams(team_id)             ON DELETE SET NULL,
  away_team_id      UUID          REFERENCES teams(team_id)             ON DELETE SET NULL,
  match_number      INTEGER       NOT NULL CHECK (match_number > 0),
  round             VARCHAR(100)  NOT NULL,
  kickoff_utc       TIMESTAMPTZ   NOT NULL,
  kickoff_local     TIMESTAMPTZ   NOT NULL,
  status            match_status  NOT NULL DEFAULT 'SCHEDULED',
  score_home        SMALLINT      CHECK (score_home >= 0),
  score_away        SMALLINT      CHECK (score_away >= 0),
  is_featured       BOOLEAN       NOT NULL DEFAULT FALSE,
  notes             TEXT,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, match_number)
);

-- ─── Audit log for activation lifecycle ─────────────────────────────────────
CREATE TABLE event_activation_log (
  log_id            UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id          UUID          NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
  action            VARCHAR(50)   NOT NULL, -- 'ACTIVATED', 'DEACTIVATED'
  performed_by      UUID          NOT NULL,
  performed_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  metadata          JSONB
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX idx_events_status      ON events(status);
CREATE INDEX idx_events_sport       ON events(sport);
CREATE INDEX idx_events_start_date  ON events(start_date);
CREATE INDEX idx_matches_event      ON matches(event_id);
CREATE INDEX idx_matches_kickoff    ON matches(kickoff_utc);
CREATE INDEX idx_matches_status     ON matches(status);
CREATE INDEX idx_host_cities_event  ON host_cities(event_id);
CREATE INDEX idx_event_teams_event  ON event_teams(event_id);
CREATE INDEX idx_event_teams_team   ON event_teams(team_id);

-- ─── Updated-at triggers ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_venues_updated_at
  BEFORE UPDATE ON venues
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_teams_updated_at
  BEFORE UPDATE ON teams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_host_cities_updated_at
  BEFORE UPDATE ON host_cities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_matches_updated_at
  BEFORE UPDATE ON matches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMIT;