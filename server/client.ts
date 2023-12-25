const Net = require("net");
const UDP = require("dgram");

class Client {
    #socket:any;
    #address:string = "";
    #device = new Net.Socket();
    #scanner:any|null = null;
    #scannerTimeout:NodeJS.Timeout|null = null;
    #active = false;
    #dataBuffer:number[] = [];
    #manifest = new Map<string, Item>();

	constructor(socket:any, address = ""){
        this.#socket = socket;
        this.#address = address;

		this.#initManifest();

		this.#device.on("data", (buffer:Buffer) => {
            console.log(this.#address + " Rx\t\t\t", buffer);

			for(let binary of buffer){this.#dataBuffer.push(binary);}

			this.#validate();
		});

		this.#device.on("error", (error:any) => {
			if(error.code === "ECONNREFUSED"){
				this.log(this.#address + " TCP Connection Refused");
			}
		});

		this.log(this.#address + " TCP Socket Created");
	}

    get #scanning(){return this.#scanner !== null;}

	#initManifest():void {
		this.#manifest = new Map();
		this.addItem(new Item(-1, 4, "manifest"));
	}

    #closeScanner(){
        if(!this.#scanning){return;}

        clearTimeout(this.#scannerTimeout as NodeJS.Timeout);
        this.#scannerTimeout = null;

        this.#scanner.close();
        this.#scanner = null;
    }

	#findAddress():void {
		if(this.#scanning){
			this.log("Already Searching for UDP Packets");
			return;
		}

		this.log("Searching for UDP Packets...");

        this.#scanner = UDP.createSocket("udp4");

        this.#scanner.on("message", (data:any, info:any) => {
			this.#address = info.address;
			this.log(this.#address + " UDP Packet Found");

			this.#closeScanner();
            this.connect();
		});

		this.#scanner.bind(15000);

        this.#scannerTimeout = setTimeout(() => {
            this.#closeScanner();
            this.log("UDP Search Timed out");
        }, 10000);
	}

	#validate():void {
		if(this.#dataBuffer.length < 9){return;}

		const length = Buffer.from(this.#dataBuffer.slice(4, 8)).readInt32LE() + 8;

		if(this.#dataBuffer.length < length){return;}

		const id = Buffer.from(this.#dataBuffer.slice(0, 4)).readInt32LE();
		const data = Buffer.from(this.#dataBuffer.slice(8, length));

		this.#dataBuffer.splice(0, length);

		this.#processData(id, data);

		if(this.#dataBuffer.length > 0){this.#validate();}
	}

	#processData(id:number, data:Buffer):void {
		if(id === -1){
			this.#initManifest();

			const stringData = data.toString().split("\n");

			stringData.forEach(raw => {
				const itemRaw = raw.split(",");

                const id = parseInt(itemRaw[0]);
                const type = parseInt(itemRaw[1]) as bufferType;
                const name = itemRaw[2];

				const item = new Item(id, type, name);

				this.addItem(item);
			});

			this.log(this.#address + " Manifest Built, API Ready");
			this.#socket.emit("ready", this.#address);

            return;
		}

        const item = this.getItem(id.toString());
        if(item === undefined){return;}

        item.buffer = data;
        item.callback();
	}

	#initalBuffer(id:number, state:number):Buffer {
		let buffer = Buffer.allocUnsafe(5);

		buffer.writeInt32LE(id);
		buffer[4] = state;

		return buffer;
	}

    log(message:string):void {
		this.#socket.emit("log", message);
		console.log(message);
	}

    connect():void {
		this.log(this.#address + " Attempting TCP Connection");

		if(this.#address === ""){
			this.#findAddress();
			return;
		}

		if(this.#active){
			this.log(this.#address + " TCP Already Active");
			this.#socket.emit("ready", this.#address);
			return;
		}

		this.#device.connect({host:this.#address, port:10112}, () => {
			this.log(this.#address + " TCP Established, Requesting Manifest");

			this.#active = true;
			this.readState("manifest");
		});
	}

	close():void {
		if(this.#scanning){this.#closeScanner();}

		if(this.#active){
            this.#active = false;

			this.#device.end(() => {
				this.log(this.#address + " TCP Closed");
			});
		}
	}

	readState(itemID:string, callback = () => {}):void {
		const item = this.getItem(itemID);

		if(item === undefined || item.type === -1){
			callback();
            return;
		}

        const length = item.addCallback(callback);
        if(length > 1){return;}

		const buffer = this.#initalBuffer(item.id, 0);

		this.#device.write(buffer);
		console.log(this.#address + " Tx " + itemID + " (" + item.id + ")\t", buffer);
	}

	writeState(itemID:string):void {
		const item = this.getItem(itemID);
        if(item === undefined){return;}

		let buffer = this.#initalBuffer(item.id, 1);

		buffer = Buffer.concat([buffer, item.buffer]);

		this.#device.write(buffer);
		console.log(this.#address + " Tx " + itemID + " (" + item.id + ")\t", buffer);
	}

	addItem(item:Item):void {
        this.#manifest.set(item.id.toString(), item);
		this.#manifest.set(item.name, item);

		if(item.alias !== null){
            this.#manifest.set(item.alias, item);
        }
	}

    getItem(itemID:string):Item|undefined {
        const item = this.#manifest.get(itemID);
        if(item === undefined){this.log(this.#address + " Invalid Item " + itemID);}
        return item;
    }
}