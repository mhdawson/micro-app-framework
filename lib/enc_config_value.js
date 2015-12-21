// Copyright 2014-2015 the project authors as listed in the AUTHORS file.
// All rights reserved. Use of this source code is governed by the
// license that can be found in the LICENSE file.

var passphrase = process.argv[3] + process.argv[3];
var CryptoJS = require('crypto-js');
console.log(CryptoJS.AES.encrypt(process.argv[2], passphrase).toString());

