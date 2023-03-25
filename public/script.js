function loaded(){
	statLog = document.getElementById("status");

	// Tests Socket
	socket.emit("test", response => {
		statLog.innerText = response;
		console.log(response);
	});
}

function bridge(){
    document.getElementById("autopilot").hidden = true;
    let address = document.getElementById("address").value;

    socket.emit("bridge", address, response => {
        statLog.innerText = response;
        console.log(response);
    });
}

function closeBridge(){
	reset();

    socket.emit("break", response => {
        statLog.innerText = response;
        console.log(response);
    });
}

function reset(){
	document.getElementById("autopilot").hidden = true;
	clearInterval(updateInterval);

	autotrim.active = false;
	update();
}

function read(command, callback = () => {}){
    socket.emit("read", command, value => {
		callback(value);
	});
}

function readAsync(command, callback = () => {}){
    socket.emit("readAsync", command, value => {
		callback(value);
	});
}

function write(command, value){
    socket.emit("write", command, value);
}

let statLog;
let updateInterval;
const socket = io.connect();

socket.on("ready", ip => {
    document.getElementById("autopilot").hidden = false;
	updateInterval = setInterval(() => {update();}, 100);
});

socket.on("log", response => {
    statLog.innerText = response;
    console.log(response);
});