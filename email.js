const config = require('./config');

function getBody(invitation) {
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

  return html;
}

if (config.email.sendgrid_api_key) {
  module.exports = require('./email/sendgrid')(getBody);
} else if (config.email.gmail_credentials_file) {
  module.exports = require('./email/gmail')(getBody);
}
