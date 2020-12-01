// @ts-check
const MQTT = require("async-mqtt");

const params = new URLSearchParams(window.location.search)

if (params.has('user') && params.has('pass') && params.has('url')) {
	run(params.get('user'), params.get('pass'), params.get('url'))
} else {
	console.log('user,pass,url params must be in url')
}


async function run(user, pass, url) {

	const opts = {
		username: user,
		password: pass
	}
	//const url = "wss://b-6399d958-9185-43a8-9779-ffa4c6c7ecea-1.mq.us-west-2.amazonaws.com:61619"
	const client = await MQTT.connectAsync(url, opts)

	console.log("Starting");
	try {
		await client.publish("camerons-mini.lan", "It works!");
		// This line doesn't run until the server responds to the publish
		await client.end();
		// This line doesn't run until the client has disconnected without error
		console.log("Done");
	} catch (e) {
		// Do something about it!
		console.log(e.stack);
		process.exit();
	}
}
