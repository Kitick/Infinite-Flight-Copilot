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
    let trialAddress = document.getElementById("address").value;

    socket.emit("bridge", trialAddress, response => {
        statLog.innerText = response;
        console.log(response);
    });
}

function closeBridge(){
    document.getElementById("autopilot").hidden = true;

    socket.emit("break", address, response => {
		document.getElementById("address").value = address;
        address = "";
        statLog.innerText = response;
        console.log(response);
    });
}

function send(command, value){
    socket.emit("set", address, command, value);
}

function request(command){
    socket.emit("get", address, command);
}

let statLog;
let address = "";
const socket = io.connect();

socket.on("ready", ip => {
    address = ip;

    const text = "TCP Connection Established for " + address;
    statLog.innerText = text;
    console.log(text);

    document.getElementById("autopilot").hidden = false;
});

socket.on("log", response => {
    statLog.innerText = response;
    console.log(response);
});