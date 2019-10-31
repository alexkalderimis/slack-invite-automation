const router = require('./router');

require('./routes/index');
require('./routes/invite');
require('./routes/approve');
require('./routes/pending');
require('./routes/badge');

module.exports = router;
