const socket = io();

socket.on("connected", (response) => {
    log(response);
});

socket.on("disconnect", () => {
    setHidden(true);
    log("Server Disconnected\n\nPlease Restart Server");
});

socket.on("ready", (address) => {
    document.getElementById("address").value = address;
    setHidden(false);
});

socket.on("log", (response) => {
    log(response);
});