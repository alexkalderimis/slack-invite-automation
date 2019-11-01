const config = require('../config');
const DB = require('../db');
const Invite = require('../lib/invite');
const router = require('../router');
const { approvalLink } = require('../approve/common');

function authAdmin(f) {
  return ((req, res, next) => {
    let token = req.params.token;
    if (token === config.adminToken) {
      return f(req, res, next);
    } else {
      return next();
    }
  });
}

router.get('/pending/:token', authAdmin(function(req, res, next) {
  DB.findPendingInvites().then((invites) => {
    res.render('pending', { invites, approvalLink });
  }).catch(e => {
     res.render('result', {
       community: config.community,
       message: 'Failed! ' + e.message
     });
  });
}));

router.post('/pending/:token', authAdmin(function(req, res, next) {
  return DB.findInvite(req.body.invite_token).then(invitation => {
    var action;
    switch (req.body.action) {
      case 'ACCEPT':
        action = Invite.sendInvitation(invitation);
        break;
      case 'MARK_ACCEPTED':
        action = DB.markAccepted(invitation.token);
        break;
      case 'MARK_REJECTED':
        action = DB.markRejected(invitation.token);
        break;
      case 'DELETE':
        action = DB.removeInvite(invitation.token);
        break;
      default:
        action = Promise.reject(new Error('unknown action'));
    }
    return action.then(() => res.redirect(302, `/pending/${config.adminToken}`))
  }).catch(e => {
     res.render('result', {
       community: config.community,
       isFailed: true,
       message: String(e)
     });
  });
}));

module.exports = router;
