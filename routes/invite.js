const request = require('request');

const DB     = require('../db');
const config = require('../config');
const router = require('../router');
const Approve = require('../approve');

const { logger }  = require('../logger');

function inviteUser(emailAddress, cb, token) {
  if (!token && approvalNeeded) {
    return DB.findInviteByEmailAddress(emailAddress)
      .then(invite => {
        if (invite && invite.state === DB.PENDING) {
          return Promise.reject('Invitation is still pending');
        } else if (invite && invite.state === DB.ACCEPTED) {
          return Promise.reject('Invitation has already been accepted');
        } else if (invite && invite.state === DB.REJECTED) {
          return Promise.reject('Invitation has already been rejected');
        } else if (invite) {
          return Promise.reject(new Error('Unknown invitation state'));
        } else {
          return DB.storeEmailAddress(emailAddress);
        }
      })
      .then(Approve.sendMessageToApprover)
      .then(function () {
        cb(null, { ok: false, error: 'approval_needed' });
      }, function(e) {
        logger.error(e);
        cb(e, null);
      });
  } else {
    if (token) {
      DB.markAccepted(token).then(() => {
        logger.info(`accepted invitation for ${emailAddress}`)
      }, (e) => {
        logger.error(`error accepting invitation for ${emailAddress}: ${e}`);
      });
    }
    const options = {
      url: 'https://'+ config.slackUrl + '/api/users.admin.invite',
      form: {
        email: emailAddress,
        token: config.slacktoken,
        set_active: true
      }
    };
    request.post(options, function (err, _httpResponse, body) {
      if (err) {
        cb(err, null);
      } else {
        try {
          let data = JSON.parse(body);
          cb(null, data);
        } catch (e) {
          cb(new Error(e), null)
        }
      }
    });
  }
}

function doInvite(req, res) {
  const options = {
    url: `https://${config.slackUrl}/api/users.lookupByEmail`,
    qs: { token: config.slacktoken, email: req.body.email }
  };
  request.get(options, function (e, _r, body) {
    if (e) return res.send('Error: ' + e);

    let data = JSON.parse(body);

    if (data.ok && !data.error) {
      return res.render('result', {
        community: config.community,
        message: 'You are already a member!'
      });
    } else if (data.error !== 'users_not_found') {
      return res.send('Error: ' + data.error);
    } else {
      inviteUser(req.body.email, function(err, body) {
        if (err) { return res.send('Error:' + err); }
        // body looks like:
        //   {"ok":true}
        //       or
        //   {"ok":false,"error":"already_invited"}
        if (body.ok) {
          res.render('result', {
            community: config.community,
            message: `Success! Check &ldquo;${req.body.email}&rdquo; for an invite from Slack.`
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
  });
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

module.exports = { inviteUser, router };
