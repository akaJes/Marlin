//modules
var fs = require('fs');
var path = require('path');
var mc = require('./mc');
var mctool = require('./mc-tool');
var walk = require('./walk').walk;

var doJson=a=>
walk('./Marlin/example_configurations')
.then(f=>f.filter(a=>/Configuration(_adv)?\.h/.test(a)))
.then(f=>Promise.all(f.map(mctool.makeJson)))
.then(a=>(console.log('done ALL json'),a))

var doH=a=>
walk('./Marlin/example_configurations')
.then(f=>f.filter(a=>/Configuration(_adv)?\.json/.test(a)))
.then(f=>Promise.all(f.map(mctool.makeH)))
.then(a=>console.log('done ALL h'))

var is={tree:1,json:1,h:1}.filter((v,key)=>process.argv.indexOf(key)>=0);

if ( !is.tree ) {
  if ( is.json )
    Promise.resolve(['./Marlin/Configuration_adv.h','./Marlin/Configuration.h'])
    .then( a=> a.map(mctool.makeJson) )
  else
    Promise.resolve(['./Marlin/Configuration_adv.json','./Marlin/Configuration.json'])
    .then( a=> is.h ? a.map(mctool.makeH) : 0)
}else
  Promise.resolve()
  .then( is.json ? doJson : 0 )
  .then( is.h ? doH : 0)

