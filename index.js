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
        console.log(address + " TCP Connection Requested");

        if(address === ""){
            callback("Searching for UDP Packets");
        }
        else{
            callback("Attempting TCP Connection on " + address);
        }

        new TCP(address, socket.id);
    });

    socket.on("break", (address, callback) => {
        const client = TCP.connections[address];

        if(client !== undefined){
            client.close();

            callback("TCP Connection Closed for " + address);
        }
    });

    socket.on("set", (address, command, value) => {
        const client = TCP.connections[address];

        if(client !== undefined){
            client.setState(client.manifest[command].id, value);
        }
    });

    socket.on("get", (address, command) => {
        const client = TCP.connections[address];

        if(client !== undefined){
            client.getState(client.manifest[command].id);
        }
    });
});

class TCP{
    static connections = {};

    // Functions to convert any of the possible 6 values into the raw binary buffer or vice versa
    static readType = [
        value => {return Boolean(value[0]);},
        value => {return value.readInt32LE();},
        value => {return value.readFloatLE();},
        value => {return value.readDoubleLE();},
        value => {return value.toString("utf8", 4);},
        value => {return value.readBigInt64LE();},
    ];

    static writeType = [
        value => {return Buffer.from([value]);},
        value => {let buffer = Buffer.allocUnsafe(4); buffer.writeInt32LE(value); return buffer;},
        value => {let buffer = Buffer.allocUnsafe(4); buffer.writeFloatLE(value); return buffer;},
        value => {let buffer = Buffer.allocUnsafe(8); buffer.writeDoubleLE(value); return buffer;},
        value => {let buffer = Buffer.allocUnsafe(4 + value.length); buffer.writeInt32LE(value.length); buffer.write(value, 4); return buffer;},
        value => {let buffer = Buffer.allocUnsafe(8); buffer.writeBigInt64LE(value); return buffer;},
    ];

    // If no IP was specified on connect, try to find it from the UDP broadcast packets
    static findIP(socket = undefined){
        console.log("Searching for UDP Packets...");

        const client = UDP.createSocket("udp4");

        client.on("error", error => {
            if(error.code === "EADDRINUSE"){
                io.to(this.socket).emit("log", "Already Searching for UDP Packets");
            }
        });

        client.on("message", (data, info) => {
            const address = info.address;

            console.log(address + " UDP Packet Found");

            client.close();

            new TCP(address, socket);
        });

        client.bind(15000);
    }

    // create a new cliet object, this is unique to the device, allowing multiple devices to be used with the same server.
    constructor(ip, socket = undefined){
        const currentTCP = TCP.connections[ip];
        
        if(ip === ""){
            TCP.findIP(socket);
            return;
        }
        else if(currentTCP !== undefined){
            currentTCP.socket = socket;

            io.to(socket).emit("ready", ip);
            console.log(ip + " TCP Client Returned");

            return currentTCP;
        }

        this.aircraft = new Aircraft(this);
        this.socket = socket;

        this.dataBuffer = [];
        this.manifest = {};

        this.ip = ip;
        this.client = new Net.Socket();

        this.client.on("data", buffer => {
            //console.log("Rx\t\t", buffer);

            for(let number of buffer){
                this.dataBuffer.push(number);
            }
    
            this.validate();
        });

        this.client.on("error", error => {
            if(error.code === "ECONNREFUSED"){
                io.to(this.socket).emit("log", "TCP Request Refused for " + this.ip);
                console.log(this.ip + " TCP Connection Refused");
                this.close();
            }
        });

        TCP.connections[ip] = this;

        console.log(this.ip + " TCP Client Created");

        this.connect();
    }

    // connect the client object to the phyiscal device
    connect(){
        if(this.client.address().address !== undefined){
            io.to(this.socket).emit("ready", this.ip);
            console.log(this.ip + " TCP Connection Re-Established");

            return;
        }

        this.client.connect({host:this.ip, port:10112}, () => {
            console.log(this.ip + " TCP Connection Established");
            console.log("Retrieving Manifest...");
    
            this.getState(-1);
        });
    }

    // close connection and delete the TCP client
    close(){
        this.client.end(() => {
            console.log(this.ip + " TCP Connection Closed");
        });

        TCP.connections[this.ip].aircraft.stop();

        delete TCP.connections[this.ip];
    }

