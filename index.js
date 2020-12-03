// @flow
// @ts-check

import WebSocketAsPromised from 'websocket-as-promised';
const mqtt = require("mqtt-packet")

/**
 * @type {mqtt.IConnectPacket} exconnect
 */
const exconnect = {
	cmd: 'connect',
	protocolId: 'MQTT', // Or 'MQIsdp' in MQTT 3.1 and 5.0
	protocolVersion: 4, // Or 3 in MQTT 3.1, or 5 in MQTT 5.0
	clean: true, // Can also be false
	clientId: 'my-device',
	keepalive: 0, // Seconds which can be any positive number, with 0 as the default setting
	username: 'matteo',
	password: Buffer.from('collina'), // Passwords are buffers
	will: {
		topic: 'mydevice/status',
		payload: Buffer.from('dead'), // Payloads are buffers
	}
}

/** @type {mqtt.IPublishPacket} */
const mqttPublish =  {
	cmd: 'publish',
	//	messageId: 42,    // not for qos==0
	qos: 0,
	dup: false,
	topic: 'test',
	payload: Buffer.from('dummy'),
	retain: false
}

/** @type {mqtt.ISubscribePacket} */
const mqttSubscribe =  {
	cmd: 'subscribe',
	messageId: 42,
	subscriptions: [{
	  topic: 'test',
	  qos: 0,
	}]
  }


function promiseTimeout(ms, promise) {
	let timeout = new Promise((resolve, reject) => {
		let id = setTimeout(() => {
			clearTimeout(id);
			reject('Timeout in ' + ms + 'ms.')
		}, ms)
	})
	return Promise.race([
		promise,
		timeout
	])
}


class Sis4wow {
	constructor() { }

	/** 
	 * 
	 * @param {string} topic
	 */
	subscribe(topic) {
		mqttSubscribe.messageId = this.messageId
		this.messageId++
		mqttSubscribe.subscriptions[0].topic = topic
		this.wsp.send(mqtt.generate(mqttPublish))
	}

	messageId=1

	/** 
	 * 
	 * @param {string} topic
	 * @param {string} payload
	 */
	publish(topic, payload) {
		mqttPublish.payload = Buffer.from(payload, 'utf8')
		mqttPublish.topic = topic
		this.wsp.send(mqtt.generate(mqttPublish))
	}

	// /**
	// * @type {Promise} connectPromise
	// */
	connectResolve = null

	/** callback, called from the mqtt decoder
	 * 
	 * @param {mqtt.Packet} m 
	 */
	mqttParserHandler(m) {
		console.debug('mqtt msg:', m.cmd)
		switch (m.cmd) {
			case "connack":
				this.connectResolve()
				break;
			case "publish":
				try {
					let o = JSON.parse(m.payload.toString())
					this.mqttPublishResolve(o)
					return
				} catch (error) {
					console.error(error)					
				}
			default:
				break;
		}
		this.mqttPublishReject('not publish')
	}

	//compilocated
	// this is a callback used by the mqtt decoder
	//
	// when it receives an MQTT publish
	// it needs to return the json payload
	//
	// otherwise, just an empty json payload: {}
	async unpacker(p) {
		console.debug('before parser.parse')
		let bytes = await p.arrayBuffer()
		// will trigger 1-N calls to mqttParserHandler()
		// hopefull just one with websockets
		// XXX needstimeout
		let p1 = new Promise((resolve, reject) => {
			this.mqttPublishResolve = resolve
			this.mqttPublishReject = reject
		})

		const mqttprom = promiseTimeout(200, p1)

		//this could cause multiple callbacks
		//if bytes contains multiple mqtt packets
		//but the promise only will trigger for first!
		//I suspect we only get one mqtt per websocket payload
		//
		const numBytesLeft = this.parser.parse(bytes)
		console.debug('after parser.parse')
		if (numBytesLeft > 0) {
			console.error('numBytesLeft>0 badbad', numBytesLeft)
		}

		let ret = {}
		try {
			ret = await mqttprom
		} catch (err) {
			console.error(err)
		}

		// XXX
		// we need to return the unpacked json payload object here
		return ret
	}
	async connect(url, user, pass) {
		// ws://exp.com

		this.wsp = new WebSocketAsPromised(url, {
			// "mqtt" (preferred) or "mqttv3.1" 
			createWebSocket: url => new WebSocket(url, ['mqtt']),
			packMessage: data => JSON.stringify(data),
			unpackMessage: data => this.unpacker(data),
			attachRequestId: (data, requestId) => Object.assign({ id: requestId }, data), // attach requestId to message as `id` field
			extractRequestId: data => data && data.id,                                  // read requestId from message `id` field
		});

		this.wsp.onMessage.addListener(data => console.log(778, data));

		//   wsp.open()
		//    .then(() => wsp.sendRequest({foo: 'bar'})) // actually sends {foo: 'bar', id: 'xxx'}, because `attachRequestId` defined above
		//    .then(response => console.log(response));  // waits server message wit

		exconnect.username = user
		exconnect.password = pass

		this.parser = mqtt.parser(exconnect); // create parser
		this.parser.on('packet', m => this.mqttParserHandler(m))



		const p1 = this.wsp.open()
		const p2 = promiseTimeout(5000, p1)
		try {
			await p2
		} catch (error) {
			throw error
		}

		this.wsp.send(mqtt.generate(exconnect))

		const p3 = new Promise((resolve, reject) => {
			this.connectResolve = resolve
		})
		return promiseTimeout(5000, p3)

		// .then(() => wsp.send('message'))
		// .then(() => wsp.close())
		// .catch(e => console.error(e))
	}
}


//@ts-ignore
window.Sis4wow = Sis4wow






