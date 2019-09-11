const config = require('../config')

const sgMail = require('@sendgrid/mail');

const {getText, getBody} = require('./common');

// const from_email = new sendgrid.mail.Email(config.email.from);
// const to_email = new sendgrid.mail.Email(config.email.approver);
const subject = `A new user wants to join ${config.community}`;

sgMail.setApiKey(config.email.sendgrid_api_key);

function sendMessageToApprover(invitation) {
  const html = getBody(invitation);
  const text = getText(invitation);
  // const content = new sendgrid.mail.Content('text/html', html);
  const mail = {
    to: { email: config.email.from },
    from: { email: config.email.approver },
    subject, text, html,
  };
  // const mail = new sendgrid.mail.Mail(from_email, subject, to_email, content);
  return sgMail.send(mail);
};

module.exports = { sendMessageToApprover };
