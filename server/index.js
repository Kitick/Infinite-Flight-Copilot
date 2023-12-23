const Express = require("express");
const app = new Express();
const server = app.listen(8080);
const io = require("socket.io")(server);

app.use(Express.static(__dirname + "/public"));

// Sockets
io.on("connection", socket => {
	socket.on("test", callback => {
		callback("Connected to Server");
		console.log("New Client Connected");
	});

	socket.on("bridge", (address, callback) => {
		const message = address + " Connection Requested";
		callback(message);
		console.log(message);

		Controller.bridge(socket, address);
	});

	socket.on("break", callback => {
		const message = "Closure Requested";
		callback(message);
		console.log(message);

		Controller.close(socket);
	});

	socket.on("read", (command, callback) => {
		Controller.read(socket, command, callback);
	});

	socket.on("write", (command, value) => {
		Controller.write(socket, command, value);
	});
});

console.log("\nLoading Complete, Server Ready");
console.log("\nOpen Browser to localhost:8080\n");