// utility to search jsonified pvs property descriptions
//

//we want to split the string but keep a record of the tokens            
function splitMulti(str, tokens){
  for(var i = 0; i < tokens.length; i++) {
    var tok = '&t'+tokens[i]+'&t'; 
    str = str.split(tokens[i]).join(tok);
  }
  str = str.split('&t');
  return str;
}
  
function RcpSelector() {
    
  this.selectors = [];  
  
  this.Parse = function(exprs,callback) {
    for(var i=0;i<exprs.length; i++) {
      expr = exprs[i];      
                  
      //console.log('parsing '+expr);
      var elems = splitMulti(expr.trim(),['+','^',' ']);
      //console.log(elems);
      
      var compiled = this.parseSelector(elems);
      this.selectors.push({select:compiled, action:callback,expression:exprs});
    }
  };
  
  this.parseSelector = function(elems) {
    //console.log('3parsing '+elems);
    if (elems.length < 2)
      return this.parseSelectorExpression(elems[0]);
      
    var idx  = elems.length - 1;  
    var res2 = this.parseSelectorExpression(elems[idx]);
    var res1 = this.parseSelector(elems.slice(0,idx-1));
    return this.cmdeval2([res1,{op:elems[idx-1]},res2]);
  }

  this.parseSelectorExpression = function(expr) {
              
    //console.log('2parsing '+expr);
    var elems = splitMulti(expr.trim(),['%','=','>','+','<','~','!','^',' ','|','*']);
    //console.log(elems);
      
    return this.parseSelectorElements(elems);
  };
  
  this.parseSelectorElements = function(elems) {
      
    // and for elem, break down into accessors
    var cmds   = [];
    var atv    = '';
    var isattr = false;
    var cmd    = undefined; // default
    var pitok  = true;
    
    elems.forEach(function(elem) {
                
      var istok = /[><+:~=!^%* ]/g.test(elem);
      //console.log(elem+' istok='+istok);
      //console.log(elem+' pitok='+pitok);
        
      if (istok) {
        cmd = { op: elem};
        cmds.push( cmd );
  
      } else {
    
        var accs = splitMulti(elem.trim(),['[',']','#','$','*']);
          
        //console.log('accs='+accs);  
        for(var i=0; i<accs.length; i++) {
          var acc = accs[i];
          //console.log(acc+' '+pitok);  
          switch(acc) {
            case '' : continue;  
            case '$':
              if (pitok===false) cmds.push({op:'and'});
              cmd = { op: 'c', ac: 'class' , val:accs[++i].toLowerCase() };
              cmds.push( cmd );
              break;
            case '#': 
              if (pitok===false) cmds.push({op:'and'});
              cmd = { op: 'i', ac: 'id' , val:accs[++i] };
              cmds.push( cmd);
              break;
            case '*': 
              if (pitok===false) cmds.push({op:'and'});
              cmd = { op: 'e', ac: '*' };
              cmds.push( cmd);
              break;
            case '[':
              if (pitok==false) cmds.push({op:'and'});
              isattr = true;
              cmd = { op: '?', ac: 'properties' , val:accs[++i].toLowerCase() };
              cmds.push( {op: '('} );
              cmds.push( cmd);
              break;
            case ']':
              isattr = false;
              cmds.push( {op: ')'} );
              break;  
            default: 
              if (isattr) {
                cmd = { op: '?', ac:'var', val: acc.toLowerCase() };
                cmds.push( cmd); 
              }
              else {
                cmd = { op: 'e', ac:'type', val: acc.toLowerCase() };
                cmds.push( cmd); 
              }
              break;
          }
          pitok = false;
        }
      }
      pitok = istok;
    });

    //console.log(cmds);
    return this.cmdeval(cmds);
  }
  
  class result {
    constructor(r,s) {
      this._result = r;
      this._score  = s;
    }
    get result()      { return this._result; }
    set result(value) { this._result = value;}
    get score()       { return this._score;  }
    set score(value)  { this._score = value; }
  }
  
  var compare = (function(op,arg1,arg2) {
                 
    return function(c) {
      var lhs = arg1(c);
      var rhs = arg2(c);
      //console.log('run op '+op+' for '+c.id+' against '+lhs+' and '+rhs);
      switch(op){
        case 'and': // and
          return (rhs != undefined) && (lhs != undefined) ? new result(c,lhs.score+rhs.score) : undefined;  
          break;
          
        case '=':   // equals
          //console.log('testing '+lhs.result+'='+rhs.result);  
          return ((rhs != undefined) && (lhs != undefined) && (lhs.result === rhs.result)) ? new result(c,lhs.score+rhs.score) : undefined;
          break;
          
        case '!':   // not equals
          return ((rhs != undefined) && (lhs != undefined) && (lhs.result != rhs.result)) ? new result(c,lhs.score+rhs.score) : undefined;   
          break;
          
        case '~':   // similar(contains string)
          //console.log('testing '+lhs.result+'~'+rhs.result);  
          return ((rhs != undefined) && (lhs != undefined) && 
                  (lhs.result != undefined) && (rhs.result != undefined) &&
                  (lhs.result.includes(rhs.result))) ? new result(c,lhs.score+rhs.score) : undefined;
          break;
          
        case '<':   // less than
          //console.log('testing '+lhs.result+'<'+rhs.result);  
          if ((rhs != undefined) && (lhs != undefined)) { 
            var lf = parseFloat(lhs.result);
            var rf = parseFloat(rhs.result);
            return (lf < rf) ? new result(c,lhs.score+rhs.score) : undefined;
          } else 
            return undefined;
            
          break;
            
        case '>':   // greater than
          //console.log('testing '+lhs.result+'>'+rhs.result);  
          if ((rhs != undefined) && (lhs != undefined)) {  
            var lf = parseFloat(lhs.result);
            var rf = parseFloat(rhs.result);
            return (lf > rf) ? new result(c,lhs.score+rhs.score) : undefined;
          } else 
            return undefined;
            
          break;
            
        case '^':   // acendant (is parent of)
          var p = c.parent;
          while (p != undefined) {
            lhs = arg1(p);
            if ((rhs != undefined) && (lhs != undefined))
              return new result(c,lhs.score+rhs.score);
            p = p.parent;
          }
          return undefined;
          break;
          
        case ' ':   // immediate child of
          var p = c.parent;
          if (p != undefined) {
            lhs = arg1(p);
            rhs = arg2(c);
            if ((rhs != undefined) && (lhs != undefined)) 
              return new result (c,lhs.score+rhs.score);
          }
          return undefined;
          
        case '+':   // peer of
          var p = c.peers;
          var pcalc = undefined;
          if (p != undefined) {
            for(var i=0;i<p.length;i++) {
              var peer = p[i];      
              lhs = arg1(peer);
              if ((rhs != undefined) && (lhs != undefined)) {
                pcalc = c;
                break;
              } 
            };
          }
          return pcalc != undefined ? new result(pcalc,lhs.score+rhs.score) : undefined;
          
        default: 
          return undefined;  
          break;
      }
    };       
  });

  var exec = (function(cmd) {
            
    return function(entity) {
                  
      //console.log('exec '+cmd.op); //+' on '+JSON.stringify(entity));              
      switch(cmd.op) {
          
        case 'e':   // eval
          //console.log('eval '+cmd.ac+'='+cmd.val);  
          if (entity         != undefined && 
              entity.attr(cmd.ac) != undefined && 
              entity.attr(cmd.ac) === cmd.val) return new result(entity,0x0100);
          break;
          
        case 'c':   // class
        // note class (today) is assumed to be a single string; this could be
        // extended to supporting multiple values (like html) making this
        // an array
        
          //console.log('eval '+entity.class+'='+cmd.val);  
          if (entity       !=  undefined &&
              entity.class === cmd.val) return new result(entity,0x0010);
          break;
          
        case 'i':   // eval
          //console.log('eval '+entity.id+'='+cmd.val);  
          if (entity    !=  undefined &&
              entity.id === cmd.val) return new result(entity,0x1000);
          break;
          
        case '*':   // eval
          //console.log('eval '+entity.id+'='+cmd.val);  
          if (entity    !=  undefined) return new result(entity,0x0001);
          break;
          
        case '?':   // evaluate a query/value
          //console.log('query '+cmd.ac+' with '+cmd.val);  
          
          //a value query just returns the value - could be a number/string
          if (cmd.ac === 'var') return new result(cmd.val,0x0100); 
          
          //otherwise we check if the specified item (property) exists 
          //AND it is not empty
          if (entity              != undefined && 
              entity.attr(cmd.ac) != undefined) {
          
            var cv = entity.property(cmd.val);
            if (cv != undefined && cv.length > 0) 
              return new result(cv,0x1000);
          }
          return undefined;
          break;
          
        default:
          break;
      }
      return undefined;
    };       
  });
        
  this.cmdeval = function(subcmds) {
    
    //console.log('processing1 '+subcmds);  
    var subfinal = undefined;
    var idx = 2; 
    if (subcmds[0].op === '(') {
      if (subcmds[2].op === ')') {
        subfinal = exec(subcmds[1]);
        idx = 4;
      } else {
        subfinal = compare(subcmds[2].op,
                           exec(subcmds[1]),
                           exec(subcmds[3]));
        idx=6;
      }
    } else {
      subfinal = exec(subcmds[0]);
    }
      
    if (subcmds.length < idx)
      return subfinal;
      
    var final = compare(subcmds[idx-1].op,
                        subfinal,
                        this.cmdeval(subcmds.slice(idx)));
      
    return final;
  }
    
  this.cmdeval2 = function(subcmds) {
      
    //console.log('processing2 '+JSON.stringify(subcmds));  
    var subfinal = subcmds[0];
    var idx = 2; 
      
    if (subcmds.length < idx)
      return subfinal;
      
    var final = compare(subcmds[idx-1].op,
                        subfinal,
                        this.cmdeval2(subcmds.slice(idx)));
      
    return final;
  }
    
  // takes a cmd structure and builds an optimal function 'ladder' which
  // will evaluate each cmd.op until they either all pass (calls callback) 
  // or one of them fails.
  this.compile = function(cmds) {
    
    // we should check first, but there should always be an odd number
    if (cmds.length % 2 == 0) {
      // even number
      console.log('error - even number of commands');
      return undefined;
    }
    if (cmds.length === 1)
      return exec(cmds[0]);
      
    return cmdeval(cmds);  
  };
  
  this.eval = function(entity) {
      
    // run through each selector command set ...
    this.selectors.forEach(function(selector) {
                           
      // each is a list of commands that evaluate to true/false
      var runaction = selector.select(entity);
      if (runaction != undefined) {
          
        //debug  
        //console.log('yes action for',entity.path,runaction.score,selector.expression,entity.comp.properties.name);  
        
        if (selector.action != undefined)
          selector.action(entity, runaction.score);
        
      } else {
        //debug
        //console.log('no action for',entity.path,selector.expression);
      }
      
    })
  };  
};