    // validate incomming data packets to usable data and then process
    validate(){
        if(this.dataBuffer.length < 9){
            //console.log("IO", dataBuffer.length);
            return;
        }

        let length = Buffer.from(this.dataBuffer.slice(4, 8)).readInt32LE() + 8;
    
        if(this.dataBuffer.length < length){
            //console.log("ID", dataBuffer.length, length);
            return;
        }
    
        let id = Buffer.from(this.dataBuffer.slice(0, 4)).readInt32LE();
        let data = Buffer.from(this.dataBuffer.slice(8, length));
    
        this.dataBuffer.splice(0, length);
    
        this.processData(id, data);
    
        if(this.dataBuffer.length > 0){
            this.validate();
        }
    }

    // Process the validated packet into the usable data and store value in the manifest database
    processData(id, data){
        if(id === -1){
            data = data.toString().split("\n");

            data.forEach(item => {
                item = item.split(",");
                
                let itemData = {
                    id:item[0],
                    type:item[1],
                    name:item[2],
                    value:undefined,
                };

                this.manifest[itemData.id] = itemData;
                this.manifest[itemData.name] = itemData;
            });

            this.aircraft.start();

            io.to(this.socket).emit("ready", this.ip);
            console.log("Manifest Built");
        }
        else{
            const item = this.manifest[id];
            item.value = TCP.readType[item.type](data);
        }
    }

    // request a state from the API
    getState(id){
        let buffer = Buffer.allocUnsafe(5);

        buffer.writeInt32LE(id);
        buffer[4] = 0;

        this.client.write(buffer, () => {
            //console.log("Tx " + id + "\t\t", buffer);
        });
    }

    // Set a state in the API
    setState(id, value){
        this.value = value;

        let buffer = Buffer.allocUnsafe(5);

        buffer.writeInt32LE(id);
        buffer[4] = 1;

        const type = this.manifest[id].type;
        let valueBuffer = TCP.writeType[type](value);

        buffer = Buffer.concat([buffer, valueBuffer]);

        this.client.write(buffer, () => {
            //console.log("Tx " + id + " " + value + "\t", buffer);
        });
    }

    // return current value, then update it for next tick
    getValue(id){
        this.getState(id);
        return this.manifest[id].value;
    }
}

class PID{
    static ups = 0;

    constructor(source, control, min, max, mod = 1, step = undefined){
        this.active = false;
        
        this.source = source;
        this.control = control;
        this.min = min;
        this.max = max;
        this.mod = mod;
        this.step = step === undefined ? (this.max - this.min) / 10 : step;

        this.output = 0;
        this.delta = 0;
        this._value = 0;
        this.target = 0;
    }

    set value(num){
        num *= this.mod;

        this.delta = (num - this.value) * PID.ups;
        this._value = num;
    }

    get value(){return this._value;}

    run(){
        let diff = this.target - this.value;
        let deltaDiff = diff - this.delta * 4;

        let step = this.step;
        if(Math.abs(diff) < 1){
            if(Math.abs(this.delta) < 0.1){
                if(Math.abs(diff) < 0.1 && Math.abs(this.delta) < 0.05){
                    step = 0;
                }
                else{
                    step /= 10;
                }
            }
            else{
                step /= 5;
            }
        }

        let newOutput = Math.sign(deltaDiff) * step / PID.ups;

        if(isNaN(newOutput)){
            return;
        }

        this.output += newOutput;

        if(this.output > this.max){
            this.output = this.max;
        }
        else if(this.output < this.min){
            this.output = this.min;
        }

        return this.output;
    }
}

class Aircraft{
    constructor(client){
        this.client = client;
        this.interval;

        // axes/0|1|2|3/ = pitch|roll|yaw|throttle
        this.spd = new PID("aircraft/0/indicated_airspeed", "simulator/throttle", -1000, 1000, 1.94384);
        this.spd.target = 220;
        this.spd.active = true;

        this.roll = new PID("aircraft/0/systems/axes/roll", "api_joystick/axes/1/value", -1, 1, 1);
        this.roll.target = 0;
        this.roll.active = true;
    }

    update(){
        let pid = "roll";

        if(this[pid].active){
            let getID = this.client.manifest[this[pid].source].id;
            let setID = this.client.manifest[this[pid].control].id;

            this[pid].value = this.client.getValue(getID);
            let output = this[pid].run();

            console.log(this[pid].value, this[pid].delta, this[pid].output)
            //this.client.setState(setID, output);
        }
    }

    start(ups = 10){
        this.stop();
        PID.ups = ups;
        this.interval = setInterval(() => {this.update();}, 1000 / ups);
    }

    stop(){clearInterval(this.interval);}
}

console.log("Loading Complete, Server Ready");