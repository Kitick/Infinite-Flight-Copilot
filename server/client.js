class Client {
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