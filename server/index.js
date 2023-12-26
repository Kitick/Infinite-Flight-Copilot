const Express = require("express");
const app = new Express();
const server = app.listen(8080);
const io = require("socket.io")(server);

app.use(Express.static(__dirname + "/public"));

// Sockets
io.on("connection", socket => {
    socket.on("disconnect", () => {
        console.log("Client Disconnected");
        manager.remove(socket);
    });

	socket.on("bridge", (address) => {
        manager.log(socket, "Connection Requested");
		manager.bridge(socket, address);
	});

	socket.on("break", () => {
        manager.log(socket, "Closure Requested");
		manager.close(socket);
	});

	socket.on("read", (command, callback) => {
		manager.read(socket, command, callback);
	});

	socket.on("write", (command, value) => {
		manager.write(socket, command, value);
	});

    console.log("New Client Connected");
});

const manager = new ClientManager();

console.log("\nLoading Complete, Server Ready");
console.log("\nOpen Browser to localhost:8080\n");