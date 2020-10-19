const wa = require('@open-wa/wa-automate');
const fs = require('fs-extra');
const path = require('path');
const request = require('request');

const WSP_WA_LIB_SESSION_DATA_NAME_ATTACH = '.data.json';
const WSP_QR_DIR_NAME = 'qrs';

class WSP {

  constructor (options) {
    options = options || {};
    this.dataPath = options.dataPath || __dirname;
    this.wspStoreFilePath = path.join(options.dataPath || __dirname, 'wsp-data.json');
    this.wspStore = {};
    this.sessionsMap = {};
    this.onMessageHandlers = [];
    fs.ensureDirSync(options.dataPath);
    try {
      this.wspStore = JSON.parse(fs.readFileSync(this.wspStoreFilePath, 'utf-8'));
    } catch (err) {}
    // Start loaded sessions
    this._startStoredSessions().then(() => {}).catch(err => {});
    // Setup qr 
    wa.ev.on('qr.**', (qrcode, sessionId) => {
      var qrsDirPath = path.join(this.dataPath, WSP_QR_DIR_NAME);
      var qrsFilePath = path.join(qrsDirPath, `qr-${sessionId}.png`);
      this.sessionsMap[sessionId] = this.sessionsMap[sessionId] || {};
      this.sessionsMap[sessionId].qrUrl = qrsFilePath;
      fs.ensureDirSync(qrsDirPath);
      const imageBuffer = Buffer.from(qrcode.replace('data:image/png;base64,',''), 'base64');
      fs.writeFileSync(qrsFilePath, imageBuffer);
    });
  }

  _startWSPClient (key, options) {
    options = options || {};
    var wspSessionsPath =  this.dataPath || __dirname;
    var wspSessionFileName = key+WSP_WA_LIB_SESSION_DATA_NAME_ATTACH;
    try {
      fs.readFileSync(path.join(wspSessionsPath, wspSessionFileName), 'utf-8');
    } catch (err) {
      fs.writeFileSync(path.join(wspSessionsPath, wspSessionFileName), Buffer.from('{}').toString('base64'));
    }
    return new Promise((resolve, reject) => {
      wa.create({
        sessionId: key,
        sessionDataPath: wspSessionsPath,
        disableSpins: true,
      }).then(client => {
        this.wspStore.storedSessions[key] = {
          onMessageWebhook: options.onMessageWebhook || null
        };
        this.sessionsMap[key] = { client: client }
        if (options.updateStoreData) {
          this._updateWSPStoreData();
        }
        client.onMessage((messageData) => {
          var messageData = {
            sessionKey: key,
            message: {
              id: messageData.id,
              type: ({
                chat: 'text',
                ppt: 'audio',
                document: 'file',
                image: 'image'
              })[messageData.type],
              from: messageData.from,
              to: messageData.to,
              isForwarded: messageData.isForwarded,
              timestamp: messageData.timestamp,
              content: messageData.content,
              fromMe: messageData.fromMe,
              sender: {
                id: messageData.sender.id,
                name: messageData.sender.name,
                shortName: messageData.sender.shortName,
              },
              chat: {
                id: messageData.chat.id,
              }
            }
          }
          if (options.onMessageWebhook) {
            request({
              method: options.onMessageWebhook.method || 'POST',
              url: options.onMessageWebhook.url,
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                originNumber: messageData.sessionKey,
                messageData: messageData.message
              })
            }, (err, resp) => {});
          }
          this.onMessageHandlers.forEach(handler => {
            handler(messageData);
          })
        })
        resolve(client);
      }).catch(err => {
        this.sessionsMap[key] = { error: err }
        resolve(err);
      })
    })
  }

  _startStoredSessions () {
    return new Promise((resolve, reject) => {
      this.wspStore.storedSessions = this.wspStore.storedSessions || {};
      var storedSessions = this.wspStore.storedSessions || {};
      var buffStoredSessionsList = Object.keys(storedSessions).map(k => ({ key: k, data: storedSessions[k] }));
      var _fn = () => {
        if (!buffStoredSessionsList.length) {
          resolve();
          return;
        }
        var buffSessionData = buffStoredSessionsList.shift();
        this._startWSPClient(buffSessionData.key, {
          onMessageWebhook: buffSessionData.data.onMessageWebhook || null
        }).then(() => {
          _fn();
        }).catch(err => {
          _fn();
        });
      }
      _fn();
    })
  }

  _updateWSPStoreData () {
    fs.writeFileSync(this.wspStoreFilePath, JSON.stringify(this.wspStore));
  }

  onMessage (handler) {
    this.onMessageHandlers.push(handler);
  }

  sendMessage (sessionKey, messageData) {
    return new Promise((resolve, reject) => {
      if (!this.sessionsMap[sessionKey]) {
        reject({ details: 'Invalid session key' });
        return;
      }
      if (!this.sessionsMap[sessionKey].client) {
        reject({ details: 'Invalid session client' });
        return;
      }
      var promResp = null;
      switch (messageData.type) {
        case 'text':
          promResp = this.sessionsMap[sessionKey].client.sendText(messageData.to, messageData.content)
        break;
        case 'image':
          promResp = this.sessionsMap[sessionKey].client.sendImage(messageData.to, messageData.content, null, messageData.message);
        break;
      }
      if (!promResp) {
        reject({ details: 'Invalid message type' });
        return;
      }
      promResp.then(resp => {
        resolve(resp);
      }).catch(err => {
        reject(err);
      })
    });
  }

  addSession (key) {
    this.wspStore.storedSessions = this.wspStore.storedSessions || {};
    return new Promise((resolve, reject) => {
      if (this.sessionsMap[key] && this.sessionsMap[key].client) {
        resolve(this.sessionsMap[key].client);
        return;
      }
      this._startWSPClient(key, { updateStoreData: true }).then((client) => {
        resolve({ client: client });
      }).catch(err => {
        reject(err);
      });
    });
  }

  initSession (key, options) {
    options = options || {}
    this.wspStore.storedSessions = this.wspStore.storedSessions || {};
    return new Promise((resolve, reject) => {
      if (this.sessionsMap[key] && this.sessionsMap[key].client) {
        resolve(this.sessionsMap[key].client);
        return;
      }
      this._startWSPClient(key, {
        updateStoreData: true,
        onMessageWebhook: options.onMessageWebhook || null
      }).then((client) => {}).catch(err => {});
      resolve();
    });
  }

  removeSession (key) {
    this.wspStore.storedSessions[key] = null;
    delete this.wspStore.storedSessions[key];
    this.sessionsMap[key] = null;
    delete this.sessionsMap[key];
    try {
      fs.unlinkSync(path.join(this.dataPath, key+WSP_WA_LIB_SESSION_DATA_NAME_ATTACH))
    } catch (err) {}
    try {
      var qrsDirPath = path.join(this.dataPath, WSP_QR_DIR_NAME);
      var qrsFilePath = path.join(qrsDirPath, `qr-${key}.png`);
      fs.unlinkSync(qrsFilePath);
    } catch (err) {}
    this._updateWSPStoreData();
  }

}

module.exports = WSP;