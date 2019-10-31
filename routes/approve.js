const DB     = require('../db');
const config = require('../config');
const router = require('../router');

const { logger }  = require('../logger');
const { inviteUser } = require('./invite');

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
   .then(message => {
     logger.info(message);
     return res.redirect(302, `/pending/${config.adminToken}`);
   })
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
  return DB.markRejected(invitation.token)
    .then(() => 'The request has been rejected');
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

module.exports = router;