// for each entity selected, keep a running tally of the 'instruction'
// associated with the entity. The 'score' that is calculated from the 
// specificity calculation is used to sort the instructions.  We present
// only the highest score
var todo = [];
var select = (function(selected) {
              
  return function(entity,score) {
      
    var eres = todo[entity.path];
    if (eres === undefined) {
        eres = {}; //selected;
    }
    
    //debug
    //console.log('updating',eres,'for',selected);
    //console.log('score',score);
    var depth = entity.path.split('/').length - 1;
    
    // treat each instruction as a separate scorable item
    for (var a in selected) {
        
      // we keep the item with the highest score  
      var escore = (eres[a] == undefined) ? selected[a].score : eres[a].score;
      
      //debug
      //console.log('comparing',score,escore,'for attribute',a);
      
      if (score > escore || eres[a] == undefined) {
          
          var value = selected[a].value;
          
          /*
          if (value!=undefined && value.startsWith('@')) {
            var replacer = value.slice(1);
            switch(replacer) {
              case 'depth':value = depth; break;
              case 'path': value = entity.path; break;
              default:
                value = entity.property(replacer);
                break;
            }
          } 
          */
          
          if (value!=undefined) {
              
            //this could be a simple literal value, or can include
            //lookup tokens e.g.  iam_[name] where [name] will replace
            //with the value of the property 'name'
            
            
            //look for the pattern [something] and replace with
            //values that we look up from the referenced property
            var reps = [...value.matchAll(/\[(\w*)\]/g)];
            
            // we need to replace the old values with new values
            var oldvalue = value;  
            
            //iterate through the results
            reps.forEach(function(rep) {
              console.log(rep);           
              for(var ri=1;ri<rep.length;ri++) {
                var rp = rep[ri];  
                var replacer = rp;
                switch(replacer) {
                  case 'depth':value = depth; break;
                  case 'path': value = entity.path; break;
                  default:
                    value = entity.property(replacer);
                    break;
                }
                console.log('replacing',oldvalue,rep[0],value);
                oldvalue = oldvalue.replace(rep[0],value!=undefined?value:"");
                console.log('now',oldvalue);
              }
              value = oldvalue;
            })
          } 

          eres[a] = { score :score, value:value };
          
          
            
          //q: should we add the properties to the live structure - this could
          //   allow subsequent queries to leverage previous query results
          
          if (entity.inst == undefined)
            entity.inst = {};
          if (entity.inst.properties == undefined)
            entity.inst.properties = {};
          entity.inst.properties[a] = value;
          
      }
      
      //debug
      //console.log('updated',entity.path,a,eres[a]);  
    }
      
    todo[entity.path] = eres;
    
    //debug
    //console.log('tally',entity.path,eres)
  };       
});
    


