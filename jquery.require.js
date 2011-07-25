/*------------------------------------------------------------------------------

    jQuery.require - asynchronous runtime dependency handling

    Copyright 2011 James Sanders

    Feel free to use this however you like, just don't blame me if it breaks
    your code, causes your site to fall over, kills your dog, etc.

    Requires: jQuery 1.5 or above due to extensive use of $.Deferred

    Usage:

	$.require(urls, [callback])

	Will ensure the scripts found at the specified URLs have been evaluated
	before executing the optional callback. "urls" can be a string or an
	array. The function also returns a promise to enable the use of failure
	callbacks.

	Scripts will only be evaluated once; if they have already been imported
	then the callback will be executed immediately.

	Any script can have any number of dependencies, specified by including
	a number of comment lines within the script in the form:

	    // @require "some-other-script.js"

	The parameter to @require will be resolved relative to the script's
	location.

	N.B. only scripts imported via $.require will be taken into account
	when determining whether to evaluate a script, if a script has already
	been executed via a <script src>, it will be run twice.

	The following code snippets are identical in function:

	    $.require(url, f)

	and

	    $.require(url).done(f)

------------------------------------------------------------------------------*/

(function($) {

// return a canonical url, converting relative paths to absolute ones, in order
// to ensure a file is only loaded once
function canonicalURL(source, path) {
    if (path.indexOf("://") != -1)
	return path;
    var a = document.createElement("a");
    if (path.charAt(0) == "/") {
	var afterProtocol = source.indexOf("//") + 2;
	a.href = source.substring(0, source.indexOf("/", afterProtocol)) + path;
    } else {
	a.href = source.substring(0, source.lastIndexOf("/") + 1) + path;
    }
    return a.href;
}


$.require = function(urls, callback) {
    if (urls.constructor == String)
	urls = [urls];
    return _require(urls, callback, window.location.href);
}

function _require(urls, callback, source) {
    var requests = [];

    $.each(urls, function(_, url) {
	url = canonicalURL(source, url);
	var req = $.require.loadedJS[url];
	if (req != null) {
	    requests.push(req);
	    return;
	}
	var req = $.Deferred();
	var promise = req.promise();
	$.require.loadedJS[url] = promise;
	requests.push(promise);
	$.ajax({
	    url: url,
	    dataType: "text",
	    success: function(script) {
		var re = /^\/\/ *@require +['"]([^'"]+)['"]/gm;
		var requirements = [];
		var match;
		while ((match = re.exec(script)))
		    requirements.push(match[1]);
		var runScript = function() {
		    try {
			$.globalEval(script);
			req.resolve();
		    } catch (evalError) {
			req.reject();
		    }
		}
		if (requirements.length > 0) {
		    _require(requirements, null, url).then(
			runScript,
			function() { req.reject(); }
		    );
		} else {
		    runScript();
		}
		$.require.loadedJS[url] = true;
	    },
	    error: function() {
		var error = Error();
		error.message = "[@require] file required by " + source + " not found: " + url;
		req.reject();
		$.require.loadedJS[url] = false;
		throw error;
	    }
	});
    });
    var result = $.when.apply(null, requests);
    if (callback)
	return result.done(callback);
    return result;
}
$.require.loadedJS = {};

})(jQuery);
