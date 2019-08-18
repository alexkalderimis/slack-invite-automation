const config = require('../config');
const request = require('request');

const { approvalLink } = require('./common');

function sendMessageToApprover(invitation) {
  const options = {
    url: 'https://'+ config.slackUrl + '/api/chat.postMessage',
    form: {
      channel: config.approval.slackChannel,
      text: `${invitation.emailAddress} wants to join ${config.community}`,
      attachments: [
          {
            text: `Click here to approve them: ${approvalLink(invitation)}`
          }
      ]
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
        return reject(e);
      }
      if (data.ok) return resolve();

      return reject(new Error(data.error));
    });
  });
}

module.exports = { sendMessageToApprover };
