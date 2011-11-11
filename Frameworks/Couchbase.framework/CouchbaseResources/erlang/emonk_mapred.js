// Licensed under the Apache License, Version 2.0 (the "License"); you may not
// use this file except in compliance with the License. You may obtain a copy of
// the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
// WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
// License for the specific language governing permissions and limitations under
// the License.

var resolveModule = function(names, mod, root) {
  if (names.length == 0) {
    if (typeof mod.current != "string") {
      throw ["error","invalid_require_path",
        'Must require a JavaScript string, not: '+(typeof mod.current)];
    }
    return {
      current : mod.current,
      parent : mod.parent,
      id : mod.id,
      exports : {}
    };
  }
  // we need to traverse the path
  var n = names.shift();
  if (n == '..') {
    if (!(mod.parent && mod.parent.parent)) {
      throw ["error", "invalid_require_path", 'Object has no parent '+JSON.stringify(mod.current)];
    }
    return resolveModule(names, {
      id : mod.id.slice(0, mod.id.lastIndexOf('/')),
      parent : mod.parent.parent,
      current : mod.parent.current
    });
  } else if (n == '.') {
    if (!mod.parent) {
      throw ["error", "invalid_require_path", 'Object has no parent '+JSON.stringify(mod.current)];
    }
    return resolveModule(names, {
      parent : mod.parent,
      current : mod.current,
      id : mod.id
    });
  } else if (root) {
    mod = {current : root};
  }
  if (!mod.current[n]) {
    throw ["error", "invalid_require_path", 'Object has no property "'+n+'". '+JSON.stringify(mod.current)];
  }
  return resolveModule(names, {
    current : mod.current[n],
    parent : mod,
    id : mod.id ? mod.id + '/' + n : n
  });
};

var Couch = {
  // moving this away from global so we can move to json2.js later
  toJSON : function (val) {
    return JSON.stringify(val);
  },
  compileFunction : function(source, ddoc) {    
    if (!source) throw(["error","not_found","missing function"]);

    var evaluate_function_source = function(source, evalFunction, sandbox) {
      sandbox = sandbox || {};
      if(typeof CoffeeScript === "undefined") {
        return evalFunction(source, sandbox);
      } else {
        coffee = CoffeeScript.compile(source, {bare: true});
        return evalFunction(coffee, sandbox);
      }
    }

    try {
      if (sandbox) {
        if (ddoc) {
          if (!ddoc._module_cache) {
            ddoc._module_cache = {};
          }
          var require = function(name, module) {
            module = module || {};
            var newModule = resolveModule(name.split('/'), module.parent, ddoc);
            if (!ddoc._module_cache.hasOwnProperty(newModule.id)) {
              // create empty exports object before executing the module,
              // stops circular requires from filling the stack
              ddoc._module_cache[newModule.id] = {};
              var s = "function (module, exports, require) { " + newModule.current + " }";
              try {
                var func = sandbox ? evalcx(s, sandbox) : eval(s);
                func.apply(sandbox, [newModule, newModule.exports, function(name) {
                  return require(name, newModule);
                }]);
              } catch(e) { 
                throw ["error","compilation_error","Module require('"+name+"') raised error "+e.toSource()]; 
              }
              ddoc._module_cache[newModule.id] = newModule.exports;
            }
            return ddoc._module_cache[newModule.id];
          };
          sandbox.require = require;
        }
        var functionObject = evaluate_function_source(source, evalcx, sandbox);
      } else {
        var functionObject = evaluate_function_source(source, eval);
      }
    } catch (err) {
      throw(["error", "compilation_error", err.toSource() + " (" + source + ")"]);
    };
    if (typeof(functionObject) == "function") {
      return functionObject;
    } else {
      throw(["error","compilation_error",
        "Expression does not eval to a function. (" + source.toSource() + ")"]);
    };
  },
  recursivelySeal : function(obj) {
    // seal() is broken in current Spidermonkey
    try {
      seal(obj);
    } catch (x) {
      // Sealing of arrays broken in some SpiderMonkey versions.
      // https://bugzilla.mozilla.org/show_bug.cgi?id=449657
    }
    for (var propname in obj) {
      if (typeof obj[propname] == "object") {
        arguments.callee(obj[propname]);
      }
    }
  }
};

// prints the object as JSON, and rescues and logs any toJSON() related errors
function respond(obj) {
  try {
    print(Couch.toJSON(obj));
  } catch(e) {
    log("Error converting object to JSON: " + e.toString());
    log("error on obj: "+ obj.toSource());
  }
};

function log(message) {
  // idea: query_server_config option for log level
  if (typeof message == "xml") {
    message = message.toXMLString();
  } else if (typeof message != "string") {
    message = Couch.toJSON(message);
  }
  respond(["log", String(message)]);
};

function isArray(obj) {
  return toString.call(obj) === "[object Array]";
}
// Licensed under the Apache License, Version 2.0 (the "License"); you may not
// use this file except in compliance with the License. You may obtain a copy of
// the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
// WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
// License for the specific language governing permissions and limitations under
// the License.

var __server_config = {};
var __map_funs = [];
var __red_funs = [];
var __map_results = [];
var __log_messages = [];
var __message = null;

