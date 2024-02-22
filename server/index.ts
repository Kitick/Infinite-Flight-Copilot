const Express = require("express");
const app = new Express();
const server = app.listen(8080);
const io = require("socket.io")(server);

app.use(Express.static(__dirname + "/public"));

// Sockets
io.on("connection", (socket:any) => {
    socket.on("disconnect", () => {
        console.log("Client Disconnected");
        manager.remove(socket);
    });

	socket.on("bridge", (address:string) => {
        manager.log(socket, "Connection Requested");
		manager.bridge(socket, address);
	});

	socket.on("break", () => {
        manager.log(socket, "Closure Requested");
		manager.close(socket);
	});

	socket.on("read", (command:string, callback:(data:stateValue|undefined|null) => void) => {
		manager.read(socket, command, callback);
	});

	socket.on("write", (command:string, value:stateValue) => {
		manager.write(socket, command, value);
	});

    console.log("New Client Connected");
});

const manager = new ClientManager();

console.log("\nLoading Complete, Server Ready");
console.log("\nOpen Browser to localhost:8080\n");