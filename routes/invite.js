const request = require('request');

const DB     = require('../db');
const config = require('../config');
const router = require('../router');
const Invite = require('../lib/invite');
const Slack = require('../lib/slack');

const { logger }  = require('../logger');

function inviteUser(emailAddress, cb, token) {
  return Invite.sendInvitation({email_address: emailAddress, token})
               .then(body => cb(null, body), err => cb(err, null));
};

function doInvite(req, res) {
  const emailAddress = req.body.email;

  Slack.findUserByEmail(emailAddress)
       .then(user => {
         if (user) {
           return res.render('result', {
             community: config.community,
             message: 'You are already a member!'
           });
         } else {
           inviteUser(emailAddress, function(err, body) {
             if (err) {
               return res.render('result', {
                 community: config.community,
                 isFailed: true,
                 message: String(err)
               });
             }
             // body looks like:
             //   {"ok":true}
             //       or
             //   {"ok":false,"error":"already_invited"}
             if (body.ok) {
               res.render('result', {
                 community: config.community,
                 message: `Success! Check &ldquo;${emailAddress}&rdquo; for an invite from Slack.`
               });
             } else {
               let error = body.error;
               let message = error;
               let isFailed = true;
               if (error === 'already_invited' || error === 'already_in_team') {
                 // not really an error, from the point of view of the user.
                 return res.render('result', {
                   community: config.community,
                   isFailed: false,
                   message: `
                     <h2>Success!</h2>
                     <p>You have already been invited.</p>
                     <br>
                     <p>Visit <a href="https://${config.slackUrl}">${config.community}</a></p>
                     `
                 });
               } else if (error === 'invalid_email') {
                 message = 'Failed: The email you entered is an invalid email.';
               } else if (error === 'approval_needed') {
                 message = 'Your invitation is waiting to be approved.';
                 isFailed = false;
               } else if (error === 'invalid_auth') {
                 logger.error(body);
                 message = 'Error: Something has gone wrong. Please contact a system administrator.';
               }

               res.render('result', { ...config, message, isFailed });
             }
           });
         }
       }).catch(e => res.send(`Failed to query ${config.community} for ${emailAddress}: ${e}`));
}

router.post('/invite', function(req, res) {
  if (req.body.email && (!config.inviteToken || (!!config.inviteToken && req.body.token === config.inviteToken))) {
    if (!!config.recaptchaSiteKey && !!config.recaptchaSecretKey) {
      request.post({
        url: 'https://www.google.com/recaptcha/api/siteverify',
        form: {
          response: req.body['g-recaptcha-response'],
          secret: config.recaptchaSecretKey
        }
      }, function(err, httpResponse, body) {
        if (typeof body === "string") {
          body = JSON.parse(body);
        }

        if (body.success) {
          doInvite(req, res);
        } else {
          error = 'Invalid captcha.';
          res.render('result', {
            community: config.community,
            message: 'Failed! ' + error,
            isFailed: true
          });
        }
      });
    } else {
      doInvite(req, res);
    }
  } else {
    const problems = [];
    if (!req.body.email) {
      problems.push('your email is required');
    }

    if (!!config.inviteToken) {
      if (!req.body.token) {
        problems.push('a valid token is required');
      }

      if (req.body.token && req.body.token !== config.inviteToken) {
        problems.push('the token you entered is wrong');
      }
    }

    res.render('result', {
      community: config.community,
      message: `Failed! ${problems.join(', and ')}.`,
      isFailed: true
    });
  }
});

module.exports = router;
