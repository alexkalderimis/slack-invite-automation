const config = require('./config');

const winston = require('winston')
const uuidv4 = require('uuid/v4');
const { Pool } = require('pg');

const myWinstonOptions = {
    transports: [new winston.transports.Console()]
}

const logger = new winston.createLogger(myWinstonOptions)

const pool = config.db.connectionString && new Pool(config.db);

if (pool) {
  pool.on('connect', () => {
    logger.info('Connected to database established');
  });
  pool.on('error', (err, client) => {
    logger.error('Unexpected error on idle client', err)
    process.exit(-1)
  });
  pool.connect().then(createTables).catch(e => {
    logger.error('Could not create tables');
    process.exit(1);
  });
}

function createTables(client) {
  const queryText =
    'CREATE TABLE IF NOT EXISTS invitations (id UUID PRIMARY KEY, email_address TEXT NOT NULL)';

  return client.query(queryText)
    .then((res) => {
      client.release();
      console.log(res);
    })
    .catch((err) => {
      client.release();
      logger.error(err);
    });
}

function storeEmailAddress(emailAddress) {
  const sql = `INSERT INTO invitations (id, email_address) VALUES ($1, $2) returning id`;
  const values = [uuidv4(), emailAddress];

  return pool.query(sql, values)
      .then(res => {
        token = res.rows[0].id;
        return { emailAddress, token };
      });
};

function findInvite(token) {
  const sql = `SELECT id AS token, email_address FROM invitations WHERE id = $1 LIMIT 1`;
  const values = [token];

  return pool.query(sql, values).then(res => res.rows[0]);
};

function removeInvite(token) {
  const sql = `DELETE FROM invitations WHERE id = $1`;
  const values = [token];

  return pool.query(sql, values);
};

module.exports = {
  logger, storeEmailAddress, findInvite, removeInvite, createTables
};
