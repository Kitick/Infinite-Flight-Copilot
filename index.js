const Express = require("express");
const app = new Express();
const server = app.listen(8080);
const io = require("socket.io")(server);

const Net = require("net");
const UDP = require("dgram");

app.use(Express.static("public"));
const dir = __dirname + "/public/";

// Pages
app.get("/", (request, response) => {
	response.sendFile(dir + "index.html");
});

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
		this.active = false;

		this.dataBuffer = [];
		this.initManifest();

		this.device.on("data", buffer => { console.log("Rx\t\t", buffer);
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
		this.log("Searching for UDP Packets...");

		const scan = UDP.createSocket("udp4");

		scan.on("error", error => {
			if(error.code === "EADDRINUSE"){
				this.log("Already Searching for UDP Packets");
			}
		});

		scan.on("message", (data, info) => {
			this.address = info.address;

			this.log(this.address + " UDP Packet Found");
			scan.close();

			callback();
		});

		scan.bind(15000);
	}

	connect(){
		if(this.address === ""){
			this.findAddress(() => {this.connect();});
			return;
		}

		if(this.active){
			this.log(this.address + " TCP Already Active");
			this.ready();
			return;
		}

		this.device.connect({host:this.address, port:10112}, () => {
			this.log(this.address + " TCP Established");

			this.active = true;
			this.readState("manifest");
		});
	}

	close(){
		this.device.end(() => {
			this.active = false;
			this.log(this.address + " TCP Closed");
		});
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
			this.ready();
		}
		else{
			const item = this.getItem(id);
			item.buffer = data;

			item.callback();
			item.callback = () => {};
		}
	}

	ready(){
		this.socket.emit("ready", this.address);
	}

	initalBuffer(id, state){
		let buffer = Buffer.allocUnsafe(5);

		buffer.writeInt32LE(id);
		buffer[4] = state;

		return buffer;
	}

	readState(itemID, callback = () => {}){
		const item = this.getItem(itemID);
		item.callback = callback;

		let buffer = this.initalBuffer(item.id, 0);

		this.device.write(buffer);
		console.log("Tx " + item.id + "\t\t", buffer);
	}

	writeState(itemID){
		const item = this.getItem(itemID);
		let buffer = this.initalBuffer(item.id, 1);

		buffer = Buffer.concat([buffer, item.buffer]);

		this.device.write(buffer);
		console.log("Tx " + item.id + "\t\t", buffer);
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
	static alias = {
		"aircraft/0/systems/axes/elevator_trim":"trim", // 1% = 10
		"aircraft/0/systems/spoilers/state":"spoilers", // 0, 1, 2
		"aircraft/0/systems/auto_brakes/command_state":"autobrakes", // 0, 1, 2, 3
		"aircraft/0/systems/parking_brake/state":"parkingbrake", // bool
		"simulator/throttle":"throttle", // 1000 -1000
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
		this.alias = Item.alias[this.name];
		this.value = undefined;
		this.callback = () => {};
	}

	get buffer(){
		return Item.writeBufferType[this.type](this.value);
	}

	set buffer(data){
		this.value = Item.readBufferType[this.type](data);
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
		if(this.clients[socket.id] === undefined){
			return false;
		}

		this.clients[socket.id].close();
		delete this.clients[socket.id];

		return true;
	}

	static read(socket, command, callback){
		const client = this.clients[socket.id];

		if(client.getItem(command) === undefined){
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

		if(client.getItem(command) === undefined){
			return;
		}

		client.getItem(command).value = value;
		client.writeState(command);
	}
}

console.log("Loading Complete, Server Ready");