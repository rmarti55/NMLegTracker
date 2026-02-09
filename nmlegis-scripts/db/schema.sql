CREATE TABLE schema (
       version    INTEGER PRIMARY KEY NOT NULL,
       timestamp  datetime,
       comments   TEXT
);
INSERT INTO schema VALUES (2025021901, datetime('2025-02-19T12:00:00'), 'Checkpoint from Wednesday');
INSERT INTO schema VALUES (2025022101, datetime('2025-02-21T10:00:00'), 'Add committee_reports and committee_report_votes tables');
INSERT INTO schema VALUES (2025022201, datetime('2025-02-22T10:00:00'), 'Rename source,sub to report,cs');
INSERT INTO schema VALUES (2025022202, datetime('2025-02-22T14:45:00'), 'Add website field to trackers');
INSERT INTO schema VALUES (2025022301, datetime('2025-02-24T06:00:00'), 'Add bill_user_reports table');
INSERT INTO schema VALUES (2025022401, datetime('2025-02-24T07:00:00'), 'users table: new column, can_update_bills');
INSERT INTO schema VALUES (2025030301, datetime('2025-03-03T15:00:00'), 'bills: add blurb column');
INSERT INTO schema VALUES (2025030401, datetime('2025-03-04T09:00:00'), 'sessions: add start/end times');
INSERT INTO schema VALUES (2025090901, datetime('2025-09-09T09:00:00'), 'password reset');
INSERT INTO schema VALUES (2026012201, datetime('2026-01-22T07:00:00'), 'add session to committee_reports');
INSERT INTO schema VALUES (2026012202, datetime('2026-01-22T14:00:00'), 'add session to floor_votes');

CREATE TABLE users (
       id         INTEGER PRIMARY KEY AUTOINCREMENT,
       email      TEXT UNIQUE COLLATE NOCASE NOT NULL,
       password   TEXT NOT NULL,
       firstname  TEXT,
       lastname   TEXT,
       hdistrict  INTEGER,
       sdistrict  INTEGER,
       can_update_bills BOOLEAN
);

/* FIXME: this is going to need work */
CREATE TABLE sessions (
       id     INTEGER PRIMARY KEY AUTOINCREMENT,
       name   TEXT NOT NULL,
       start  INTEGER,
       end    INTEGER
);
INSERT INTO sessions VALUES (2021, '2021 Regular', 0, 0);
INSERT INTO sessions VALUES (2022, '2022 Regular', 0, 0);
INSERT INTO sessions VALUES (2023, '2023 Regular', 0, 0);
INSERT INTO sessions VALUES (2024, '2024 Regular', 0, 0);
INSERT INTO sessions VALUES (2025, '2025 Regular', 1737486000, 1742666400);
INSERT INTO sessions VALUES (202501, '2025 Special', 1759341600, 0);
INSERT INTO sessions VALUES (2026, '2026 Regular', 1768935600, 1771527600);

CREATE TABLE bills (
       id        INTEGER PRIMARY KEY AUTOINCREMENT,
       session   INTEGER  NOT NULL,
       code      CHAR(10) NOT NULL,    /* e.g. HJR123 */
       chamber   CHAR(1)  NOT NULL,    /*      H      */
       type      CHAR(5)  NOT NULL,    /*       JR    */
       number    INTEGER  NOT NULL,    /*         123 */
       title     TEXT NOT NULL,
       blurb     TEXT,
       actions   TEXT,
       emergency CHAR(1),

       FOREIGN KEY(session) REFERENCES sessions(id),
       UNIQUE  (session, code COLLATE NOCASE)
);

CREATE TABLE bill_updates (
       timestamp    INTEGER UNSIGNED NOT NULL,
       billid       INTEGER NOT NULL,
       event        TEXT NOT NULL,

       FOREIGN KEY(billid)       REFERENCES bills(id)
);

CREATE TABLE bill_user_reports (
       timestamp    INTEGER UNSIGNED NOT NULL,
       billid       INTEGER PRIMARY KEY ON CONFLICT REPLACE,
       userid       INTEGER NOT NULL,
       action       TEXT NOT NULL,

       FOREIGN KEY(billid)       REFERENCES bills(id),
       FOREIGN KEY(userid)       REFERENCES users(id)
);

CREATE TABLE legislators (
       id        INTEGER PRIMARY KEY AUTOINCREMENT,
       chamber   CHAR(1)  NOT NULL,
       code      CHAR(10) UNIQUE COLLATE NOCASE NOT NULL,
       firstname TEXT NOT NULL,
       lastname  TEXT NOT NULL,
       district  INT,
       county    TEXT,
       party     CHAR(10),
       lead_position TEXT,
       service   TEXT,
       occupation TEXT,
       office    TEXT,
       email     TEXT,
       phone     TEXT,
       office_phone TEXT,
       alt_phone TEXT,
       district_legislative_aide TEXT,
       district_legislative_aide_email TEXT,
       district_legislative_aide_phone TEXT,
       extra_information               TEXT,
       session_secretary_email         TEXT
);

CREATE TABLE legislator_updates (
       timestamp    INTEGER UNSIGNED NOT NULL,
       legislatorid INTEGER NOT NULL,
       event        TEXT NOT NULL,

       FOREIGN KEY(legislatorid)       REFERENCES legislators(id)
);

