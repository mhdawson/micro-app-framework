// Copyright 2014-2015 the project authors as listed in the AUTHORS file.
// All rights reserved. Use of this source code is governed by the
// license that can be found in the LICENSE file.

var bcrypt = require('bcryptjs');
console.log(process.argv[2]);
var hash = bcrypt.hashSync(process.argv[2], 10);
console.log(hash);
console.log(bcrypt.compareSync(process.argv[2], hash.toString()));
