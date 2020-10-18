const wa = require('@open-wa/wa-automate');
const fs = require('fs');
const path = require('path');

const WSP_WA_LIB_SESSION_DATA_NAME_ATTACH = '.data.json'

class WSP {

  constructor (options) {
    options = options || {};
    this.dataPath = options.dataPath || __dirname;
    this.wspStoreFilePath = path.join(options.dataPath || __dirname, 'wsp-data.json');
    this.wspStore = {};
    this.sessionsMap = {};
    try {
      this.wspStore = JSON.parse(fs.readFileSync(this.wspStoreFilePath, 'utf-8'));
    } catch (err) {}
    // Start loaded sessions
    this._startStoredSessions().then(() => {}).catch(err => {});
  }

  _startWSPClient (key, options) {
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
        sessionDataPath: wspSessionsPath
      }).then(client => {
        this.wspStore.storedSessions[key] = {};
        this.sessionsMap[key] = { client: client }
        if (options.updateStoreData) {
          this._updateWSPStoreData();
        }
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
        this._startWSPClient(buffSessionData.key).then(() => {
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

  addSession (key) {
    this.wspStore.storedSessions = this.wspStore.storedSessions || {};
    return new Promise((resolve, reject) => {
      if (this.sessionsMap[key] && this.sessionsMap[key].client) {
        resolve(this.sessionsMap[key].client);
        return;
      }
      this._startWSPClient(key, { updateStoreData: true }).then((client) => {
        resolve(client);
      }).catch(err => {
        reject(err);
      });
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
    this._updateWSPStoreData();
  }

}

module.exports = WSP;