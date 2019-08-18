const config = require('../config')

const {google} = require('googleapis');

const fs = require('fs');
const readline = require('readline');

const {getBody} = require('./common');

const from_email = config.email.from;
const to_email = config.approver;
const subject = `A new user wants to join ${config.community}`;
const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;

const TOKEN_PATH = config.email.gmail_token_file;

const scopes = [
  'https://mail.google.com/',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/gmail.send',
];

// This module is only really meant to be used for local testing.
// To authorize the client you will first need to run 'authorize'

function sendMessageToApprover(invitation) {
  const messageParts = [
      `From: ${from_email}`,
      `To: ${to_email}`,
      'Content-Type: text/html; charset=utf-8',
      'MIME-Version: 1.0',
      `Subject: ${utf8Subject}`,
      '',
      getBody(invitation),
    ];
  const message = messageParts.join('\n');

  // The body needs to be base64url encoded.
  const encodedMessage = Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return getClient().then(gmail => gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw: encodedMessage,
    },
  }));
}

function getClient() {
  return new Promise((resolve, reject) => {
    // Load client secrets from a local file.
    fs.readFile(config.email.gmail_credentials_file, (err, content) => {
      if (err) return reject(new Error('Error loading client secret file:' + err));

      // Authorize a client with credentials, then call the Gmail API.
      let credentials = null;
      try {
        credentials = JSON.parse(content);
      } catch (e) {
        return reject(new Error('Could not parse credentials as JSON'));
      }
      return resolve(authorize(credentials).then((auth) => google.gmail({version: 'v1', auth})));
    });
  });
}

function authorize(credentials) {
  const {client_secret, client_id, redirect_uris} = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(
      client_id, client_secret, redirect_uris[0]);

  return new Promise((resolve, reject) => {
    // Check if we have previously stored a token.
    fs.readFile(TOKEN_PATH, (err, token) => {
      if (err) return resolve(getNewToken(oAuth2Client));

      oAuth2Client.setCredentials(JSON.parse(token));
      return resolve(oAuth2Client);
    });
  });
}

/**
 * Get and store new token after prompting for user authorization
 *
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @return {Promise<google.auth.OAuth2>} The authorized client
 */
function getNewToken(oAuth2Client) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
  });
  console.log('Authorize this app by visiting this url:', authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve, reject) => {
    rl.question('Enter the code from that page here: ', (code) => {
      rl.close();
      oAuth2Client.getToken(code, (err, token) => {
        if (err) return reject(new Error('Error retrieving access token' + err));
        oAuth2Client.setCredentials(token);
        // Store the token to disk for later program executions
        fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
          if (err) return reject(err);
          console.log('Token stored to', TOKEN_PATH);
          return resolve(oAuth2Client);
        });
      });
    });
  });
}

module.exports = {
  sendMessageToApprover,
  authorize: () => getClient().then(() => console.log('Successfully authorized')).catch(e => console.error(e))
};
