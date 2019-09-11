const winston = require('winston')

const myWinstonOptions = {
    transports: [new winston.transports.Console()]
}

const logger = new winston.createLogger(myWinstonOptions)

module.exports = {
  logger, transports: myWinstonOptions.transports
};
