/////////////////////////////////////////////////////
// Authored by Carl Youngblood
// Senior Blockchain Solutions Architect, AWS
// Adapted from web3 npm package v1.3.0
// licensed under GNU Lesser General Public License
// https://github.com/ethereum/web3.js
/////////////////////////////////////////////////////

const AWS = require('aws-sdk');
const HttpProvider = require('web3-providers-http');
const XHR2 = require('xhr2');

module.exports = class AWSHttpProvider extends HttpProvider {
  send(payload, callback) {
    const self = this;
    const request = new XHR2(); // eslint-disable-line

    request.timeout = self.timeout;
    request.open('POST', self.host, true);
    request.setRequestHeader('Content-Type', 'application/json');

    request.onreadystatechange = () => {
      if (request.readyState === 4 && request.timeout !== 1) {
        let result = request.responseText; // eslint-disable-line
        let error = null; // eslint-disable-line

        try {
          result = JSON.parse(result);
        } catch (jsonError) {
          let message;
          if (!!result && !!result.error && !!result.error.message) {
            message = `[aws-ethjs-provider-http] ${result.error.message}`;
          } else  {
            message = `[aws-ethjs-provider-http] Invalid JSON RPC response from host provider ${self.host}: ` +
              `${JSON.stringify(result, null, 2)}`;
          }
          error = new Error(message);
        }

        callback(error, result);
      }
    };

    request.ontimeout = () => {
      callback(`[aws-ethjs-provider-http] CONNECTION TIMEOUT: http request timeout after ${self.timeout} ` +
        `ms. (i.e. your connect has timed out for whatever reason, check your provider).`, null);
    };

    const region = 'us-east-1';
    
    AWS.config.credentialProvider.resolve((err, credentials) => {
      if (err) {
        callback(`[aws-ethjs-provider-http] CONNECTION ERROR: Couldn't connect to node '${self.host}': missing AWS credentials. Check your environment variables using command 'echo $NODE_ENV' to verify credentials are set. ${err.message}`)
        return;
      }
      try {
        const strPayload = JSON.stringify(payload);
        const endpoint = new AWS.Endpoint(self.host);
        const req = new AWS.HttpRequest(endpoint, region);
        req.method = request._method;
        req.body = strPayload;
        req.headers['host'] = request._url.host;
        const signer = new AWS.Signers.V4(req, 'managedblockchain');
        signer.addAuthorization(credentials, AWS.util.date.getDate());
        request.setRequestHeader('Authorization', req.headers['Authorization']);
        request.setRequestHeader('X-Amz-Date', req.headers['X-Amz-Date']);
        if (process.env.AWS_SESSION_TOKEN || credentials.sessionToken) {
          request.setRequestHeader('X-Amz-Security-Token', process.env.AWS_SESSION_TOKEN || credentials.sessionToken);
        }
        request.send(strPayload);
      } catch (error) {
        console.error(error);
        callback(`[aws-ethjs-provider-http] CONNECTION ERROR: Couldn't connect to node '${self.host}': ` +
        `${JSON.stringify(error, null, 2)}`, null);
       }
    });
  }
}
