const config = require('../config');
const { logger }  = require('../logger');

function sendMessageToApprover(invitation) {
  logger.info(`Hey, ${config.approver}, invite ${invitation.email}!`);
  return Promise.resolve();
}

module.exports = { sendMessageToApprover };
