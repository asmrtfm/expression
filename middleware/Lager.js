import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/* every endpoint served by an actively logged route
will generate two corresponding json files per method
according to the following schema:
	`.logs/<routeName>/<apiEndpoint>/<httpMethod>_<requests|responses>.json`
*/

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/*
if at first it appears redundant that we output the logs to <routeName>/<originalUrl>/...
which most of the time leads to, for example: `.logs/users/api/users/login/...`
this is a feature, not a bug.

just remember that <routeName> refers to the basename of the route file through which the endpoint was served,
which may not always reflect the naming conventions of the api endpoints being logged.
thus if you find this tool's output schema redundant, then you are probably following naming-convention best practices.

the goal of this middleware is to passively provide as much data as possible while remaining simple.
if the insights you're after involve knowing which route file was serving the endpoint that a particular request/response came in/went out on,
this can easily be determined by the directory structure.
if all you care about is mapping out your api's flow, then just ignore that first directory.
*/

const logDirName =(routeName, originalUrl)=> `../.logs/${routeName}/${originalUrl.split('?')[0]}`.replaceAll('//', '/');


// effectively: mkdir -p .logs/<ROUTE>/<ENDPOINT>
function chkDir(d) {
	fs.mkdirSync(d, { recursive: true }, (err) => {
		if (err) console.error(`Error creating log directory: '${logDir}'`, err);
	});
}

// filename = <METHOD>_[request|response].json
const logFileName =(method, r)=> `${method.toLowerCase()}_${r}.json`

// write the entry to the log
function lager(logFile, logEntry) {
	fs.appendFile(logFile.replaceAll('//', '/'), logEntry, (err) => {
		if (err) console.error(`Error writing to log file: '${logFile}'`, err);
	});
}

/* middleware to log incomming requests
(designed to be the very first middleware (even before auths),
in order to log the request before anything has a chance to modify it) */
export function RequestLager(routeName) {
	return function(req, res, next) {
		const logDir = path.join(__dirname, logDirName(routeName, req.originalUrl));
		chkDir(logDir);
		const logFile = path.join(logDir, logFileName(req.method, "requests"));
		const logEntry = JSON.stringify({
			timestamp: new Date().toISOString(),
			method: req.method,
			url: req.originalUrl,
			body: req.body,
			headers: req.headers
		}) + '\n';
		lager(logFile, logEntry);
		next();
	};
}

/* middleware to log outgoing responses
(designed to be the very last middleware in order to capture responses as they were when they left) */
export function ResponseLager(routeName) {
	return function(req, res, next) {
		const originalSend = res.send.bind(res);
		const logDir = path.join(__dirname, logDirName(routeName, req.originalUrl));
		chkDir(logDir);
		const logFile = path.join(logDir, logFileName(req.method, "responses"));
		res.send = (body) => {
			const logEntry = JSON.stringify({
				timestamp: new Date().toISOString(),
				method: req.method,
				url: req.originalUrl,
				data: JSON.parse(body)
			}) + '\n';
			lager(logFile, logEntry);
			originalSend(body);
		};
		next();
	};
}