var fs  = require('fs');

// our recipe file, to parse. Recipes are of the form
//       selector, selector { instruction, instruction }
// and each selector can comprise of #id$class[property] declarations
var fi  = process.argv[2];

fs.readFile(fi, 'utf8', function(err, data) {
            
  if (err) throw err;
  //console.log(data);
  
  // break out the selectors from the instructions...
  var exprs = splitMulti(data,['{','}']);
  //console.log('exprs',exprs);
  var p = new RcpSelector();
  for (var i=0; i<exprs.length; i+=4) {
    if (exprs[i].trim().length > 0) {
          
      // clean up the selector declarations    
      var expr  = exprs[i].trim().replace(/  +/g,' ');
      
      // split by comma (effectively an OR)
      var elist = expr.split(',');
      //console.log('evaluating',expr,elist);
      // parse the selector and associate the replacesulting actions
      p.Parse(elist, select(parseActions(exprs[i+2]))); 
    }
  }
  selectData(p);
});
    
function parseActions(fi) {
  var alist = fi.trim().replace(/\r\n/g,'').replace(/  +/g,' ').split(',');
  var actions = {};
  
  // split action=value as it will be the value that gets scored
  // e.g. i might have color=red and color=blue and blue will win
  alist.forEach(function(a) {
                
    var expr = a.split('=');
    var lhs  = expr[0].trim();
    var rhs  = expr[1] != undefined ? expr[1].trim() : undefined;
    
    if (lhs != undefined && lhs.length > 0)
      actions[expr[0].trim()] = { score:0, value:rhs };            
  });
  return actions;
}

