const config = require('../config');

const sendgrid = require('sendgrid');

const from_email = new sendgrid.mail.Email(config.email.from);
const to_email = new sendgrid.mail.Email(config.email.approver);
const subject = `A new user wants to join ${config.community}`;

const sg = sendgrid(config.email.sendgrid_api_key);

function sendMessageToApprover(invitation) {
  const html = `
    <h1>New request to join ${config.community}</h1>

    <p>
    We have received a new request to join ${config.community} on Slack.
    If you would like to approve this request, pease click on the link below:
    </p>

    <a class="approval-link" href="${approvalLink(invitation)}">
      Invite ${invitation.emailAddress} to join ${config.community}
    </a>
  `;
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
