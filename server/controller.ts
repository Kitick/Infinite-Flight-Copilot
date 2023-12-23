class Controller {
	static clients = new Map<string, Client>();

	static bridge(socket:any, address:string):void {
        let client = this.clients.get(socket.id);

		if(client === undefined){
			client = new Client(socket, address);
            this.clients.set(socket.id, client);
		}

		client.connect();
	}

	static close(socket:any):boolean {
        const client = this.clients.get(socket.id);
		if(client === undefined){return false;}

		client.close();
		this.clients.delete(socket.id);

		return true;
	}

	static read(socket:any, command:string, callback = (data:stateValue|null) => {}){
		const client = this.clients.get(socket.id);
        const item = client?.getItem(command);

		if(item === undefined || client === undefined){
			callback(null);
            console.log(command + " is not defined");
			return;
		}

		client.readState(command, () => {
			const value = item.value;
			callback(value);
		});
	}

	static write(socket:any, command:string, value:stateValue){
		const client = this.clients.get(socket.id);
        const item = client?.getItem(command);

		if(item === undefined || client === undefined){
            console.log(command + " is not defined");
            return;
        }

		item.value = value;
		client.writeState(command);
	}
}