const config = require('../config');
const router = require('../router');

const approvalNeeded = !!config.approvalMechanism;
const tokenRequired = !!config.inviteToken;

const indexData = {
  community: config.community,
  recaptchaSiteKey: config.recaptchaSiteKey,
  approvalNeeded, tokenRequired
};

router.get('/', function(req, res) {
  res.setLocale(config.locale);
  res.render('index', indexData);
});

module.exports = router;