CREATE TABLE sponsors (
       billid       INTEGER NOT NULL,
       legislatorid INTEGER NOT NULL,
       sequence     INTEGER NOT NULL,

       FOREIGN KEY(billid)       REFERENCES bills(id),
       FOREIGN KEY(legislatorid) REFERENCES legislators(id),

       UNIQUE (billid, legislatorid)
);

CREATE TABLE committees (
       id       INTEGER PRIMARY KEY AUTOINCREMENT,
       chamber  CHAR(1)  NOT NULL,
       code     CHAR(10) UNIQUE COLLATE NOCASE NOT NULL,
       name     TEXT     NOT NULL,
       room     TEXT,
       days     TEXT,           /* FIXME: how to do days_parsed */
       time     TEXT
);

CREATE TABLE committee_updates (
       timestamp    INTEGER UNSIGNED NOT NULL,
       committeeid  INTEGER NOT NULL,
       event        TEXT NOT NULL,

       FOREIGN KEY(committeeid)       REFERENCES committees(id)
);

CREATE TABLE committee_members (
       committeeid  INTEGER NOT NULL,
       legislatorid INTEGER NOT NULL,
       role         TEXT    NOT NULL,

       FOREIGN KEY(committeeid)  REFERENCES committees(id),
       FOREIGN KEY(legislatorid) REFERENCES legislators(id)
);

CREATE TABLE committee_reports (
       id           INTEGER PRIMARY KEY AUTOINCREMENT,
       committeeid  INTEGER NOT NULL,
       billid       INTEGER NOT NULL,
       reportnum    INTEGER NOT NULL,
       date         TEXT    NOT NULL,
       report       TEXT    NOT NULL,      /* URL to HB0123XX1.HTML */
       cs           TEXT,                  /* URL to committee subst */
       session      INTEGER NOT NULL,

       FOREIGN KEY(committeeid)  REFERENCES committees(id),
       FOREIGN KEY(billid)       REFERENCES bills(id),
       UNIQUE (committeeid, billid, reportnum)
);

CREATE TABLE committee_report_votes (
       reportid     INTEGER NOT NULL,
       legislatorid INTEGER NOT NULL,
       vote         TEXT,

       FOREIGN KEY(reportid)     REFERENCES committee_reports(id),
       FOREIGN KEY(legislatorid) REFERENCES legislators(id),
       UNIQUE (reportid, legislatorid)
);

CREATE TABLE committee_votes (
       committeeid  INTEGER NOT NULL,
       legislatorid INTEGER NOT NULL,
       billid       INTEGER NOT NULL,
       date         CHAR    NOT NULL,
       vote         CHAR    NOT NULL,

       FOREIGN KEY(committeeid)  REFERENCES committees(id),
       FOREIGN KEY(legislatorid) REFERENCES legislators(id),
       FOREIGN KEY(billid) REFERENCES bills(id)
);

/* Good candidate for normalizing */
CREATE TABLE floor_votes (
       chamber      CHAR(1) NOT NULL,
       billid       INTEGER NOT NULL,
       date         CHAR    NOT NULL,
       legislatorid INTEGER NOT NULL,
       vote         CHAR    NOT NULL,
       session      INTEGER NOT NULL,

       FOREIGN KEY(legislatorid) REFERENCES legislators(id),
       FOREIGN KEY(billid) REFERENCES bills(id)
);

CREATE TABLE trackers (
       id          INTEGER PRIMARY KEY AUTOINCREMENT,
       name        TEXT UNIQUE COLLATE NOCASE NOT NULL,
       description TEXT NOT NULL,
       owner       INTEGER NOT NULL,
       is_public   BOOLEAN,
       website     TEXT,

       FOREIGN KEY(owner) REFERENCES users(id)
);

/* Tracker permissions and subscriptions */
CREATE TABLE tracker_access (
       trackerid  INTEGER NOT NULL,
       userid     INTEGER NOT NULL,
       access     CHAR(1),       /* 'r' or 'w' */
       subscribed BOOLEAN,

       FOREIGN KEY(trackerid) REFERENCES trackers(id),
       FOREIGN KEY(userid)    REFERENCES users(id),
       UNIQUE (trackerid, userid)
);

CREATE TABLE tracked (
       trackerid INTEGER NOT NULL,
       billid    INTEGER NOT NULL,
       category  TEXT NOT NULL,         /* FIXME! Multiple categories? */
       oppose    BOOLEAN,

       FOREIGN KEY(trackerid) REFERENCES trackers(id),
       FOREIGN KEY(billid)    REFERENCES bills(id)
);

CREATE TABLE tracking_history (
       id        INTEGER PRIMARY KEY AUTOINCREMENT, /* useful for cleanup */
       timestamp INTEGER UNSIGNED NOT NULL,
       userid    INTEGER NOT NULL,
       trackerid INTEGER NOT NULL,
       billid    INTEGER NOT NULL,
       comment   TEXT,

       FOREIGN KEY(userid)    REFERENCES users(id),
       FOREIGN KEY(trackerid) REFERENCES trackers(id),
       FOREIGN KEY(billid)    REFERENCES bills(id)
);

/* 2025-09 password reset */
CREATE TABLE reset_tokens (
       token      TEXT PRIMARY KEY,
       userid     INTEGER NOT NULL,
       created    INTEGER NOT NULL,

       FOREIGN KEY(userid) REFERENCES users(id)
);
