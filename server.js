const Express = require("express");
const app = new Express();
const server = app.listen(8080);
const io = require("socket.io")(server);

const Net = require("net");
const UDP = require("dgram");

app.use(Express.static(__dirname + "/public"));

// Sockets
io.on("connection", socket => {
	socket.on("test", callback => {
		callback("Connected to Server");
		console.log("New Client Connected");
	});

	socket.on("bridge", (address, callback) => {
		const message = address + " Connection Requested";
		callback(message);
		console.log(message);

		Controller.bridge(socket, address);
	});

	socket.on("break", callback => {
		const message = "Closure Requested";
		callback(message);
		console.log(message);

		Controller.close(socket);
	});

	socket.on("read", (command, callback) => {
		Controller.read(socket, command, callback);
	});

	socket.on("write", (command, value) => {
		Controller.write(socket, command, value);
	});
});
class Client{
	constructor(socket, address = ""){
		this.address = address;

		this.socket = socket;
		this.device = new Net.Socket();
		this.scanner = UDP.createSocket("udp4");
		this.scanning = false;
		this.active = false;

		this.dataBuffer = [];
		this.initManifest();

		this.device.on("data", buffer => {console.log(this.address + " Rx\t\t", buffer);
			for(let binary of buffer){
				this.dataBuffer.push(binary);
			}

			this.validate();
		});

		this.device.on("error", error => {
			if(error.code === "ECONNREFUSED"){
				this.log(this.address + " TCP Connection Refused");
			}
		});

		this.log(this.address + " TCP Socket Created");
	}

	initManifest(){
		this.manifest = {};
		this.addItem(new Item(-1, 4, "manifest"));
	}

	log(message){
		this.socket.emit("log", message);
		console.log(message);
	}

	findAddress(callback = () => {}){
		if(this.scanning){
			this.log("Already Searching for UDP Packets");
			return;
		}

		this.log("Searching for UDP Packets...");

		this.scanner.on("message", (data, info) => {
			this.address = info.address;
			this.log(this.address + " UDP Packet Found");

			this.scanner.close();
			this.scanning = false;

			callback();
		});

		this.scanning = true;
		this.scanner.bind(15000);
	}

	connect(){
		this.log(this.address + " Attempting TCP Connection");

		if(this.address === ""){
			this.findAddress(() => {this.connect();});
			return;
		}

		if(this.active){
			this.log(this.address + " TCP Already Active");
			this.socket.emit("ready", this.address);
			return;
		}

		this.device.connect({host:this.address, port:10112}, () => {
			this.log(this.address + " TCP Established, Requesting Manifest");

			this.active = true;
			this.readState("manifest");
		});
	}

	close(){
		if(this.scanning){
			this.scanner.close();
			this.scanning = false;
		}

		if(this.active){
			this.device.end(() => {
				this.log(this.address + " TCP Closed");
			});
			this.active = false;
		}
	}

	validate(){
		if(this.dataBuffer.length < 9){
			return;
		}

		const length = Buffer.from(this.dataBuffer.slice(4, 8)).readInt32LE() + 8;

		if(this.dataBuffer.length < length){
			return;
		}

		const id = Buffer.from(this.dataBuffer.slice(0, 4)).readInt32LE();
		const data = Buffer.from(this.dataBuffer.slice(8, length));

		this.dataBuffer.splice(0, length);

		this.processData(id, data);

		if(this.dataBuffer.length > 0){
			this.validate();
		}
	}

	processData(id, data){
		if(id === -1){
			this.initManifest();

			data = data.toString().split("\n");

			data.forEach(itemRaw => {
				itemRaw = itemRaw.split(",");
			
				let item = new Item(itemRaw[0], itemRaw[1], itemRaw[2]);

				this.addItem(item);
			});

			this.log(this.address + " Manifest Built, API Ready");
			this.socket.emit("ready", this.address);
		}
		else{
			const item = this.getItem(id);
			item.buffer = data;
			item.callback();
		}
	}

