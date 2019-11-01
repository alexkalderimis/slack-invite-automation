const request = require('request');

const DB     = require('../db');
const config = require('../config');
const router = require('../router');
const Approve = require('../approve');
const Slack = require('./slack');

const { logger }  = require('../logger');

function findUserByEmail(emailAddress) {
  const options = {
    url: `https://${config.slackUrl}/api/users.lookupByEmail`,
    qs: { token: config.slacktoken, email: emailAddress }
  };
  return new Promise((resolve, reject) => {
    request.get(options, function (e, _r, body) {
      if (e) return reject(e);

      let data = JSON.parse(body);

      if (data.ok && !data.error) return resolve(data);
      if (data.error === 'users_not_found') return resolve(null);

      return reject(new Error(data.error));
    });
  });
}

function inviteToSlack(emailAddress, token) {
  const options = {
    url: `https://${config.slackUrl}/api/users.admin.invite`,
    form: {
      email: emailAddress,
      token: config.slacklegacytoken,
      set_active: true
    }
  };

  const accept = new Promise((resolve, reject) => {
    request.post(options, function (err, _httpResponse, body) {
      if (err) return reject(err);


      return resolve(JSON.parse(body));
    });
  });

  accepted.then(() => token && DB.markAccepted(token))
    .then(() => logger.info(`accepted invitation for ${emailAddress}`))
    .catch(e => logger.error(`error accepting invitation for ${emailAddress}: ${e}`));

  return accepted;
}

module.exports = { inviteToSlack, findUserByEmail };
