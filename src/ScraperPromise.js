var async = require('async');

/**
 * @constructor
 */
var ScraperPromise = function(scraper) {
	/**
	 * Scraper to use..
	 *
	 * @type {?Scraper}
	 * @private
	 */
	this.scraper = scraper || null;
	/**
	 * Promise chunks.
	 *
	 * @type {!Array.<function(function(?))>}
	 * @private
	 */
	this.promises = [];
	/**
	 * Function to call when all the promises are fulfilled.
	 *
	 * @type {!function(?)}
	 * @private
	 */
	this.doneCallback = function() {};
	/**
	 * Function to call when there's an error.
	 *
	 * @type {?function(?)}
	 * @private
	 */
	this.errorCallback = null;
	/**
	 * A parameter object to be passed to the chain, at the _fire
	 *   method. This should be set immediately before the call, and
	 *   reset to null right after the call, or after it's been stored
	 *   elsewhere.
	 *
	 * @type {?}
	 * @private
	 */
	this.chainParameter = null;
};
ScraperPromise.prototype = {
	constructor: ScraperPromise,
	/**
	 * Sets a promise for a status code, of a response of a request.
	 *
	 * @param  {!(number|function(number))} code Status code to
	 *   dispatch the message. Or a callback function, in this case
	 *   the function's first parameter is the status code, as a
	 *   number.
	 * @param  {!function()} callback Callback function for the case
	 *   where the status code is provided.
	 * @return {!ScraperPromise} This object, so that new promises can
	 *   be made.
	 * @public
	 */
	onStatusCode: function(code, callback) {
		if (typeof code == 'function') {
			callback = code;
			this.promises.push(function onGenericStatusCode(done, utils) {
				callback(this.scraper.getStatusCode(), utils);
				done();
			});
		} else {
			this.promises.push(function onStatusCode(done, utils) {
				if (code === this.scraper.getStatusCode()) {
					callback(utils);
				}
				done();
			});
		}
		return this;
	},
	/**
	 * Sets a promise to scrape the retrieved webpage.
	 *
	 * @param  {!function(?, ?)} scrapeFn Function to scrape the
	 *   webpage. The parameters depend on what kind of scraper.
	 * @param  {!function(?)} callback Callback function with the
	 *   result of the scraping function.
	 * @param  {...?} var_args Optional arguments to pass as
	 *   parameters to the scraping function.
	 * @return {!ScraperPromise} This object, so that new promises can
	 *   be made.
	 * @public
	 */
	scrape: function(scrapeFn, callback) {
		var extraArguments = Array.prototype.slice.call(arguments, 2);
		this.promises.push(function scrape(done, utils) {
			this.scraper.scrape(scrapeFn, function(err, result) {
				if (err) {
					done(err);
				} else {
					callback(result, utils);
					done();
				}
			}, extraArguments);
		});
		return this;
	},
	/**
	 * Sets a promise to delay the execution of the promises.
	 *
	 * @param  {!number} time Time in milliseconds to delay the
	 *   execution.
	 * @param  {!function()=} callback Function to call after the
	 *   delay.
	 * @return {!ScraperPromise} This object, so that new promises can
	 *   be made.
	 * @public
	 */
	delay: function(time, callback) {
		callback = callback || function() {};
		this.promises.push(function delay(done, utils) {
			setTimeout(function() {
				callback(utils);
				done();
			}, time);
		});
		return this;
	},
	/**
	 * Sets a promise to execute a promise after a time period. This
	 *   does not cause the promise chain to block.
	 *
	 * @param  {!number} time Time in milliseconds to the execution of
	 *   the callback.
	 * @param  {!function()} callback Function to call after the
	 *   time period has passed.
	 * @return {!ScraperPromise} This object, so that new promises can
	 *   be made.
	 * @public
	 */
	timeout: function(time, callback) {
		this.promises.push(function timeout(done, utils) {
			setTimeout(function() {
				callback(utils);
			}, time);
			done();
		});
		return this;
	},
	/**
	 * Sets the end of the promise chain callback, if there were no
	 *   errors.
	 *
	 * @param  {!function()} doneFn Callback function.
	 * @return {!ScraperPromise} This object, so that new promises can
	 *   be made.
	 * @public
	 */
	done: function(doneFn) {
		this.doneCallback = doneFn;
		return this;
	},
	/**
	 * Sets a generic promise.
	 *
	 * @param  {!function()} callback Callback.
	 * @return {!ScraperPromise} This object, so that new promises can
	 *   be made.
	 * @public
	 */
	then: function(callback) {
		this.promises.push(function then(done, utils) {
			callback(utils);
			done();
		});
		return this;
	},
	/**
	 * Sets a promise to when an error occur, note that an error will
	 *   break the promise chain, so this is the next promise to be
	 *   called and if the done promise is not set the last. To avoid
	 *   silent errors, if this promise is not defined the error will
	 *   be thrown up.
	 *
	 * @param  {!function(?)} callback Callback.
	 * @return {!ScraperPromise} This object, so that new promises can
	 *   be made.
	 * @public
	 */
	onError: function(callback) {
		this.errorCallback = callback;
		return this;
	},
	/**
	 * Makes an HTTP GET request to the url.
	 *
	 * @param  {!string} url Url to make the request.
	 * @return {!ScraperPromise} This object, so that new promises can
	 *   be made.
	 * @public
	 */
	get: function(url) {
		var that = this;
		this.scraper.get(url, function(err) {
			that._fire(err);
		});
		return this;
	},
	/**
	 * Makes a (possible more complex) HTTP request. For more
	 *   information refer to {@link https://github.com/mikeal/request#requestoptions-callback}.
	 *
	 * @param  {!Object} options Options of the request.
	 * @return {!ScraperPromise} This object, so that new promises can
	 *   be made.
	 * @public
	 */
	request: function(options) {
		var that = this;
		this.scraper.request(options, function(err) {
			that._fire(err);
		});
		return this;
	},
	/**
	 * Sets a parameter to be used in the next _fire call.
	 *
	 * @param {?Object} param Parameter.
	 * @public
	 */
	_setChainParameter: function(param) {
		this.chainParameter = param;
	},
	/**
	 * Starts the promise chain.
	 *
	 * @param  {?} error Error object, to fire the error callback,
	 *   from an error that happened before.
	 * @param  {!Scraper} scraper Scraper to use in the promise chain.
	 * @protected
	 */
	_fire: function(error) {
		var that = this,
			param = this.chainParameter,
			stopPointer = {},
			utils = {
				stop: function() {},
				//next: function() {}, //TODO
				scraper: this,
				params: param
			},
			keep = true;
		this.chainParameter = null;

		if (error) {
			this.errorCallback(error);
			this.doneCallback();
			return;
		}

		async.eachSeries(this.promises, function dispatcher(fn, callback) {
			var done = function(err) {
				if (err === stopPointer) {
					keep = false;
					callback(err);
				} else if (err) {
					callback(err);
				} else if (keep) {
					callback();
				}
			};
			utils.stop = function() {
				done(stopPointer);
			};

			try {
				fn.call(that, done, utils);
			} catch (err) {
				done(err);
			}
		}, function(err) {
			utils.stop = function() {};
			var trh = false;
			if (err && err !== stopPointer) {
				if (that.errorCallback) {
					that.errorCallback(err, utils);
				} else {
					trh = true;
				}
			}
			that.doneCallback(utils);
			that.scraper.close();
			if (trh) {
				throw err;
			}
		});
	},
	/**
	 * Sets the promises.
	 *
	 * @param {!Array.<function(function(?))>} promises Promises array.
	 * @public
	 */
	_setPromises: function(promises) {
		this.promises = promises;
	},
	/**
	 * Clones the promise and the scraper.
	 *
	 * @return {!ScraperPromise} Scraper promise with an empty scraper
	 *   clone.
	 * @public
	 */
	clone: function() {
		var instance = this.scraper.clone(),
			promise = new ScraperPromise(instance);
		promise._setPromises(this.promises);
		promise.done(this.doneCallback);
		promise.onError(this.errorCallback);
		return promise;
	}
};

module.exports = ScraperPromise;