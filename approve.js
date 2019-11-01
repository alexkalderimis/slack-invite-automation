const config = require('./config');

switch(config.approvalMechanism) {
  case 'sendgrid':
    module.exports = require('./approve/sendgrid');
    break;
  case 'gmail':
    module.exports = require('./approve/gmail');
    break;
  case 'slack':
    module.exports = require('./approve/slack');
    break;
  case 'mock':
    module.exports = require('./approve/mock');
    break;
  default:
    module.exports = { sendMessageToApprover: () => Promise.reject(new Error('no approval mechanism')) };
}
