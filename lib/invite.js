const request = require('request');

const config = require('../config');
const DB     = require('../db');
const Approve = require('../approve');
const { logger }  = require('../logger');

const Slack = require('./slack');

const approvalNeeded = !!config.approvalMechanism;

function sendInvitation(invitation) {
  const token = invitation.token;
  const emailAddress = invitation.email_address;

  if (!token && approvalNeeded) {
    return DB.findInviteByEmailAddress(emailAddress)
      .then(invite => {
        if (!invite) return DB.storeEmailAddress(emailAddress);

        switch (invite.state) {
          case DB.PENDING:
            return Promise.reject('Invitation is still pending');
          case DB.ACCEPTED:
            return Promise.reject('Invitation has already been accepted');
          case DB.REJECTED:
            return Promise.reject('Invitation has already been rejected');
          default:
            return Promise.reject(new Error('Unknown invitation state'));
        }
      })
      .then(Approve.sendMessageToApprover)
      .then(() => ({ ok: false, error: 'approval_needed' }));
  } else {
    return Slack.inviteToSlack(emailAddress, token);
  }
}

module.exports = { sendInvitation };
