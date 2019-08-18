const config = require('../config')
const sendgrid = require('sendgrid');

const {getBody} = require('./common');

const from_email = new sendgrid.mail.Email(config.email.from);
const to_email = new sendgrid.mail.Email(config.email.approver);
const subject = `A new user wants to join ${config.community}`;

const sg = sendgrid(config.email.sendgrid_api_key);

function sendMessageToApprover(invitation) {
  const html = getBody(invitation)
  const content = new sendgrid.mail.Content('text/html', html);
  const mail = new sendgrid.mail.Mail(from_email, subject, to_email, content);

  const request = sg.emptyRequest({
    method: 'POST',
    path: '/v3/mail/send',
    body: mail.toJSON(),
  });

  return new Promise((resolve, reject) => {
    sg.API(request, function(error, response) {
      if (error) {
        return reject(error)
      } else {
        return resolve(response)
      }
    });
  });
};

module.exports = { sendMessageToApprover };
