class Controller {
	static clients = {};

	static bridge(socket, address){
		if(this.clients[socket.id] === undefined){
			this.clients[socket.id] = new Client(socket, address);
		}

		this.clients[socket.id].connect();
	}

	static close(socket){
		if(this.clients[socket.id] === undefined){return false;}

		this.clients[socket.id].close();
		delete this.clients[socket.id];

		return true;
	}

	static read(socket, command, callback){
		const client = this.clients[socket.id];

		if(client?.getItem(command) === undefined){
			callback(undefined);
			return;
		}

		client.readState(command, () => {
			const value = client.getItem(command).value;
			callback(value);
		});
	}

	static write(socket, command, value){
		const client = this.clients[socket.id];

		if(client?.getItem(command) === undefined){return;}

		client.getItem(command).value = value;
		client.writeState(command);
	}
}