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

    socket.emit("break", response => {
        address = "";

        statLog.innerText = response;
        console.log(response);
    });
}

function read(command, callback = () => {}){
    socket.emit("read", command, value => {
		callback(value);
	});
}

function write(command, value){
    socket.emit("write", command, value);
}

let statLog;
let address = "";
const socket = io.connect();

socket.on("ready", ip => {
    address = ip;
    document.getElementById("autopilot").hidden = false;
});

socket.on("log", response => {
    statLog.innerText = response;
    console.log(response);
});