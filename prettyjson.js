var fs = require('fs');

var fi     = process.argv[2];
var fo     = process.argv[3];

var gltfin = JSON.parse(fs.readFileSync(fi,'utf8'));
if (fo === undefined)
    console.log(JSON.stringify(gltfin));
else
    fs.writeFile(fo, JSON.stringify(gltfin,null,'\t'), function(err){
        if (err) throw err;
        console.log('Done!');
    })
   
