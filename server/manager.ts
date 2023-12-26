class ClientManager {
	#clients = new Map<string, Client>();

    constructor(){}

	bridge(socket:any, address:string):void {
        let client = this.#clients.get(socket.id);

		if(client === undefined){
			client = new Client(socket);
            this.#clients.set(socket.id, client);
		}

		client.connect(address);
	}

	close(socket:any):boolean {
        const client = this.#clients.get(socket.id);
		if(client === undefined){return false;}

		client.close();

		return true;
	}

    remove(socket:any):boolean {
        const exists = this.close(socket);
        
        if(exists){this.#clients.delete(socket.id);}

        return exists;
    }

	read(socket:any, command:string, callback = (data:stateValue|null|undefined) => {}):void {
		const client = this.#clients.get(socket.id);
        const item = client?.getItem(command);

		if(item === undefined || client === undefined){
			callback(undefined);
			return;
		}

		client.readState(command, () => {
			let value = item.value;
			callback(value);
		});
	}

	write(socket:any, command:string, value:stateValue):void {
		const client = this.#clients.get(socket.id);
        const item = client?.getItem(command);

		if(item === undefined || client === undefined){
            return;
        }

		item.value = value;
		client.writeState(command);
	}

    log(socket:any, message:string):void {
        const client = this.#clients.get(socket.id);
        if(client !== undefined){client.log(message);}
    }
}