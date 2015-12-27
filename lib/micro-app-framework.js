// Copyright 2014-2015 the project authors as listed in the AUTHORS file.
// All rights reserved. Use of this source code is governed by the
// license that can be found in the LICENSE file.

var extend = require('util')._extend;
var fs = require('fs');
var http = require('http');
var https = require('https');
var path = require('path');
var url = require('url');

const PAGE_OPEN_NAME = 'page_open.html';
const PAGE_TEMPLATE_NAME= 'page.html.template';

var isTLS = function(app) {
  return (app.config.tls !== undefined) && (app.config.tls.toLowerCase() === 'true');
}

var setupDefaults = function(app, dir) {
  app.config = app.getDefaults();
  extend(app.config, require(path.join(dir, 'config.json')));
}

var getPage = function(pageName, app, dir, request, replacements) {
  var page =  fs.readFileSync(path.join(dir, pageName)).toString();

  if (pageName === PAGE_OPEN_NAME) {
    if ((app.config.closeLaunchWindow !== undefined) && (app.config.closeLaunchWindow.toLowerCase() === 'false')) {
      page = page.replace('<DO_CLOSE>', '');
      page = page.replace('<LAUNCH_PAGE_MESSAGE>', 'You requested that the page not be closed after micro-app launch');
    } else {
      page = page.replace('<DO_CLOSE>', 'close();');
      page = page.replace('<LAUNCH_PAGE_MESSAGE>', 'If you allow windows to be closed from javascript in your browser this page will automatically close when the micro-app windows is opened');
    }
    var requestUrl = url.parse('http://' + request.url);
    if (requestUrl.query !== null) {
      page = page.replace('<URL_STRING>', '/?' + requestUrl.query + '&windowopen=y');
    } else {
      page = page.replace('<URL_STRING>', '/?windowopen=y');
    }
  }

  if (isTLS(app)) {
    page = page.replace('<URL_TYPE>', 'https');
  } else {
    page = page.replace('<URL_TYPE>', 'http');
  }
   
  for (i = 0; i < replacements.length; i++) {
    page = page.replace(replacements[i].key, replacements[i].value);
  }
  return page;
}

function authenticate(app, request,response) {
  var bcrypt = require('bcryptjs');
  var auth = require('basic-auth');
  var authInfo = auth(request);
  if (!authInfo || 
      (authInfo.name !== app.config.authInfo.username) ||
      !bcrypt.compareSync(authInfo.pass, app.config.authInfo.password)) {
    if (response !== undefined) {
      response.writeHead(401, {'WWW-Authenticate': 'Basic realm="' + app.config.authInfo.realm + '"'});
      response.end();
    }
    return false;
  }

  app.decryptConfigValue = function(value) {
    var passphrase = authInfo.pass + authInfo.pass;
    var CryptoJS = require('crypto-js');
    return CryptoJS.AES.decrypt(value, passphrase).toString(CryptoJS.enc.Utf8);
  }
  return true;
}

var onConnect = function(request, response, app, dir) {
  // if authenticate is enabled validate we are authenticated first
  if ((app.config.authenticate !== undefined) && (app.config.authenticate.toLowerCase() === 'true')) { 
    if (!authenticate(app, request, response)) { 
      return;
    } 
  };

  // we are authorized so build appropriate page. This is either the launch 
  // page to open the micro-app window, the page for the micro-app itself
  // or possibly some supporting pages provided by the micro app. The
  // supporting pages are typically additional javacripts included
  // by the main page
  
  // let micro app provided page if request is for a supporting page
  var pageHandled = false;
  if (app.handleSupportingPages !== undefined) {
    pageHandled = app.handleSupportingPages(request, response);
  }
  
  if (!pageHandled) { 
    // not a supporting page, prrovide it  
    var requestUrl = url.parse('http://' + request.url, true);
    var replacements = app.getTemplateReplacments(request);
    var windowOpenPage = getPage(PAGE_OPEN_NAME, app, __dirname, request, replacements); 
    var mainPage = getPage(PAGE_TEMPLATE_NAME, app, dir, request, replacements); 
    if ((requestUrl.query !== null) && (requestUrl.query.windowopen !== undefined)) {
      response.writeHead(200, {'Content-Type': 'text/html'});
      response.end(mainPage);
    } else {
      response.writeHead(200, {'Content-Type': 'text/html'});
      response.end(windowOpenPage);
    }
  }
};


var startServer = function(app, dir) {
  var server;
  if (isTLS(app)) {
    ssl_options = {
      key: fs.readFileSync(path.join(dir, 'key.pem')),
      cert: fs.readFileSync(path.join(dir, 'cert.pem'))
    }
    server = https.createServer(ssl_options, (request, response) => onConnect(request, response, app, dir));
  } else {
    server = http.createServer((request, response) => onConnect(request, response, app, dir));
  }
  server.listen(app.config.serverPort, function(){ });;
  if (app.startServer !== undefined) {
    app.startServer(server);
  }
};


var startMicroApp = function(dir, app) { 
  setupDefaults(app, dir); 
  startServer(app, dir); 
}


var createAndStartMicroApp = function(dir, app) {
  var app = require(path.join(dir, 'server.js')); 
  startMicroApp(dir, app);
}


if (require.main === module) {
  var domain = require('domain').create();
  domain.on('error', function(err) {
    console.log('Microapp failed:' + err);
    console.log('stack:' + err.stack);
  });

  // start each of the micro-apps in the drop-ins directory
  var appsDir = path.join(__dirname, '..', 'dropins', 'node_modules');
  fs.readdir(appsDir, function(err, list) {
    for(i = 0; i < list.length; i++) {
      var appDir = path.join(appsDir, list[i], 'lib');
      console.log('Starting micro-app:' + appDir);
      domain.run(() => createAndStartMicroApp(appDir));
    }
  });
}

module.exports = startMicroApp;
