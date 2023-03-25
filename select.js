// utility to search jsonified pvs property descriptions
//
var matrix = require('./matrix.js');

function RcpSelector() {
    
  this.selectors = [];  
  
  this.Parse = function(exprs,callback) {
    for(var i=0;i<exprs.length; i++) {
      expr = exprs[i];      
                  
      //console.log('parsing '+expr);
      var elems = splitMulti(expr.trim(),['+','^',' ']);
      //console.log(elems);
      
      var compiled = this.___parse(elems);
      this.selectors.push({select:compiled, action:callback});
    }
  };
  
  this.___parse = function(elems) {
    //console.log('3parsing '+elems);
    if (elems.length < 2)
      return this.__parse(elems[0]);
      
    var idx  = elems.length - 1;  
    var res2 = this.__parse(elems[idx]);
    var res1 = this.___parse(elems.slice(0,idx-1));
    return this.cmdeval2([res1,{op:elems[idx-1]},res2]);
  }
  
  function splitMulti(str, tokens){
    for(var i = 0; i < tokens.length; i++) {
      var tok = '&t'+tokens[i]+'&t'; 
      str = str.split(tokens[i]).join(tok);
    }
    str = str.split('&t');
    return str;
  }
    
  this.__parse = function(expr) {
    //we want to split the string but keep a record of the tokens            
    //console.log('2parsing '+expr);
    var elems = splitMulti(expr.trim(),['%','=','>','+','<','~','!','^',' ','|','*']);
    //console.log(elems);
      
    return this._parse(elems);
  };
  
  this._parse = function(elems) {
      
    // and for elem, break down into accessors
    var cmds = [];
    var atv  = '';
    var isattr = false;
    var cmd   = undefined; // default
    var pitok = true;
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
      var lhs=arg1(c);
      var rhs=arg2(c);
      //console.log('run op '+op+' for '+c.id+' against '+lhs+' and '+rhs.result);
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
          if ((rhs != undefined) && (lhs != undefined)) {  
            var lf = parseFloat(lhs.result);
            var rf = parseFloat(rhs.result);
            return (lf < rf) ? new result(c,lhs.score+rhs.score) : undefined;
          } else 
            return undefined;
          break;
        case '>':   // greater than
          if ((rhs != undefined) && (lhs != undefined)) {  
            var lf = parseFloat(lhs.result);
            var rf = parseFloat(rhs.result);
            return (lf > rf) ? new result(c,lhs.score+rhs.score) : undefined;
          } else 
            return undefined;
          break;
        case '^':   // ascendant (is parent of)
          var p = c.parent;
          while (p != undefined) {
            lhs = arg1(p);
            if ((rhs != undefined) && (lhs != undefined)) {
              return new result(c,lhs.score+rhs.score);
            }
            p = p.parent;
          }
          return undefined;
          break;
        case ' ':   // immediate child of
          var p = c.parent;
          if (p != undefined) {
            lhs = arg1(p);
            rhs=arg2(c);
            if ((rhs != undefined) && (lhs != undefined)) 
              return new result (c,lhs.score+rhs.score);
          }
          return undefined;
          break;
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
        case ':':   // collection
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
        case '?':   // eval
          //console.log('query '+cmd.ac+' with '+cmd.val);  
          
          //a value query just returns the value
          if (cmd.ac === 'var') return new result(cmd.val,0x0100); 
          
          //otherwise we check if the specified item (property)exists AND it is not empty
          if (entity              != undefined && 
              entity.attr(cmd.ac) != undefined) {
          var cv = entity.property(cmd.val);
          
              if (cv != undefined && cv.length > 0) {
                  //console.log('query '+cmd.ac+' with '+cmd.val+'='+cv);  
                  return new result(cv,0x1000);
              } 
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
      
    // we should double check, but there should be 3
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
      
    // we should double check, but there should be 3
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
        console.log(runaction.score);
        //console.log('all works out for '+entity+', calling callback');
        if (selector.action != undefined)
          selector.action(entity);
      }
      
    })
  };
    
};


//our command to parse
var fi  = process.argv[2];

var args = {};
for (var a=4; a<process.argv.length; a++) {
    var ax = process.argv[a].split(':');
    args[ax[0]] = ax[1];
    fi = fi.replace('{'+ax[0]+'}',ax[1]);
}

var inp = fi.replace(/  +/g,' ');
//console.log('processing '+inp);
var exprs = inp.split(',');
//console.log('there are '+exprs.length+' expressions');
var p = new RcpSelector();
p.Parse(exprs,function(c) { console.log('selected '+c.path); });

var fs  = require('fs');
var fi  = process.argv[3];
var pvs = JSON.parse(fs.readFileSync(fi,'utf8'));

function traverse(node, position, path, inst) {
    var cbox = undefined;    
    if (node.children != undefined) {
        
        cbox = new matrix.BBox();
        node.children.forEach(function(kid) {
            var child = pvs.components[kid.cidref];
            var m     = new matrix.Matrix4();
            if (kid.location != undefined) {
                 if (kid.location.orientation != undefined) 
                    m.RotateA(kid.location.orientation.matrix);
                if (kid.location.position != undefined)
                    m.TranslateV(kid.location.position);
            }
            if (position != undefined)
                m.Multiply(position.m);
                
            // save this for future access
            kid.global = {}; kid.global.matrix = m;
            
            var ech = path[path.length-1];
            var idpath;
            if (ech != '/') 
                idpath = path + "/" + kid.vid;
            else 
                idpath = path + kid.vid;
                
            cbox.Envelope(traverse(child, m, idpath, kid));
        });
    } 

    if (inst.properties === undefined) inst.properties = {};
    if (node.shape != undefined) {
        if (node.bbox != undefined) {
            var box   = new matrix.BBox().Set(node.bbox.min, node.bbox.max);
            if (position != undefined) {
                var tbox = box.Transform(position);
                inst.properties._size_ =  tbox.Size().toString() ;                
                return tbox;    
            } else {
                inst.properties._size_ = box.Size().toString();                
                return box;    
            }
        } else return undefined;
    } else if (cbox != undefined) {
        
        inst.properties._size_ = cbox.Size().toString();                

        return cbox;    
    } else 
        return undefined;    
}


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
    get id()    { return this.path; }
    get class() { return this.clss; }
    get parent() {
        if (this.path === undefined || this.path === '/') return undefined; // this is the root
        var c  = this.path.substring(0,this.path.lastIndexOf('/'));
        if (c === undefined || c.length === 0) c = '/';
        return new node(pvs.idmap[c],c);
    }
    get peers() {
        // 
        if (this.par != undefined) {
            // walk up to parent
            var c = this.path.substring(0,this.path.lastIndexOf('/'));
            if (c === undefined || c.length === 0) c = '/';
            var peers = [];
            var par = this.par;
            var path = this.path;
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

var iroot  = pvs.components.length - 1;
var root   = pvs.components[iroot];
traverse(root, undefined, "/", root);

// we iterate over every item
for (c in pvs.idmap) {
  p.eval(new node(pvs.idmap[c],c));                  
};