	initalBuffer(id, state){
		let buffer = Buffer.allocUnsafe(5);

		buffer.writeInt32LE(id);
		buffer[4] = state;

		return buffer;
	}

	readState(itemID, callback = () => {}){
		const item = this.getItem(itemID);

		if(item.type === -1){
			callback();
		}
		else{
			item.callbacks.push(callback);

			if(item.callbacks.length > 1){
				return;
			}
		}

		const buffer = this.initalBuffer(item.id, 0);

		this.device.write(buffer);
		console.log(this.address + " Tx " + item.id + "\t", buffer);
	}

	writeState(itemID){
		const item = this.getItem(itemID);
		let buffer = this.initalBuffer(item.id, 1);

		buffer = Buffer.concat([buffer, item.buffer]);

		this.device.write(buffer);
		console.log(this.address + " Tx " + item.id + "\t", buffer);
	}

	addItem(item){
		this.manifest[item.id] = item;
		this.manifest[item.name] = item;
		
		if(item.alias !== undefined){
			this.manifest[item.alias] = item;
		}
	}

	getItem(itemID){
		return this.manifest[itemID];
	}
}

class Item{
	static aliases = {
		"aircraft/0/name":"aircraft",

		"simulator/throttle":"throttle", // 1000 -1000
		"aircraft/0/systems/landing_gear/lever_state":"gear", // bool
		"aircraft/0/systems/spoilers/state":"spoilers", // 0, 1, 2
		"aircraft/0/systems/axes/elevator_trim":"trim", // 1% = 10
		"aircraft/0/systems/flaps/state":"flaps", // 0, 1, 2, ...
		"aircraft/0/systems/parking_brake/state":"parkingbrake", // bool

		"aircraft/0/indicated_airspeed":"airspeed",
		"aircraft/0/groundspeed":"groundspeed",
		"aircraft/0/altitude_msl":"altitude",
		"aircraft/0/altitude_agl":"altitudeAGL",
		"aircraft/0/heading_magnetic":"heading",
		"aircraft/0/vertical_speed":"verticalspeed",

		"aircraft/0/systems/autopilot/vnav/on":"vnavon",
		"aircraft/0/flightplan/full_info":"fplinfo",

		"aircraft/0/systems/autopilot/on":"autopilot",
		"aircraft/0/systems/autopilot/alt/on":"alton",
		"aircraft/0/systems/autopilot/vs/on":"vson",
		"aircraft/0/systems/autopilot/spd/on":"spdon",
		"aircraft/0/systems/autopilot/hdg/on":"hdgon",
        "aircraft/0/systems/autopilot/nav/on":"navon",

		"aircraft/0/systems/autopilot/alt/target":"alt",
		"aircraft/0/systems/autopilot/vs/target":"vs",
		"aircraft/0/systems/autopilot/spd/target":"spd",
		"aircraft/0/systems/autopilot/hdg/target":"hdg",

		"aircraft/0/systems/axes/pitch":"pitch",
		"aircraft/0/systems/axes/roll":"roll",
		"aircraft/0/systems/axes/yaw":"yaw",

		"aircraft/0/latitude":"latitude",
		"aircraft/0/longitude":"longitude",
		"aircraft/0/magnetic_variation":"variation",
		"environment/wind_velocity":"wind",
		"environment/wind_direction_true":"winddir",

		"aircraft/0/flightplan/route":"route",
		"aircraft/0/flightplan/coordinates":"coordinates",

		"aircraft/0/configuration/flaps/stops":"flapcount",
		"aircraft/0/systems/engines/0/n1":"n1",
		"aircraft/0/is_on_ground":"onground",
		"aircraft/0/is_on_runway":"onrunway",

		"aircraft/0/systems/auto_brakes/command_state":"autobrakes", // 0, 1, 2, 3
		"aircraft/0/systems/brakes/left/percentage":"leftbrake", // 0-1 (float)
		"aircraft/0/systems/brakes/right/percentage":"rightbrake", // 0-1 (float)

		"aircraft/0/systems/electrical_switch/master_switch/state":"master",
		"aircraft/0/systems/electrical_switch/nav_lights_switch/state":"navlights", // 0, 1
		"aircraft/0/systems/electrical_switch/strobe_lights_switch/state":"strobelights", // 0, 1
		"aircraft/0/systems/electrical_switch/landing_lights_switch/state":"landinglights", // 0, 1
		"aircraft/0/systems/electrical_switch/beacon_lights_switch/state":"beaconlights", // 0, 1
	};

