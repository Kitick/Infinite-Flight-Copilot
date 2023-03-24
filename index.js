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
		console.log(address + " Connection Requested");

		Controller.bridge(address);

		callback();
	});

	socket.on("break", (address, callback) => {
		console.log(address + " Closure Requested");

		Controller.close(address);

		callback();
	});
});
class Client{
	constructor(address = ""){
		this.address = address;
		this.socket = new Net.Socket();

		this.manifest = {};
		this.dataBuffer = [];

		this.socket.on("data", buffer => {
			for(let binary of buffer){
				this.dataBuffer.push(binary);
			}
			//console.log("Rx\t\t", buffer);

			this.validate();
		});

		this.socket.on("error", error => {
			if(error.code === "ECONNREFUSED"){
				console.log(this.address + " TCP Connection Refused");
			}
		});

		console.log(this.address + " TCP Socket Created");
	}

	findAddress(callback = () => {}){
		console.log("Searching for UDP Packets...");

		const scan = UDP.createSocket("udp4");

		scan.on("error", error => {
			if(error.code === "EADDRINUSE"){
				console.log("Already Searching for UDP Packets");
			}
		});

		scan.on("message", (data, info) => {
			this.address = info.address;

			console.log(this.address + " UDP Packet Found");
			scan.close();

			callback();
		});

		scan.bind(15000);
	}

	connect(address, callback = () => {}){
		if(this.address === ""){
			console.log("No address specified");
			this.findAddress(() => {this.connect("", callback);});
			return;
		}

		this.address = address;

		if(this.socket.address() !== undefined){
			console.log(this.address + " TCP Already Active");
			return;
		}

		this.socket.connect({host:this.address, port:10112}, () => {
			console.log(this.address + " TCP Established");
			callback();
		});
	}

	close(callback = () => {}){
		this.socket.end(() => {
			console.log(this.address + " TCP Closed");
			callback();
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
			data = data.toString().split("\n");

			data.forEach(itemRaw => {
				itemRaw = itemRaw.split(",");
			
				let item = new Item(itemRaw[0], itemRaw[1], itemRaw[2]);

				this.addItem(item);
			});

			console.log("Manifest Built");
		}
		else{
			this.getItem(id).buffer = data;
		}
	}

	initalBuffer(id, state){
		let buffer = Buffer.allocUnsafe(5);

		buffer.writeInt32LE(id);
		buffer[4] = state;

		return buffer;
	}

	readState(id){
		let buffer = this.initalBuffer(id, 0);

		this.socket.write(buffer);
	}
	// console.log("Tx " + id + "\t\t", buffer);
	writeState(id){
		let buffer = this.initalBuffer(id, 1);
		const itemBuffer = this.getItem(id).buffer;

		buffer = Buffer.concat(buffer, itemBuffer);

		this.socket.write(buffer);
	}

	addItem(item){
		this.manifest[item.id] = item;
		this.manifest[item.name] = item;
	}

	getItem(id){
		return this.manifest[id];
	}
}

class Item{
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
		this.id = id;
		this.type = type;
		this.name = name;
		this.value = undefined;
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

	static bridge(address){
		let client = this.clients[address];

		if(client === undefined){
			this.clients[address] = new Client(address);
		}

		client.connect();
	}

	static close(address){
		this.clients[address].close();
		delete this.clients[address];
	}
}

console.log("Loading Complete, Server Ready");