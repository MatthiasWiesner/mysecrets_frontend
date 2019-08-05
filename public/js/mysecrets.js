

function MySecrets(){
    self = this;
    
    this.backend;

    this.init = function(){
        self.backend = new Backend();
        self.backend.init(self);
    };

    this.getCredentials = function(username, password, passphrase, callback){
        var checkedLocalStorage = "";
        if (passphrase != undefined) {
            checkedLocalStorage = "checked";
        }

        var $modalCredentials = $(self.renderTemplate('#modalCredentials', {
            username: username, 
            password: password, 
            passphrase: passphrase,
            checkedLocalStorage: checkedLocalStorage
        }));

        $('.togglePasswdVisible', $modalCredentials).on('click', function(){
            $('input', $(this).parent().closest('div')).toggleAttr("type", "text", "password");
        });

        $modalCredentials
            .modal({
                closable  : true,
                onApprove : function(a) {
                    var username = $('#auth-username').val();
                    var password = $('#auth-password').val();
                    var passphrase = $('#crypt-passphrase').val();
                    var localStorage = $('#localStorage').prop('checked');
                    callback(
                        username,
                        password,
                        passphrase,
                        localStorage
                    );
                    return true;
                }
              })
            .modal('show');
    };

    this.run = function(){
        // init global buttons
        $('#buttonNewSecret').on('click', self.showNewSecret);
        $('#buttonExportSecrets').on('click', self.exportSecrets);
        $('#buttonImportSecrets').on('click', self.importSecrets);
        $('#buttonLogout').on('click', self.logout);
        $('#buttonSearch').on('click', function(){
            var searchText = $('#inputSearch').val();
            self.search(searchText);
        });
        $('#inputSearch').keypress(function(event){
            var keycode = (event.keyCode ? event.keyCode : event.which);
            if(keycode == '13'){
                var searchText = $(this).val();
                self.search(searchText);
            }
        });
        self.getSecrets();
    };

    this.logout = function(){
        $('#accordionSecrets').empty();
        self.backend.logout(function(){
            self.init();
        });
    };

    this.showNewSecret = function(){
        var $modalSecret = $(self.renderTemplate('#modalSecret', {}));

        var categories = [];
        self.backend.getCategories(function(category){
            categories.push(category);
        }, function(){
            var uniqSortCategories = [...new Set(categories)].sort();
            $.each(uniqSortCategories, function(i, category){
                $('#secret-category', $modalSecret).append(
                    $('<option value="' + category + '">' + category + '</option>')
                );
            });
        });

        $('.togglePasswdVisible', $modalSecret).on('click', function(){
            $('input.passwd', $(this).parent()).toggleAttr("type", "text", "password");
        });

        $('.generatePassword', $modalSecret).on('click', function(){
            var pwLength = $('#pwLength', $modalSecret).val();
            var pwSymbols = $('#pwSymbols', $modalSecret).prop('checked');
            var pw = self.generatePassword(pwLength, pwSymbols);
            $('input.passwd', $(this).parent()).val(pw);
        });

        $('#pwLength', $modalSecret).val(config.generatePassword.length);
        $('#pwSymbols', $modalSecret).prop('checked', config.generatePassword.symbols);

        $modalSecret.modal({
            closable  : true,
            onApprove : function(a) {
                self.saveSecret({
                    category: $('#secret-category', $modalSecret).val(),
                    category_txt: $('#secret-category-txt', $modalSecret).val(),
                    name: $('#secret-name', $modalSecret).val(),
                    url: $('#secret-url', $modalSecret).val(),
                    login: $('#secret-login', $modalSecret).val(),
                    password: $('#secret-password', $modalSecret).val(),
                    tags: $('#secret-tags', $modalSecret).val()
                });
                return true;
            }
          })
        .modal('show');
    };

    this.showDetails = function(secretID){
        self.backend.getSecret(secretID, function(secret){
            if (secret.tags.join != undefined) {
                secret.tagList = secret.tags.join(', ');
            }

            var $modalSecret = $(self.renderTemplate('#modalSecret', secret));

            var categories = [];
            self.backend.getCategories(function(category){
                categories.push(category);
            }, function(){
                var uniqSortCategories = [...new Set(categories)].sort();
                $.each(uniqSortCategories, function(_, category){
                    var $option = $('<option value="' + category + '">' + category + '</option>');
                    if (secret.category == category) {
                        $option.attr('selected', true);
                    }
                    $('#secret-category', $modalSecret).append($option);
                });
            });

            $('.togglePasswdVisible', $modalSecret).on('click', function(){
                $('input.passwd', $(this).parent()).toggleAttr("type", "text", "password");
            });

            $('.generatePassword', $modalSecret).on('click', function(){
                var pwLength = $('#pwLength', $modalSecret).val();
                var pwSymbols = $('#pwSymbols', $modalSecret).prop('checked');
                var pw = self.generatePassword(pwLength, pwSymbols);
                $('input.passwd', $(this).parent()).val(pw);
            });

            $('#pwLength', $modalSecret).val(config.generatePassword.length);
            $('#pwSymbols', $modalSecret).prop('checked', config.generatePassword.symbols);

            $modalSecret
                .modal({
                    closable  : true,
                    onApprove : function(a) {
                        self.saveSecret({
                            id: $('#secret-id', $modalSecret).val(),
                            category: $('#secret-category', $modalSecret).val(),
                            category_txt: $('#secret-category-txt', $modalSecret).val(),
                            name: $('#secret-name', $modalSecret).val(),
                            url: $('#secret-url', $modalSecret).val(),
                            login: $('#secret-login', $modalSecret).val(),
                            password: $('#secret-password', $modalSecret).val(),
                            tags: $('#secret-tags', $modalSecret).val()
                        });
                        return true;
                    }
                })
                .modal('show');
        });
    };

    this.getSecrets = function(){
        const mysecrets = {};
        const orderedSecrets = {};

        self.backend.getSecrets(function(secret){
            // sort by category name
            if (mysecrets[secret.category] == undefined) {
                mysecrets[secret.category] = [];
            }
            mysecrets[secret.category].push(secret);

        }, function(){
            $('#accordionSecrets').empty();
            // sort by category name
            Object.keys(mysecrets).sort().forEach(function(key) {
                orderedSecrets[key] = mysecrets[key];
            });
            // sort by name
            $.each(orderedSecrets, function(i, secrets){
                secrets.sort(function (a, b) {
                    return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
                });
            });

            for (var category in orderedSecrets) {
                var $category = self.renderTemplate('#accordionTemplateHead', {category: category});
                $('#accordionSecrets').append($category);
                
                var $categorySecrets = $(self.renderTemplate('#accordionTemplateContent', {}));
                $('#accordionSecrets').append($categorySecrets);

                for (var i in orderedSecrets[category]) {
                    var secret = orderedSecrets[category][i];
                    secret.tagList = '';
                    if (secret.tags.join != undefined) {
                        secret.tagList = secret.tags.join(', ');
                    }
                    var $secret = $(self.renderTemplate('#accordionTemplateSecret', secret));
                    $('.categorySecrets', $categorySecrets).append($secret);

                    $('.togglePasswdVisible', $secret).on('click', function(){
                        $('input.passwd', $(this).parent()).toggleAttr("type", "text", "password");
                    });

                    $('.btnShowDetails', $secret).on('click', function(){
                        var secretID = $(this).data('secret-id');
                        self.showDetails(secretID);
                    });

                    $('.btnDeleteSecret', $secret).on('click', function(){
                        var secretID = $(this).data('secret-id');

                        var $modalDelete = $(self.renderTemplate('#modalDelete', {}));
                        $modalDelete
                            .modal({
                                closable  : true,
                                onApprove : function() {
                                    self.deleteSecret(secretID);
                                    return true;
                                }
                              })
                            .modal('show');
                    });
                }
            }
            new ClipboardJS('.clipPasswdSearch', {
                text: function(trigger){
                    return $(trigger.getAttribute('data-clipboard-target')).val();
                }
            });
            
            $('#accordionSecrets').accordion();
        });
    };

    this.saveSecret = function(data){
        data.tags = data.tags.split(/[\s,;]+/g).filter(Boolean)

        if (data.category_txt) {
            data.category = data.category_txt;
        }
        delete data.category_txt;
        this.backend.saveSecret(data, self.getSecrets);
    };

    this.deleteSecret = function(secretID){
        this.backend.deleteSecret(secretID, self.getSecrets);
    };

    this.exportSecrets = function(){
        const mysecrets = [];
        
        self.backend.getSecrets(function(secret){
            mysecrets.push(secret);

        }, function(){
            var json = JSON.stringify(mysecrets, null, 2);
            var blob = new Blob([json], {type: 'application/json'});
            var url = window.URL.createObjectURL(blob);
            var a = $("<a />", {
                href : url,
                download: 'exported_secrets.json'
            });
            a.appendTo('body');
            a.simulate("click");
            window.URL.revokeObjectURL(url);
        });
    };

    this.importSecrets = function(){
        var $modalImport = $(self.renderTemplate('#modalImport', {}));
    
        $modalImport
            .modal({
                closable  : true,
                onApprove : function() {
                    try {
                        var data = JSON.parse($('#txtImport').val().trim());
                    } catch (err) {
                        alert('The data could not be parsed. Please insert valid json');
                        return false;
                    }
                    $.each(data, function(_, secret){
                        // tags are splitted to array in saveSecret‚
                        if (secret.tags != undefined) {
                            secret.tags = secret.tags.join(',')
                        }
                        self.saveSecret(secret);
                    });
                    return true;
                }
            })
            .modal('show');
    };

    this.search = function(searchText) {
        if (searchText == "") {
            $('#searchResults').empty();
            $('#rowSearchResults').hide();
            return true;
        }

        this.backend.search(searchText, function(results){
            $('#searchResults').empty();
            $.each(results, function(_, secret){
                if (secret.tags.join != undefined) {
                    secret.tagList = secret.tags.join(', ');
                }
                var $secret = $(self.renderTemplate('#searchResultTemplate', secret));
                $('#searchResults').append($secret);

                $('.togglePasswdVisible', $secret).on('click', function(){
                    $('input.passwd', $(this).parent()).toggleAttr("type", "text", "password");
                });
            });
            new ClipboardJS('.clipPasswd', {
                text: function(trigger){
                    return $(trigger.getAttribute('data-clipboard-target')).val();
                }
            });
            $('#rowSearchResults').show();
        });
    };

    this.generatePassword = function(length, withSymbols){
        var mask = '';
        mask += 'abcdefghijklmnopqrstuvwxyz';
        mask += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        mask += '0123456789';
        if (withSymbols) {
            mask += '~`!@#$%^&*()_+-={}[]:";\'<>?,./|\\';
        }
        var result = '';
        for (var i = length; i > 0; --i) {
            result += mask[Math.round(Math.random() * (mask.length - 1))];
        }
        return result;
    };

    this.parseTemplate = function(tplID){
        var template = $(tplID).html();
        Mustache.parse(template);
        return template;
    };

    this.renderTemplate = function(tplID, data){
        var template = self.parseTemplate(tplID);
        return Mustache.render(template, data);
    };
};

$.fn.toggleAttr = function(attr, attr1, attr2) {
  return this.each(function(){
      if ($(this).attr(attr) == attr1) {
          $(this).attr(attr, attr2);
      } else {
          $(this).attr(attr, attr1);
      }
  });
};

$(document).ready(function(){
    var mySecrets = new MySecrets();
    mySecrets.init();
});
