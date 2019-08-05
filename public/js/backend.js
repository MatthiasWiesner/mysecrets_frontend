function EnDeCrypt(passphrase){
    this.passphrase = passphrase;

    this.encrypt = function(message){
        var salt = CryptoJS.lib.WordArray.random(16);
        var salt_hex = CryptoJS.enc.Hex.stringify(salt);

        var iv = CryptoJS.lib.WordArray.random(16);
        var key = CryptoJS.PBKDF2(this.passphrase, salt, {keySize: 256/32, iterations: 1000 });
        var encrypted = CryptoJS.AES.encrypt(message, key, {mode: CryptoJS.mode.CBC, iv: iv });

        var key_encrypted = CryptoJS.AES.encrypt(key.toString(), this.passphrase, {mode: CryptoJS.mode.CBC, iv: iv });

        return encrypted.toString() + ':' + key_encrypted.toString() + ':' + iv.toString();
    };

    this.decrypt = function(encrypted_string){
        var parts = encrypted_string.split(':');
        var message = parts[0];
        var key_encrypted = parts[1];
        var iv = CryptoJS.enc.Hex.parse(parts[2])

        var key_string = CryptoJS.AES.decrypt(key_encrypted, this.passphrase).toString(CryptoJS.enc.Utf8);
        var decrypted = CryptoJS.AES.decrypt(message, CryptoJS.enc.Hex.parse(key_string), {iv: iv});

        return decrypted.toString(CryptoJS.enc.Utf8);
    };
}


function Backend(){
    var self = this;

    this.sendRequest = function(method, path, success_callback, data, addional_options){
        var options = {
            method: method,
            url: self.config.endpoint + path,
            crossDomain: true,
            beforeSend: function(xhr) {
                xhr.setRequestHeader('Authorization', 'Basic ' + btoa($.session.get('username') + ':' + $.session.get('password')));
            },
            success: success_callback,
            error: function(jqXHR){
                if (jqXHR.status == 401) {
                    alert(jqXHR.responseText);
                    self.logout(self.app.init);
                }
            }
        };
        if (data != undefined){
            options.data = data;
        }
        if (addional_options != undefined){
            options = {...options, ...addional_options};
        }

        $.ajax(options).fail(function(error) {
            if (typeof error_callback === "function") {
                error_callback();
            } else {
                console.log(error);
                alert("An error occured: " + error.status + ' ' + error.statusText);
            }
        });
    };

    this.init = function(app){
        if (typeof(config) == 'undefined') {
            msg  = "Hier brauchts noch die Config Datei. 'public/js/config.js'.\n"
            alert(msg);
        } else {
            self.config = config;
            self.storage = Storages.initNamespaceStorage('mysecrets');
            self.app = app;

            if (!$.session.get('username')){
                var username = self.storage.localStorage.get('username');
                var password = self.storage.localStorage.get('password');
                var passphrase = self.storage.localStorage.get('passphrase');
                app.getCredentials(username, password, passphrase, function(username, password, passphrase, localStorage){
                    self.setCredentials(username, password, passphrase, localStorage);
                });
            } else {
                self.endecrypt = new EnDeCrypt($.session.get('passphrase'));
                self.app.run();
            }
        }
    };

    this.logout = function(callback){
        $.session.clear();
        self.storage.localStorage.remove('username');
        self.storage.localStorage.remove('password');
        self.storage.localStorage.remove('passphrase');
        delete self.endecrypt;
        callback();
    };

    this.setCredentials = function(username, password, passphrase, localStorage, callback){
        $.get({
            url: self.config.endpoint + '/',
            crossDomain: true,
            beforeSend: function(xhr) {
                xhr.setRequestHeader('Authorization', 'Basic ' + btoa(username + ':' + password));
            },
            success: function(){
                $.session.set('username', username);
                $.session.set('password', password);
                $.session.set('passphrase', passphrase);
                self.endecrypt = new EnDeCrypt($.session.get('passphrase'));

                if (localStorage) {
                    self.storage.localStorage.set('username', username);
                    self.storage.localStorage.set('password', password);
                    self.storage.localStorage.set('passphrase', passphrase);
                } else {
                    self.storage.localStorage.remove('username');
                    self.storage.localStorage.remove('password');
                    self.storage.localStorage.remove('passphrase');
                }
                self.app.run();
            }
        })
        .fail(function(error) {
            alert("An error occured: " + error.status + ' ' + error.statusText);
        });
    };

    this.getCategories = function(itemCallback, finishedCallback){
        self.getSecrets(function(secret){
            itemCallback(secret.category);
        }, function(){
            finishedCallback();
        });
    };

    this.getSecrets = function(itemCallback, finishCallback){
        self.sendRequest('GET', '/mysecrets', function(data){
            data.forEach(function(secret){
                itemCallback(self.parseSecret(secret));
            });
            finishCallback();
        });
    };

    this.getSecret = function(secretID, itemCallback){
        self.sendRequest('GET', '/mysecrets/' + secretID, function(secret){
            itemCallback(self.parseSecret(secret));
        });
    };

    this.saveSecret = function(data, callback){
        var d = {
            data: self.endecrypt.encrypt(JSON.stringify({
                name: data.name,
                category: data.category,
                url: data.url,
                login: data.login,
                password: data.password,
                tags: data.tags
            }))
        };

        if (data.id) {
            self.sendRequest('PUT', '/mysecrets/' + data.id, function(){
                callback();
            }, d);
        } else {
            self.sendRequest('POST', '/mysecrets', function(){
                callback();
            }, d);
        }
    };

    this.deleteSecret = function(secretID, callback){
        self.sendRequest('DELETE', '/mysecrets/' + secretID, function(){
            callback();
        });
    };

    this.search = function(searchText, callback) {
        var results = [];
        var regex = new RegExp(searchText, ['i']);

        this.getSecrets(function(secret){
            if (secret.name.match(regex) || secret.url.match(regex)) {
                results.push(secret);
            }
        }, function(){
            callback(results);
        });
    };

    this.parseSecret = function(s) {
        var data_decrypted = self.endecrypt.decrypt(s.data);
        var data = JSON.parse(data_decrypted);
        secret = {}
        secret.id = s.id
        secret.name = data.name;
        secret.category = data.category;
        secret.url = data.url;
        secret.login = data.login;
        secret.password = data.password;
        secret.tags = data.tags;
        return secret;
    }
}