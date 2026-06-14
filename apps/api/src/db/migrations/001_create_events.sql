-- Migration: 001_create_events
-- Creates all tables for the Event Registry chunk.

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── events ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS events (
  event_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              VARCHAR(200) NOT NULL,
  edition           VARCHAR(50),
  sport             VARCHAR(30) NOT NULL,
  governing_body    VARCHAR(100),
  description       TEXT,
  logo_url          TEXT,
  banner_url        TEXT,
  start_date        TIMESTAMPTZ NOT NULL,
  end_date          TIMESTAMPTZ NOT NULL,
  registration_open_date TIMESTAMPTZ,
  status            VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
                      CHECK (status IN ('DRAFT','SCHEDULED','ACTIVE','COMPLETED','CANCELLED')),
  host_countries    TEXT[] NOT NULL DEFAULT '{}',
  is_multi_country  BOOLEAN NOT NULL DEFAULT FALSE,
  max_teams         INTEGER,
  official_website  TEXT,
  communities_seeded BOOLEAN NOT NULL DEFAULT FALSE,
  activation_date   TIMESTAMPTZ,
  created_by        UUID NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT events_dates_valid CHECK (end_date > start_date),
  CONSTRAINT events_reg_date_valid CHECK (
    registration_open_date IS NULL OR registration_open_date <= start_date
  ),
  CONSTRAINT events_max_teams_positive CHECK (max_teams IS NULL OR max_teams > 0)
);

CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_events_sport ON events(sport);
CREATE INDEX idx_events_start_date ON events(start_date);
CREATE INDEX idx_events_created_by ON events(created_by);

-- ─── host_cities ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS host_cities (
  host_city_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id           UUID NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
  city_name          VARCHAR(100) NOT NULL,
  country_code       CHAR(2) NOT NULL,
  country_name       VARCHAR(100) NOT NULL,
  stadium_name       VARCHAR(200) NOT NULL,
  stadium_capacity   INTEGER,
  timezone           VARCHAR(100) NOT NULL,
  latitude           NUMERIC(9,6),
  longitude          NUMERIC(9,6),
  community_trigger_status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
    CHECK (community_trigger_status IN ('PENDING','SEEDED','FAILED')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT host_cities_capacity_positive CHECK (stadium_capacity IS NULL OR stadium_capacity > 0)
);

CREATE INDEX idx_host_cities_event_id ON host_cities(event_id);
CREATE INDEX idx_host_cities_country_code ON host_cities(country_code);

-- ─── participating_teams ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS participating_teams (
  team_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
  team_name     VARCHAR(100) NOT NULL,
  country_code  CHAR(2) NOT NULL,
  country_name  VARCHAR(100) NOT NULL,
  team_code     VARCHAR(10),
  logo_url      TEXT,
  group_name    VARCHAR(50),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (event_id, country_code)
);

CREATE INDEX idx_participating_teams_event_id ON participating_teams(event_id);
CREATE INDEX idx_participating_teams_country_code ON participating_teams(country_code);

-- ─── match_schedules ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS match_schedules (
  match_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
  host_city_id    UUID NOT NULL REFERENCES host_cities(host_city_id) ON DELETE RESTRICT,
  match_number    INTEGER NOT NULL,
  stage           VARCHAR(50) NOT NULL,
  team_home_id    UUID REFERENCES participating_teams(team_id) ON DELETE SET NULL,
  team_away_id    UUID REFERENCES participating_teams(team_id) ON DELETE SET NULL,
  kickoff_utc     TIMESTAMPTZ NOT NULL,
  kickoff_local   TIMESTAMPTZ NOT NULL,
  gates_open_utc  TIMESTAMPTZ,
  venue_name      VARCHAR(200) NOT NULL,
  is_final        BOOLEAN NOT NULL DEFAULT FALSE,
  status          VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED'
    CHECK (status IN ('SCHEDULED','LIVE','COMPLETED','POSTPONED','CANCELLED')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (event_id, match_number)
);

CREATE INDEX idx_match_schedules_event_id ON match_schedules(event_id);
CREATE INDEX idx_match_schedules_host_city_id ON match_schedules(host_city_id);
CREATE INDEX idx_match_schedules_kickoff_utc ON match_schedules(kickoff_utc);

-- ─── updated_at trigger function ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER events_set_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER host_cities_set_updated_at
  BEFORE UPDATE ON host_cities
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER participating_teams_set_updated_at
  BEFORE UPDATE ON participating_teams
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER match_schedules_set_updated_at
  BEFORE UPDATE ON match_schedules
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();