var converter = function(key, holder) {
  var value = holder[key];
  if(value && typeof value === 'object' &&
      typeof value.toJSON === "function") {
    value = value.toJSON(key)
  }
  switch (typeof value)
  {
    case 'string':
      return value;
    case 'number':
      return isFinite(value) ? value : "null";
    case "boolean":
    case "null":
    case "undefined":
      return value;
    case "object":
      break;
    default:
      throw({"invalid_json_type": typeof(value)});
  }
  if(!value)
    return null;
  if(Object.prototype.toString.apply(value) === '[object Array]') {
    var length = value.length;
    var ret = new Array();
    for(var i = 0; i < length; i++) {
      ret[i] = converter(i, value);
      if(ret[i] === undefined) {
        ret[i] = null;
      }
    }
    return ret;
  }
  var ret = {}
  for(var k in value) {
    if(Object.hasOwnProperty.call(value, k)) {
      var v = converter(k, value);
      if(v) {
        ret[k] = v;
      }
    }
  }
  return ret;
}

var respond = function(obj) {
  return converter('', {'': obj});
}

var log = function(message) {
  __log_messages.push(respond(message));
};

var handle_error = function(e) {
  var type = e[0];
  if (type == "fatal" || type == "error") {
    return e;
  } else if (e.error && e.reason) {
    // compatibility with old error format
    return ["error", e.error, e.reason];
  } else {
    return ["error", "unnamed_error", e.toSource()];
  }
};

var handle_view_error = function(err, doc) {
  if (err == "fatal_error") {
    throw(["error", "map_runtime_error", "function raised 'fatal_error'"]);
  } else if (err[0] == "fatal") {
    throw(err);
  }
  var message = "function raised exception " + err.toSource();
  if (doc) message += " with doc._id " + doc._id;
  log(message);
};

var emit = function(key, value) {
    __map_results[__map_results.length-1].push([key, value]);
};

var sum = function(values) {
  var rv = 0;
  for(var i in values) {
    rv += values[i];
  }
  return rv;
};

var compile_function = function(source) {    
  if (!source) throw(["error", "not_found", "missing function"]);
  var func = undefined;
  try {
    var func = eval(source);
  } catch (err) {
    throw(["error", "compilation_error", err.toSource() + " (" + source + ")"]);
  }
  if(typeof(func) == "function") {
    return func;
  } else {
    throw(["error","compilation_error",
      "Expression does not eval to a function. (" + source.toSource() + ")"]);
  }
};

var configure = function(config) {
  __server_config = config || {};
  return respond(true);
}

var compile = function(maps, reds) {
  try {
    __map_funs = new Array(maps.length);
    for(var i = 0; i < maps.length; i++) {
      __map_funs[i] = compile_function(maps[i]);
    }
    __red_funs = {};
    for(var i = 0; i < reds.length; i++) {
      var view_id = reds[i][0];
      __red_funs[view_id] = new Array(reds[i][1].length);
      for(var j = 0; j < reds[i][1].length; j++) {
        __red_funs[view_id][j] = compile_function(reds[i][1][j]);
      }
    }
    return respond(true);
  } catch(e) {
    return respond(handle_error(e));
  }
};

var map = function(doc) {
  try {
    __map_results = new Array();
    __map_funs.forEach(function(fun) {
      __map_results.push([]);
      try {
        fun(doc);
      } catch(e) {
        handle_view_error(e);
        __map_results[__map_results.length-1] = [];
      }
    });
    return respond(__map_results);
  } catch(e) {
    return respond(handle_error(e));
  }
};

var check_reductions = function(reductions) {
  var line_length = JSON.stringify(__message).length;
  var reduce_line = JSON.stringify(reductions);
  var reduce_length = reduce_line.length;
  if (__server_config && __server_config.reduce_limit &&
          reduce_length > 200 && ((reduce_length * 2) > line_length)) {
    var reduce_preview = "Current output: '" + reduce_line.substring(0, 100) +
                        "'... (first 100 of " + reduce_length + " bytes)";
    return ["error", "reduce_overflow_error",
            "Reduce output must shrink more rapidly: " + reduce_preview];
  } else {
    return reductions;
  }
}

var reduce = function(view_id, kvs) {
  var keys = new Array(kvs.length);
  var vals = new Array(kvs.length);
  for(var i = 0; i < kvs.length; i++) {
      keys[i] = kvs[i][0];
      vals[i] = kvs[i][1];
  }
  var reductions = new Array(__red_funs[view_id].length);
  for(var i = 0; i < __red_funs[view_id].length; i++) {
      reductions[i] = __red_funs[view_id][i](keys, vals, false);
  }
  if(keys.length > 1) {
    return respond(check_reductions(reductions));
  } else {
    return respond(reductions);
  }
}

var rereduce = function(view_id, vals) {
  var reductions = new Array(__red_funs[view_id].length);
  for(var i = 0; i < __red_funs[view_id].length; i++) {
    reductions[i] = __red_funs[view_id][i](null, vals[i], true);
  }
  if(vals.length > 1) {
    return respond(check_reductions(reductions));
  } else {
    return respond(reductions);
  }
}
