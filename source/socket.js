const socket = io();

socket.on("connect", () => {
    log("Connected to Server");
});

socket.on("disconnect", () => {
    setHidden(true);
    log("Server Disconnected\n\nPlease Restart Server");
});

socket.on("connect_error", () => {
    console.clear();
});

socket.on("ready", (address) => {
    document.getElementById("address").value = address;
    setHidden(false);
});

socket.on("log", (response) => {
    log(response);
});