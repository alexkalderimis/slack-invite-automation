const DB     = require('../db');
const config = require('../config');
const router = require('../router');

const { logger }  = require('../logger');
const Invite = require('../lib/invite');

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
       isFailed: true,
       message: String(e)
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
  return Invite.sendInvitation(invitation).then(response => {
    if (response.ok) return Promise.resolve(invitation);

    switch (response.error) {
      case 'already_invited':
      case 'already_in_team':
        return Promise.reject('This user has already been invited');
      case 'invalid_email':
        return Promise.reject('The email address is invalid');
      case 'invalid_auth':
        return Promise.reject('The request was not authorised. Please check your configuration settings');
      default:
        return Promise.reject(response.error);
    }
  });
};

module.exports = router;
