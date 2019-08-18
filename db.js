const config = require('../config');

const winston = require('winston')
import uuidv4 from 'uuid/v4';
const { Pool } = require('pg');

const myWinstonOptions = {
    transports: [new winston.transports.Console()]
}

const logger = new winston.createLogger(myWinstonOptions)

const pool = config.db.connectionString && new Pool(config.db);

if (pool) {
  pool.on('connect', () => {
    logger.info('connected to the db');
  });
}

function createTables() {
  const queryText =
    'CREATE TABLE IF NOT EXISTS invitations (id UUID PRIMARY KEY, email_address TEXT NOT NULL)';

  pool.query(queryText)
    .then((res) => {
      console.log(res);
      pool.end();
    })
    .catch((err) => {
      logger.error(err);
      pool.end();
    });
}

function storeEmailAddress(emailAddress) {
  const sql = `INSERT INTO invitations (id, email_address) VALUES ($1, $2) returning id`;
  const values = [uuidv4(), emailAddress];

  return pool.query(sql, values)
    .then(rows => { {emailAddress, token: rows[0].id} });
};
function findInvite(token) {
  const sql = `SELECT id, email_address FROM invitations WHERE id = $1 LIMIT 1`;
  const values = [token];

  return pool.query(sql, values)
    .then(rows => { {emailAddress, token: rows[0]} });
};
function removeInvite(token) {
  const sql = `DELETE FROM invitations WHERE id = $1`;
  const values = [token];

  return pool.query(sql, values);
};

module.exports = {
  logger, storeEmailAddress, findInvite, removeInvite, createTables
};
