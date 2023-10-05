"use strict";

window.onload = () => {
	statLog = document.getElementById("status");
	panels = document.getElementsByClassName("panel");

    autofunction.loadButtonHTML();

	const select = document.getElementById("voices");
	const voices = speechSynthesis.getVoices();
	for(let i = 0, length = voices.length; i < length; i++) {
		const newOption = new Option(voices[i].lang, i);
		select.add(newOption)
	}

	socket.emit("test", response => {
		statLog.innerText = response;
		console.log(response);
	});
}

function bridge(){
    setVisibility(true);

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

function readLog(command){
    read(command, value => {console.log(value);});
}

function write(command, value){
    socket.emit("write", command, value);
}

function setVisibility(hidden){
	for(let i = 1, length =  panels.length; i < length; i++){
		panels[i].hidden = hidden;
	}
}

function reset(){
	setVisibility(true);

    autofunctions.forEach(autofunc => {
		if(autofunc.active){
            autofunc.active = false;
        }
	});
}

let statLog;
let panels;

const socket = io();

socket.on("ready", address => {
	document.getElementById("address").value = address;
    setVisibility(false);
});

socket.on("log", response => {
    statLog.innerText = response;
    console.log(response);
});
