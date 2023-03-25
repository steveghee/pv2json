// SG
// pvs2json v1
//
var fs = require('fs');
var x2j= require('xml2js');
var linq=require('linq');
var matrix = require('./matrix.js');

var cmps = new Array();
var minimal = process.argv.length >4;

function convert(pvs) {
    var top = pvs['PV_FILE'];
    
    /* 
      
      //ideally, walk through the property list and only keep the ones
      //the user has asked to keep (could be a file list or a comma-separated
      //list on the commandline
                                  
    var props  = top.section_properties; 
    var psx = 1;
    props.forEach(function(p){
        var idx = 0;          
        //console.log('section ' + top.section_index[0].internal_section[psx++].$.description);
    	p.property_component_ref.forEach(function(q){
            if (q.$ != undefined) idx += q.$.index_offset-1; 
            //instance properties                             
            if (q.property_instance_ref != undefined) {
                var cidx = 0;
    	        q.property_instance_ref.forEach(function(r){
                    if (r.$ != undefined) cidx += r.$.index_offset-1; 
                    if (r.property != undefined) {
    	                r.property.forEach(function(s){
                            var inst = cmps[idx].children[cidx];
                            if (inst.properties === undefined) 
                                inst.properties = new Object();
                            inst.properties[s.$.name.toLowerCase()]=s.$.value.toLowerCase().trim();
                            //console.log('instance '+cidx+' of component '+idx+' has property '+s.$.name+' = ' + s.$.value);    
                        });
                    }
                    cidx+=1;    
                });
            }
                
            idx+=1;
    	});
    });
    */

    top.section_properties = new Array();
    // if we had kept any items from the filtering operation. here is
    // where we add them
    return pvs;
}

// fi = file in
var fi= process.argv[2];
var parser = new x2j.Parser();
fs.readFile(fi, function(err, data) {
    //console.log('read file ok');
    parser.parseString(data, function (err, result) {
        var pvs = JSON.stringify(result);
        var all = convert(result);
        
        var builder = new x2j.Builder({headless:true});
        var xml = builder.buildObject(all);
        
        var fo  = process.argv[3];
        if (fo === undefined)
            console.log(xml);
        else
            fs.writeFile(fo, xml, function(err){
        		if (err) throw err;
        		console.log('Done!');
            })
    });
});
    
