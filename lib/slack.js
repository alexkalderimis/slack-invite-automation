const request = require('request');

const DB     = require('../db');
const config = require('../config');

const { logger }  = require('../logger');

// requires: chat:write:bot
function sendMessageToChannel(text, attachments, channel) {
  const options = {
    url: `https://${config.slackUrl}/api/chat.postMessage`,
    form: {
      channel: config.approval.slackChannel,
      text: text,
      attachments: attachments,
      token: config.slacktoken
    }
  };
  return new Promise((resolve, reject) => {
    request.post(options, function (err, _httpResponse, body) {
      if (err) return reject(err);

      let data = null;
      try {
        let data = JSON.parse(body);
      } catch (e) {
        return reject(new Error(`Could not parse slack response: ${e}`));
      }
      if (data.ok) return resolve();

      return reject(new Error(data.error));
    });
  });
}

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

// see https://github.com/ErikKalkoken/slackApiDoc/blob/master/users.admin.invite.md
// for details on permissions, API responses and token type
function inviteToSlack(emailAddress, token) {
  const options = {
    url: `https://${config.slackUrl}/api/users.admin.invite`,
    form: {
      email: emailAddress,
      token: config.slacklegacytoken,
      set_active: true
    }
  };

  const accepted = new Promise((resolve, reject) => {
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

module.exports = { sendMessageToChannel, inviteToSlack, findUserByEmail };