function selectData(p) {

  var fi  = process.argv[3];
  var pvs = JSON.parse(fs.readFileSync(fi,'utf8'));

  // includes accessor functions for navigating structure
  class node {
      
    constructor(n,e) {
      this.comp = pvs.components[n.cid];
      if (n.par) {
        this.par  = pvs.components[n.par];
        this.inst = this.par.children[n.idx];
      }
      this.ptr  = n;
      this.path = e;
      this.clss = (this.comp != undefined && this.comp.shape != undefined) ? 'part' : 'asm';
    }
  
    attr(a)     { return this.comp[a]; }
    property(p) { 
      if (this.inst               != undefined &&
          this.inst.properties    != undefined &&
          this.inst.properties[p] != undefined) {
        return this.inst.properties[p];
      }
      else 
        return this.comp.properties[p]; 
    }
    
    //we'll have the #id return the (unique) instance path
    get id()    { return this.path; }
    
    //$class is a single string at present; we could extend this to be more
    //like html and support multiple values, but not in this first example
    get class() { return this.clss; }
    
    get parent() {
      if (this.path === undefined || this.path === '/') 
        return undefined; // this is the root
        
      var c = this.path.substring(0,this.path.lastIndexOf('/'));
      if (c === undefined || c.length === 0) 
        c = '/';
        
      return new node(pvs.idmap[c],c);
    }
  
    get peers() {
      // 
      if (this.par != undefined) {
        // walk up to parent
        var c = this.path.substring(0,this.path.lastIndexOf('/'));
        if (c === undefined || c.length === 0) 
          c = '/';
        
        var peers = [];
        var par   = this.par;
        var path  = this.path;
        //console.log('collecting peers for '+this.path);
        var parnode = this.par;
        if (parnode.children != undefined) parnode.children.forEach(function(kid) {
          var np = c.endsWith('/') ? c + kid.vid : c + '/' + kid.vid;
          if (np != path) {                                                        
            var pp = new node(pvs.idmap[np],np);
            //console.log('adding peer '+np);
            peers.push(pp);
          }
        });
        // we could probably cache this against the parent i.e. peers === parent.children    
        return peers;
      }
      return undefined;
    }
  }
  
  // lets record how long this takes (ms)
  var t0 = new Date().getTime();
  
  // we iterate over every item
  for (c in pvs.idmap) {
    p.eval(new node(pvs.idmap[c],c));                  
  };
  
  // stop the clock...
  var t1 = new Date().getTime() - t0;
  
  // write out the results
  //console.log(todo);
  writeAsXml(todo);
  
  // display some stats e.g. count how many items in the results list
  var tdl=0;for(var i in todo) { tdl+=1; };
  
  //console.log('('+tdl+') in '+t1+'ms');
}

