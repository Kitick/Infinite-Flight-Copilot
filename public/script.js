"use strict";

function loaded(){
	statLog = document.getElementById("status");

	autofunctions.forEach(autof => {
		autof.button = document.getElementById(autof.button);
	});

	// Tests Socket
	socket.emit("test", response => {
		statLog.innerText = response;
		console.log(response);
	});
}

function bridge(){
    document.getElementById("autopilot").hidden = true;

	let address = document.getElementById("address").value;
	const parts = address.split(".");

	if(address !== ""){
		if(parts.length < 2){
			address = "1." + address;
		}
		if(parts.length < 3){
			address = "168." + address;
		}
		if(parts.length < 4){
			address = "192." + address;
		}
	}

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

function reset(){
	document.getElementById("autopilot").hidden = true;

	autofunctions.forEach(autof => {
		autof.changeActive(false);
	});
}

let statLog;
const socket = io();

socket.on("ready", () => {
    document.getElementById("autopilot").hidden = false;
});

socket.on("log", response => {
    statLog.innerText = response;
    console.log(response);
});