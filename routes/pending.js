const config = require('../config');
const DB = require('../db');
const router = require('../router');
const { approvalLink } = require('../approve/common');

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

module.exports = router;
