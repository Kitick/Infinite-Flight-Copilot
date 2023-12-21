class Controller {
	static clients = {};

	static bridge(socket, address){
        let client = this.clients.get(socket.id);

		if(client === undefined){
			client = new Client(socket, address);
            this.clients.set(socket.id, client);
		}

		client.connect();
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