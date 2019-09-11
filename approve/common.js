const config = require('../config');

function getText(invitation) {
  const text = `
    New request to join ${config.community}
    =========================================

    We have received a new request from ${invitation.emailAddress}
    to join ${config.community} on Slack.  If you would like to
    approve this request, pease click on the link below:

    ${approvalLink(invitation)}

    Your friendly slack bot!
  `;

  return text;
}

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

function approvalLink(invitation) {
  return `${config.baseURL}/approve/${invitation.token}`;
}

module.exports = { approvalLink, getText, getBody };