function writeAsXml(list) {
    //console.log(list);
    
    //recursively write nodes
    // first, we need to build tree structure
    var xml = { id:'' };
    var map = {}; 
    for(a in list) {    
        //we build a node structure from the path
        path = a;
        var lidx = path.lastIndexOf('/');
        var id = path.slice(lidx+1); 
        var depth = path.split('/').length - 1;
        //console.log('leaf',path);
        map[path] = {id:id, depth:depth, children:{}, properties:list[a]}; // store the properties
        //console.log(path,map[path])
        var kid = map[path];
        while (path.length > 1) {
          path = path.slice(0,lidx);
          depth = path.split('/').length -1;
          lidx = path.lastIndexOf('/');
          id = path.slice(lidx+1); 
          if (path.length==0) { path='/'; id='' }
          //console.log('parent',path,id);
          if (map[path] == undefined)
            map[path] = { id:id, depth:depth, children:{}};
          if (map[path].children[kid.id] == undefined)
            map[path].children[kid.id] = kid;
          //console.log('map',map[path]);
          kid = map[path];   
        }
    };
    
    //debug
    //console.log(map);    
    
    // and traverse from the root ("/")
    function writeNode(node,indent) {
        var space=' ';
        console.log(space.repeat(indent),'<comp' + (node.id.length > 0 ? (' id="'+node.id+'">'):'>'));
        if (node.properties!=undefined) {
          //console.log(node.properties);  
          
              
          //new syntax here : we can have property=value, or property:group=value
          //for the latter, the groupname is used to create the the propertygroup, otherwise we use a default
            
          //first of all, work out the groups we need
          var groups = {};
          var gname;
          //console.log(node.properties);
          for(prop in node.properties) {
            var grp = prop.split(':');
            if (grp.length==1) gname = 'testgroup';
            else               gname = grp[1];
            if (groups[gname] == undefined) 
              groups[gname]=[];
            groups[gname].push(prop);
          }
          //console.log('groups',groups);
          
          // now iterate the group loops
          for(group in groups) {
            console.log(space.repeat(indent+2),'<propertygroup name="'+group+'">');      
            props = groups[group];
            
            for(pidx in props) {
              var prop = props[pidx];
              var propgrp = prop.split(':');
    
              var pp = node.properties[prop];
              if (pp.value != undefined) {
                var value = pp.value.replace(/__+/g,' ');
                if (value != 'ignore') console.log(space.repeat(indent+4),'<property name="'+propgrp[0]+'" value="'+value+'" />')
              }
            }
          console.log(space.repeat(indent+2),'</propertygroup>');      
          }
          
          
/*
          console.log(space.repeat(indent+2),'<propertygroup name="testgroup">');      
          for(prop in node.properties) {
            // replace __ with space
            var value = node.properties[prop].value.replace(/__+/g,' ');
            if (value != 'ignore') console.log(space.repeat(indent+4),'<property name="'+prop+'" value="'+value+'" />')
          }
          console.log(space.repeat(indent+2),'</propertygroup>');      
*/

        }
        for(kids in node.children) writeNode(node.children[kids], indent+2);
        console.log(space.repeat(indent),'</comp>');
    }
    var root = map['/'];
    console.log('<?xml version="1.0" encoding="UTF-8"?>');
    console.log('<pvs_properties>');  
    writeNode(root,0);
    console.log('</pvs_properties>');  
}
