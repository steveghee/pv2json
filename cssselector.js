// SG
// pvs2json v1
//
var fs = require('fs');
var cs = require('cheerio');


var fi= process.argv[2];
fs.readFile(fi, function(err, data) {
    console.log('read file ok');
    var $ = cs.load(data, {
                    xml: {
                        xmlMode:true,
                        normalizeWhitespace:false
                    }
                    });
    console.log(cs.xml($('instance[type="group"] attribute[name]')));
    //console.log($.xml());
});
    
