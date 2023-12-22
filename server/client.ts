const Net = require("net");
const UDP = require("dgram");

class Client {
    device = new Net.Socket();
    scanner = UDP.createSocket("udp4");
    scanning = false;
    active = false;
    dataBuffer:number[] = [];
    manifest = new Map<string, Item>();

	constructor(public socket:any, public address = ""){
		this.initManifest();

		this.device.on("data", (buffer:Buffer) => {
            console.log(this.address + " Rx\t\t", buffer);

			for(let binary of buffer){
				this.dataBuffer.push(binary);
			}

			this.validate();
		});

		this.device.on("error", (error:any) => {
			if(error.code === "ECONNREFUSED"){
				this.log(this.address + " TCP Connection Refused");
			}
		});

		this.log(this.address + " TCP Socket Created");
	}

	initManifest():void {
		this.manifest = new Map();
		this.addItem(new Item(-1, 4, "manifest"));
	}

	log(message:string):void {
		this.socket.emit("log", message);
		console.log(message);
	}

	findAddress(callback = () => {}):void {
		if(this.scanning){
			this.log("Already Searching for UDP Packets");
			return;
		}

		this.log("Searching for UDP Packets...");

		this.scanner.on("message", (data:any, info:any) => {
			this.address = info.address;
			this.log(this.address + " UDP Packet Found");

			this.scanner.close();
			this.scanning = false;

			callback();
		});

		this.scanning = true;
		this.scanner.bind(15000);
	}

	connect():void {
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

	close():void {
		if(this.scanning){
			this.scanner.close();
			this.scanning = false;
		}

		if(this.active){
            this.active = false;

			this.device.end(() => {
				this.log(this.address + " TCP Closed");
			});
		}
	}

	validate():void {
		if(this.dataBuffer.length < 9){return;}

		const length = Buffer.from(this.dataBuffer.slice(4, 8)).readInt32LE() + 8;

		if(this.dataBuffer.length < length){return;}

		const id = Buffer.from(this.dataBuffer.slice(0, 4)).readInt32LE();
		const data = Buffer.from(this.dataBuffer.slice(8, length));

		this.dataBuffer.splice(0, length);

		this.processData(id, data);

		if(this.dataBuffer.length > 0){this.validate();}
	}

	processData(id:number, data:Buffer):void {
		if(id === -1){
			this.initManifest();

			const stringData = data.toString().split("\n");

			stringData.forEach(raw => {
				const itemRaw = raw.split(",");

                const id = parseInt(itemRaw[0]);
                const type = parseInt(itemRaw[1]);
                const name = itemRaw[2];

				const item = new Item(id, type, name);

				this.addItem(item);
			});

			this.log(this.address + " Manifest Built, API Ready");
			this.socket.emit("ready", this.address);

            return;
		}

        const item = this.getItem(id.toString());
        item.buffer = data;
        item.callback();
	}

	initalBuffer(id:number, state:number):Buffer {
		let buffer = Buffer.allocUnsafe(5);

		buffer.writeInt32LE(id);
		buffer[4] = state;

		return buffer;
	}

	readState(itemID:string, callback = () => {}):void {
		const item = this.getItem(itemID);

		if(item.type === -1){
			callback();
		}
		else{
			item.callbacks.push(callback);
			if(item.callbacks.length > 1){return;}
		}

		const buffer = this.initalBuffer(item.id, 0);

		this.device.write(buffer);
		console.log(this.address + " Tx " + item.id + "\t", buffer);
	}

	writeState(itemID:string):void {
		const item = this.getItem(itemID);
		let buffer = this.initalBuffer(item.id, 1);

		buffer = Buffer.concat([buffer, item.buffer]);

		this.device.write(buffer);
		console.log(this.address + " Tx " + item.id + "\t", buffer);
	}

	addItem(item:Item):void {
        this.manifest.set(item.id.toString(), item);
		this.manifest.set(item.name, item);

		if(item.alias !== undefined){
            this.manifest.set(item.alias, item);
        }
	}

	getItem(itemID:string):Item {
        const item = this.manifest.get(itemID);
        if(item === undefined){throw "item is not defined.";}
		return item;
	}
}