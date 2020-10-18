// Imports
var WSP = require('./WSP');
var path = require('path');
var express = require('express');
var bodyParser = require('body-parser')

// Init setup
var app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
var dataPath = __dirname+'/../wsp-data/';
var wsp = new WSP({
  dataPath: dataPath
});
app.use('/qrs-store', express.static(path.join( dataPath, 'qrs' )));

/**
 * Setup handlers
 */

  // Register session
  app.post('/session', (req, res) => {
    var phoneNumber = req.body.phoneNumber;
    wsp.addSession(phoneNumber).then(() => {
      res.status(200);
      res.send({
        details: 'Session registered',
        qrCodeUrl: '/qrs-store/qr-'+phoneNumber+'.png'
      });
      res.end();
    }).catch(err => {
      res.status(500);
      res.send(err);
      res.end();
    });
  });

  // Remove session
  app.delete('/session', (req, res) => {
    wsp.removeSession(req.body.phoneNumber);
    res.status(200);
    res.send({ details: 'Session removed' });
    res.end();
  });