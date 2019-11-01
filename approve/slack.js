const config = require('../config');
const Slack = require('../lib/slack');

const { approvalLink } = require('./common');

module.exports = {
  sendMessageToApprover: invitation => {
    const text = `${invitation.emailAddress} wants to join ${config.community}`;
    const attachment = `Click here to approve them: ${approvalLink(invitation)}`;

    return Slack.sendMessageToChannel(text, [attachment], config.approval.slackChannel);
  }
}
