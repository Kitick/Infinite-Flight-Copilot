const Express = require("express");
const app = new Express();
const server = app.listen(8080);
const io = require("socket.io")(server);

app.use(Express.static(__dirname + "/public"));

// Sockets
io.on("connection", socket => {
    socket.on("disconnect", () => {
        console.log("Client Disconnected");
        Controller.remove(socket);
    });

	socket.on("bridge", (address) => {
        Controller.log(socket, "Connection Requested");
		Controller.bridge(socket, address);
	});

	socket.on("break", () => {
        Controller.log(socket, "Closure Requested");
		Controller.close(socket);
	});

	socket.on("read", (command, callback) => {
		Controller.read(socket, command, callback);
	});

	socket.on("write", (command, value) => {
		Controller.write(socket, command, value);
	});

    console.log("New Client Connected");
});

console.log("\nLoading Complete, Server Ready");
console.log("\nOpen Browser to localhost:8080\n");