	static conversions = {
		"airspeed":1.94384, // m/s to kts
		"groundspeed":1.94384, // m/s to kts
		"heading":180/Math.PI,
		"verticalspeed":196.8504, // m/s to fpm
		
		"throttle":-0.1, // 1000s to 100s
		"n1":100,

		"wind":1.94384,
		"winddir":180/Math.PI,
		"variation":180/Math.PI,

		"spd":1.94384, // m/s to kts
		"hdg":180/Math.PI, // rad to deg
		"alt":3.28084, // m to ft
		"vs":3.28084, // m/m to fpm
	};

	static readBufferType = [
		value => {return Boolean(value[0]);},
		value => {return value.readInt32LE();},
		value => {return value.readFloatLE();},
		value => {return value.readDoubleLE();},
		value => {return value.toString("utf8", 4);},
		value => {return value.readBigInt64LE();},
	];

	static writeBufferType = [
		value => {return Buffer.from([value]);},
		value => {let buffer = Buffer.allocUnsafe(4); buffer.writeInt32LE(value); return buffer;},
		value => {let buffer = Buffer.allocUnsafe(4); buffer.writeFloatLE(value); return buffer;},
		value => {let buffer = Buffer.allocUnsafe(8); buffer.writeDoubleLE(value); return buffer;},
		value => {let buffer = Buffer.allocUnsafe(4 + value.length); buffer.writeInt32LE(value.length); buffer.write(value, 4); return buffer;},
		value => {let buffer = Buffer.allocUnsafe(8); buffer.writeBigInt64LE(value); return buffer;},
	];

	constructor(id, type, name){
		this.id = parseInt(id);
		this.type = parseInt(type);
		this.name = name;
		this.alias = Item.aliases[this.name];
		this.value = undefined;
		this.conversion = Item.conversions[this.alias];
		this.callbacks = [];
	}

	get buffer(){
		let value = this.value;
		
		if(this.conversion !== undefined){
			value /= this.conversion;
		}

		return Item.writeBufferType[this.type](value);
	}

	set buffer(data){
		this.value = Item.readBufferType[this.type](data);

		if(this.conversion !== undefined){
			this.value *= this.conversion;
		}
	}

	callback(){
		this.callbacks.forEach(callback => {
			callback();
		});

		this.callbacks = [];
	}
}
class Controller{
	static clients = {};

	static bridge(socket, address){
		if(this.clients[socket.id] === undefined){
			this.clients[socket.id] = new Client(socket, address);
		}

		this.clients[socket.id].connect();
	}

	static close(socket){
		if(this.clients[socket.id] === undefined){return false;}

		this.clients[socket.id].close();
		delete this.clients[socket.id];

		return true;
	}

	static read(socket, command, callback){
		const client = this.clients[socket.id];

		if(client?.getItem(command) === undefined){
			callback(undefined);
			return;
		}

		client.readState(command, () => {
			const value = client.getItem(command).value;
			callback(value);
		});
	}

	static write(socket, command, value){
		const client = this.clients[socket.id];

		if(client?.getItem(command) === undefined){return;}

		client.getItem(command).value = value;
		client.writeState(command);
	}
}

console.log("Loading Complete, Server Ready");
console.log("\nOpen Browser to localhost:8080");