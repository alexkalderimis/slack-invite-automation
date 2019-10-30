const express = require('express');
const router = express.Router();
const request = require('request');

const config = require('../config');
const { logger }  = require('../logger');
const { badge } = require('../lib/badge');
const DB = require('../db');
const Approve = require('../approve');
const { approvalLink } = require('../approve/common');

const sanitize = require('sanitize');
const approvalNeeded = !!config.approvalMechanism;

router.get('/', function(req, res) {
  res.setLocale(config.locale);
  res.render('index', { community: config.community,
                        approvalNeeded: approvalNeeded,
                        tokenRequired: !!config.inviteToken,
                        recaptchaSiteKey: config.recaptchaSiteKey });
});

router.get('/pending/:token', function(req, res, next) {
  let token = req.params.token;
  if (token !== config.adminToken) {
    return next();
  }

  DB.findPendingInvites().then((invites) => {
    res.render('pending', { invites, approvalLink });
  }).catch(e => {
     res.render('result', {
       community: config.community,
       message: 'Failed! ' + e.message
     });
  });
});

function inviteUser(emailAddress, cb, token) {
  if (!token && approvalNeeded) {
    return DB.findInviteByEmailAddress(emailAddress)
      .then(invite => {
        if (invite) {
          return Promise.reject('Invitation is still pending');
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
      DB.removeInvite(token).then(() => {
        logger.info(`removed invitation for ${emailAddress}`)
      }, (e) => {
        logger.error(`error removing invitation for ${emailAddress}`);
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

router.get('/approve/:token', function(req, res) {
  DB.findInvite(req.params.token).then(invitation => {
    if (invitation) {
      res.render('approve', { ...config, invitation });
    } else {
      res.status(404).send('not found');
    }
  }).catch(e => {
     res.render('result', { community: config.community, message: 'Failed! ' + e });
  });
});

router.post('/approve/:token', function(req, res) {
  DB.findInvite(req.params.token).then(invitation => {
     if (!invitation) return res.status(404).send('Not found');

     if (req.body.approved === 'Approve') {
       return approveInvitation(invitation);
     } else {
       return rejectInvitation(invitation);
     }
   })
   .then(message => res.render('result', { ...config, message }))
   .catch(function (e) {
     res.render('result', {
       community: config.community,
       message: 'Failed! ' + e.message
     });
   });
});

function approveInvitation(invitation) {
  return sendInvitation(invitation)
    .then(() => 'Approved! An invitation has been sent to &ldquo;' + invitation.emailAddress + '&rdquo;');
};

function rejectInvitation(invitation) {
  return DB.removeInvite(invitation.token).then(() => 'The request has been deleted');
};

function sendInvitation(invitation) {
  return new Promise((resolve, reject) => {
    const cb = (err, response) => {
      if (err) return reject(err);

      if (response.ok) return resolve(invitation);

      if (response.error === 'already_invited' || response.error === 'already_in_team') {
        return reject(new Error('This user has already been invited'));
      } else if (response.error === 'invalid_email') {
        return reject(new Error('The email address is invalid'));
      } else if (response.error === 'invalid_auth') {
        return reject(new Error('The request was not authorised. Please check your configuration settings'));
      } else { 
        return reject(new Error(response.error));
      }
    };
    inviteUser(invitation.email_address, cb, invitation.token);
  });
};

router.post('/invite', function(req, res) {
  if (req.body.email && (!config.inviteToken || (!!config.inviteToken && req.body.token === config.inviteToken))) {
    function doInvite() {
      const options = {
        url: 'https://' + config.slackUrl + '/api/users.lookupByEmail',
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
                message: 'Success! Check &ldquo;'+ req.body.email +'&rdquo; for an invite from Slack.'
              });
            } else {
              let error = body.error;
              let message = error;
              let isFailed = true;
              if (error === 'already_invited' || error === 'already_in_team') {
                res.render('result', {
                  community: config.community,
                  message: 'Success! You were already invited.<br>' +
                          'Visit <a href="https://'+ config.slackUrl +'">'+ config.community +'</a>'
                });
                return;
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
          doInvite();
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
      doInvite();
    }
  } else {
    const errMsg = [];
    if (!req.body.email) {
      errMsg.push('your email is required');
    }

    if (!!config.inviteToken) {
      if (!req.body.token) {
        errMsg.push('valid token is required');
      }

      if (req.body.token && req.body.token !== config.inviteToken) {
        errMsg.push('the token you entered is wrong');
      }
    }

    res.render('result', {
      community: config.community,
      message: 'Failed! ' + errMsg.join(' and ') + '.',
      isFailed: true
    });
  }
});

router.get('/badge.svg', (req, res) => {
  request.get({
    url: 'https://'+ config.slackUrl + '/api/users.list',
    qs: {
      token: config.slacktoken,
      presence: true
    }
  }, function(err, httpResponse, body) {
    try {
      body = JSON.parse(body);
    } catch(e) {
      return res.status(404).send('');
    }
    if (!body.members) {
      return res.status(404).send('');
    }

    const members = body.members.filter(function(m) {
      return !m.is_bot;
    });
    const total = members.length;
    const presence = members.filter(function(m) {
      return m.presence === 'active';
    }).length;

    const hexColor = /^([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    sanitize.middleware.mixinFilters(req);

    res.type('svg');
    res.set('Cache-Control', 'max-age=0, no-cache');
    res.set('Pragma', 'no-cache');
    res.send(
        badge(
            presence,
            total,
            req.queryPattern('colorA', hexColor),
            req.queryPattern('colorB', hexColor)
        )
    );
  });
});

module.exports = router;
