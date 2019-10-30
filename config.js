const dotenv = require('dotenv');

// load .env files into proces.ENV for development
dotenv.config();

module.exports = {
  env: process.env.ENV || 'prod',
  adminToken: process.env.ADMIN_TOKEN || 'admin',
  // your community or team name to display on join page.
  community: process.env.COMMUNITY_NAME || 'YOUR-TEAM-NAME',
  // your slack team url (ex: socketio.slack.com)
  slackUrl: process.env.SLACK_URL || 'YOUR-TEAM.slack.com',
  // access token of slack
  // see https://github.com/outsideris/slack-invite-automation#issue-token
  //
  // You can test your token via curl:
  //   curl -X POST 'https://YOUR-SLACK-TEAM.slack.com/api/users.admin.invite' \
  //   --data 'email=EMAIL&token=TOKEN&set_active=true' \
  //   --compressed
  slacktoken: process.env.SLACK_TOKEN || 'YOUR-ACCESS-TOKEN',
  // an optional security measure - if it is set, then that token will be required to get invited.
  inviteToken: process.env.INVITE_TOKEN || null,
  // an optional security measure - if both are set, then recaptcha will be used.
  recaptchaSiteKey: process.env.RECAPTCHA_SITE || null,
  recaptchaSecretKey: process.env.RECAPTCHA_SECRET || null,
  // default locale
  locale: process.env.LOCALE || "en",
  subpath: process.env.SUBPATH || "/",
  // approval: send requests to someone for approval
  approvalMechanism: process.env.APPROVAL_MECHANISM || null,
  approver: process.env.APPROVER || null,
  // database connection string
  db: {
    connectionString: process.env.DATABASE_URL || null
  },
  baseURL: process.env.BASE_URL || null,
  email: {
    from: process.env.EMAIL_FROM || null,
    sendgrid_api_key: process.env.SENDGRID_API_KEY || null,
    gmail_credentials_file: process.env.GMAIL_CREDENTIALS_FILE || null,
    gmail_token_file: process.env.GMAIL_TOKEN_FILE || null,
  }
};
