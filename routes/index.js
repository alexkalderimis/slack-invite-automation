const express = require('express');
const router = express.Router();
const request = require('request');
import uuidv4 from 'uuid/v4';
const { Pool } = require('pg');

const sendgrid = require('sendgrid');

const winston = require('winston')
const myWinstonOptions = {
    transports: [new winston.transports.Console()]
}

const config = require('../config');
const { badge } = require('../lib/badge');

const sanitize = require('sanitize');

const logger = new winston.createLogger(myWinstonOptions)

const from_email = new sendgrid.mail.Email(config.email.from);
const to_email = new sendgrid.mail.Email(config.approver);
const subject = `A new user wants to join ${config.community}`;

const sg = sendgrid(config.sendgrid_api_key);

router.get('/', function(req, res) {
  res.setLocale(config.locale);
  res.render('index', { community: config.community,
                        tokenRequired: !!config.inviteToken,
                        recaptchaSiteKey: config.recaptchaSiteKey });
});

const pool = config.db.pgConnectionString ? new Pool(config.db) : null;

if (pool) {
  pool.on('connect', () => {
    logger.info('connected to the db');
  });
}

function createTables() {
  const queryText =
    'CREATE TABLE IF NOT EXISTS invitations (id UUID PRIMARY KEY, email_address TEXT NOT NULL)';

  pool.query(queryText)
    .then((res) => {
      console.log(res);
      pool.end();
    })
    .catch((err) => {
      logger.error(err);
      pool.end();
    });
}

function inviteUser(emailAddress, cb, token) {
  if (!token && !!config.approvalNeeded && !!config.approver) {
    storeEmailAddress(emailAddress)
      .then(sendMessageToApprover)
      .then(function () {
        cb(null, { ok: false, error: 'approval_needed' });
      } function(e) {
        cb(e, null);
      });
  } else {
    if (token) {
      removeInvite(token).then(() => {
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
    });
  }
}

router.get('/approve/:token', function(req, res) {
  findInvite(req.params.token)
   .then(sendInvitation)
   .then(function (invitation) {
     res.render('result', {
       community: config.community,
       message: 'Approved! An invitation has been sent to &ldquo;' + invitation.emailAddress + '&rdquo;'
     });
   }, function (e) {
     res.render('result', {
       community: config.community,
       message: 'Failed! ' + e.message
     });
   });
});

function storeEmailAddress(emailAddress) {
  const sql = `INSERT INTO invitations (id, email_address) VALUES ($1, $2) returning id`;
  const values = [uuidv4(), emailAddress];

  return pool.query(sql, values)
    .then(rows => { {emailAddress, token: rows[0].id} });
};
function findInvite(token) {
  const sql = `SELECT id, email_address FROM invitations WHERE id = $1 LIMIT 1`;
  const values = [token];

  return pool.query(sql, values)
    .then(rows => { {emailAddress, token: rows[0]} });
};
function removeInvite(token) {
  const sql = `DELETE FROM invitations WHERE id = $1`;
  const values = [token];

  return pool.query(sql, values);
};


function sendMessageToApprover(invitation) {
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
  const content = new sendgrid.mail.Content('text/html', html);
  const mail = new sendgrid.mail.Mail(from_email, subject, to_email, content);

  const request = sendgrid.emptyRequest({
    method: 'POST',
    path: '/v3/mail/send',
    body: mail.toJSON(),
  });

  return new Promise((resolve, reject) => {
    sendgrid.API(request, function(error, response) {
      if (error) {
        return reject(error)
      } else {
        return resolve(response)
      }
    });
  });
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
        return reject(new Error('The request was not authorised. Please check your configuration settings');
      } else { 
        return reject(new Error(response.error));
      }
    };
    inviteUser(invitation.emailAddress, cb, invitation.id);
  });
};


router.post('/invite', function(req, res) {
  if (req.body.email && (!config.inviteToken || (!!config.inviteToken && req.body.token === config.inviteToken))) {
    function doInvite() {
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
            if (error === 'already_invited' || error === 'already_in_team') {
              res.render('result', {
                community: config.community,
                message: 'Success! You were already invited.<br>' +
                        'Visit <a href="https://'+ config.slackUrl +'">'+ config.community +'</a>'
              });
              return;
            } else if (error === 'invalid_email') {
              error = 'The email you entered is an invalid email.';
            } else if (error === 'invalid_auth') {
              error = 'Something has gone wrong. Please contact a system administrator.';
            }

            res.render('result', {
              community: config.community,
              message: 'Failed! ' + error,
              isFailed: true
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
