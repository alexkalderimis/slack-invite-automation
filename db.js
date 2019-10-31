const fs = require('fs').promises;

const config = require('./config');
const { logger }  = require('./logger');

const uuidv4 = require('uuid/v4');
const { Pool } = require('pg');

const pool = config.db.connectionString && new Pool(config.db);

if (pool) {
  pool.on('connect', () => {
    logger.info('Connection to database established');
  });
  pool.on('error', (err, client) => {
    logger.error('Unexpected error on idle client', err)
    process.exit(-1)
  });
}

function initDB() {
  return pool.connect().then(createTables).then(migrate).catch(e => {
    logger.error({error: `${e}`, message: 'Could not initialize DB'});
    process.exit(1);
  });
}

function closeDB() {
  return pool.end();
}

const STATES = ['PENDING', 'ACCEPTED', 'REJECTED'];
const PENDING = 0;
const ACCEPTED = 1;
const REJECTED = 2;

function mostRecentMigration() {
  const existsSQL = `SELECT 1 AS PROOF FROM migrations LIMIT 1`;

  return pool.query(existsSQL).then(res => {
    if (res.rows.length == 0) {
      return -1;
    }
    const sql = `
       SELECT MAX(migration_id) AS current_migration FROM migrations
    `;
    return pool.query(sql).then(res => res.rows[0].current_migration);
  });
};

function migrate() {
  logger.info('migrating');
  const pattern = /^0*\d+\.[^.]+.sql$/;
  const opts = { encoding: 'utf8' };

  const allMigrations = (entries) => Promise.all(entries.filter(e => pattern.test(e)).map(entry => {
    const [id, desc] = entry.split('.');
    const migration_id = parseInt(id, 10);
    logger.info(`Found ${migration_id}, ${desc}`);
    return fs.readFile(`./migrations/${entry}`, opts).then(sql => {
      return { migration_id, sql, desc, };
    });
  }));

  return mostRecentMigration().then(n => {
    logger.info(`Most recent migration: ${n}`);
    return fs.readdir('./migrations')
      .then(allMigrations)
      .then(migrations => migrations.filter(m => m.migration_id > n)
                                    .sort((a,b) => b.migration_id - a.migration_id))
      .then(runAllMigrations);
  });

};

function createTables(client) {
  const queries = [
    `CREATE TABLE IF NOT EXISTS invitations (
      id UUID PRIMARY KEY,
      email_address TEXT NOT NULL
    )`,
    `CREATE UNIQUE INDEX
      IF NOT EXISTS unique_invitations_email_address
      ON invitations ((lower(email_address)))`,
    `CREATE UNIQUE INDEX
      IF NOT EXISTS unique_invitations_email_address_id
      ON invitations (email_address, id)`,
    `CREATE TABLE IF NOT EXISTS migrations (
      id UUID PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT (now() at time zone 'utc'),
      migration_id integer NOT NULL
    )`,
    `CREATE INDEX
      IF NOT EXISTS migrations_migration_id
      ON migrations (migration_id)`,
  ]

  let run = (p, q) => p.then(res => {
    logger.info(`Running: ${q}`);
    return client.query(q).then(x => logger.info(x.command));
  });

  logger.info('Setting up tables');

  let res = queries.reduce(run, Promise.resolve());

  return res
    .then((res) => {
      logger.info('Created base schema');
    })
    .catch((err) => {
      logger.error(err);
      throw new Error('Base schema creation failed');
    }).finally(() => client.release());
}

function runAllMigrations(migrations) {
  let run = (p, m) => p.then(res => {
    logger.info(`Running: ${m.migration_id} (${m.desc})`);

    return pool.connect().then(client => {
      return client.query('BEGIN')
               .then(() => client.query(m.sql))
               .then(x => logger.info(x.command))
               .then(() => {
                 const sql = `INSERT INTO migrations (id, migration_id)
                                     VALUES ($1, $2)`;
                 return client.query(sql, [uuidv4(), m.migration_id]);
               })
               .then(() => client.query('COMMIT'))
               .catch(e => {
                 logger.error({error: e, message: String(e)});
                 client.query('ROLLBACK');
                 throw e;
               }).finally(() => client.release());
    });
  });

  return migrations.reduce(run, Promise.resolve());
};

function storeEmailAddress(emailAddress) {
  const sql = `INSERT INTO invitations (id, email_address) VALUES ($1, $2) returning id`;
  const values = [uuidv4(), emailAddress];

  return pool.query(sql, values)
      .then(res => {
        token = res.rows[0].id;
        return { emailAddress, token };
      });
};

function findInviteByEmailAddress(email_address) {
  const sql = `
     SELECT id AS token, email_address, state FROM invitations
     WHERE lower(email_address) = lower($1)
     LIMIT 1
  `;
  const values = [email_address];

  return pool.query(sql, values).then(res => res.rows[0]);
};

function findPendingInvites() {
  const sql = `
     SELECT id AS token, email_address FROM invitations
     WHERE state = $1
     ORDER BY created_at ASC
  `;
  const values = [PENDING];
  return pool.query(sql, values).then(res => res.rows);
};

function findInvite(token) {
  const sql = `
    SELECT id AS token, email_address, state FROM invitations
    WHERE id = $1
    LIMIT 1
  `;
  const values = [token];

  return pool.query(sql, values).then(res => res.rows[0]);
};

function markAccepted(token) {
  const sql = `UPDATE invitations SET state = $2 WHERE id = $1`;
  const values = [token, ACCEPTED];

  return pool.query(sql, values);
};

function markRejected(token) {
  const sql = `UPDATE invitations SET state = $2 WHERE id = $1`;
  const values = [token, REJECTED];

  return pool.query(sql, values);
};

function removeInvite(token) {
  const sql = `DELETE FROM invitations WHERE id = $1`;
  const values = [token];

  return pool.query(sql, values);
};

module.exports = {
  STATES, PENDING, ACCEPTED, REJECTED,
  migrate, createTables, initDB, closeDB,
  storeEmailAddress, findPendingInvites, removeInvite,
  findInviteByEmailAddress, findInvite,
  markRejected, markAccepted,
};
