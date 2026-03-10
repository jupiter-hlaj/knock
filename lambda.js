const serverlessExpress = require('@codegenie/serverless-express');
const express = require('express');
const { Knock } = require('./src/index');

let handler = null;

exports.handler = async (event, context) => {
  if (!handler) {
    const domain = event.requestContext?.domainName;
    const storageType = process.env.KNOCK_STORAGE_TYPE || 'sqlite';

    const knock = new Knock({
      rpId:   process.env.KNOCK_RP_ID   || domain,
      rpName: process.env.KNOCK_RP_NAME || 'Knock Demo',
      origin: process.env.KNOCK_ORIGIN  || `https://${domain}`,
      dbPath: process.env.KNOCK_DB_PATH || '/mnt/knock/knock.db',
      storageType,
    });

    const app = express();
    app.use(express.json());
    app.use('/auth', knock.router());
    app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'knock' }));

    handler = serverlessExpress({ app });
  }
  return handler(event, context);
};
