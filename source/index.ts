function bridge():void {
    let address = (document.getElementById("address") as HTMLInputElement).value;
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

    socket.volatile.emit("bridge", address);
}

function closeBridge():void {
    reset();
    socket.volatile.emit("break");
}

function read(command:string, callback = (value:stateValue) => {}):void {
    socket.emit("read", command, (value:stateValue) => {
        callback(value);
    });
}

function readAsync(command:string, callback = (value:stateValue) => {}):void {
    socket.emit("readAsync", command, (value:stateValue) => {
        callback(value);
    });
}

function readLog(command:string):void {
    read(command, (value:stateValue) => { console.log(value); });
}

function write(command:string, value:stateValue){
    socket.emit("write", command, value);
}

function setHidden(hidden:boolean):void {
    for(let i = 1, length = panels.length; i < length; i++){
        const panel = panels[i] as HTMLDivElement;
        panel.hidden = hidden;
    }
}

function reset():void {
    setHidden(true);

    autofunctions.forEach(autofunc => {
        autofunc.setActive(false);
    });

    storage.load(ProfileStorage.defaultName);
}

function log(message:string){
    statLog.innerText = message;
    console.log(message);
}

const statLog = document.getElementById("status") as HTMLSpanElement;
const panels = document.getElementsByClassName("panel") as HTMLCollectionOf<HTMLDivElement>;

const storage = new ProfileStorage(document.getElementById("configselect") as HTMLSelectElement);

const select = document.getElementById("voices") as HTMLSelectElement;
const voices = speechSynthesis.getVoices();
for(let i = 0, length = voices.length; i < length; i++){
    const newOption = new Option(voices[i].lang, i.toString());
    select.add(newOption);
}

const socket = io();

socket.on("connect", () => {
    log("Connected to Server");
});

socket.on("disconnect", () => {
    reset();
    log("Server Disconnected\n\nPlease Restart Server");
});

socket.on("connect_error", () => {
    console.clear();
});

socket.on("ready", (address:string) => {
    (document.getElementById("address") as HTMLInputElement).value = address;
    setHidden(false);
});

socket.on("log", (response:string) => {
    log(response);
});