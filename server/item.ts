class alias {
    static storage = new Map<string, alias>();

    static get(name:string):alias|undefined {
        return this.storage.get(name);
    }

    constructor(name:string, public alt:string, public conversion:number|undefined = undefined){
        alias.storage.set(name, this);
    }
}

new alias("aircraft/0/name", "aircraft");

new alias("simulator/throttle", "throttle", -0.1); // 1000 -1000
new alias("aircraft/0/systems/landing_gear/lever_state", "gear"); // bool
new alias("aircraft/0/systems/spoilers/state", "spoilers"); // 0, 1, 2
new alias("aircraft/0/systems/axes/elevator_trim", "trim"); // 1% = 10
new alias("aircraft/0/systems/flaps/state", "flaps"); // 0, 1, 2, ...
new alias("aircraft/0/systems/parking_brake/state", "parkingbrake"); // bool

new alias("aircraft/0/indicated_airspeed", "airspeed", 1.94384);
new alias("aircraft/0/groundspeed", "groundspeed", 1.94384);
new alias("aircraft/0/altitude_msl", "altitude");
new alias("aircraft/0/altitude_agl", "altitudeAGL");
new alias("aircraft/0/heading_magnetic", "heading", 180/Math.PI);
new alias("aircraft/0/vertical_speed", "verticalspeed", 196.8504);

new alias("aircraft/0/systems/autopilot/vnav/on", "vnavon");
new alias("aircraft/0/flightplan/full_info", "fplinfo");

new alias("aircraft/0/systems/autopilot/on", "autopilot");
new alias("aircraft/0/systems/autopilot/alt/on", "alton");
new alias("aircraft/0/systems/autopilot/vs/on", "vson");
new alias("aircraft/0/systems/autopilot/spd/on", "spdon");
new alias("aircraft/0/systems/autopilot/hdg/on", "hdgon");
new alias("aircraft/0/systems/autopilot/nav/on", "navon");

new alias("aircraft/0/systems/autopilot/alt/target", "alt", 3.28084);
new alias("aircraft/0/systems/autopilot/vs/target", "vs", 3.28084);
new alias("aircraft/0/systems/autopilot/spd/target", "spd", 1.94384);
new alias("aircraft/0/systems/autopilot/hdg/target", "hdg", 180/Math.PI);

new alias("aircraft/0/systems/axes/pitch", "pitch");
new alias("aircraft/0/systems/axes/roll", "roll");
new alias("aircraft/0/systems/axes/yaw", "yaw");

new alias("aircraft/0/latitude", "latitude");
new alias("aircraft/0/longitude", "longitude");
new alias("aircraft/0/magnetic_variation", "variation", 180/Math.PI);
new alias("environment/wind_velocity", "wind", 1.94384);
new alias("environment/wind_direction_true", "winddir", 180/Math.PI);

new alias("aircraft/0/flightplan/route", "route");
new alias("aircraft/0/flightplan/coordinates", "coordinates");

new alias("aircraft/0/configuration/flaps/stops", "flapcount");
new alias("aircraft/0/systems/engines/0/n1", "n1", 100);
new alias("aircraft/0/is_on_ground", "onground");
new alias("aircraft/0/is_on_runway", "onrunway");

new alias("aircraft/0/systems/auto_brakes/command_state", "autobrakes"); // 0, 1, 2, 3
new alias("aircraft/0/systems/brakes/left/percentage", "leftbrake"); // 0-1 (float)
new alias("aircraft/0/systems/brakes/right/percentage", "rightbrake"); // 0-1 (float)

new alias("aircraft/0/systems/electrical_switch/master_switch/state", "master");
new alias("aircraft/0/systems/electrical_switch/nav_lights_switch/state", "navlights"); // 0, 1
new alias("aircraft/0/systems/electrical_switch/strobe_lights_switch/state", "strobelights"); // 0, 1
new alias("aircraft/0/systems/electrical_switch/landing_lights_switch/state", "landinglights"); // 0, 1
new alias("aircraft/0/systems/electrical_switch/beacon_lights_switch/state", "beaconlights"); // 0, 1

class Item {
    id:number;
    type:number;
    alias:string|undefined;
    conversion:number|undefined;
    value:stateValue|undefined = undefined;
    callbacks:(() => void)[] = [];

	constructor(id:string, type:string, public name:string){
		this.id = parseInt(id);
		this.type = parseInt(type);

        const alt = alias.get(this.name);
        this.alias = alt?.alt;
        this.conversion = alt?.conversion;
	}

	get buffer():Buffer {
		let value = this.value;
        if(value === undefined){throw "value is undefined";}

		if(this.conversion !== undefined){
            value = value as number;
			value /= this.conversion;
		}

        let buffer:Buffer;

        switch(this.type){
            case 0: value = Number(value as boolean); buffer = Buffer.from([value]);
            case 1: buffer = Buffer.allocUnsafe(4); buffer.writeInt32LE(value as number); break;
            case 2: buffer = Buffer.allocUnsafe(4); buffer.writeFloatLE(value as number); break;
            case 3: buffer = Buffer.allocUnsafe(8); buffer.writeDoubleLE(value as number); break;
            case 4: value = value as string; buffer = Buffer.allocUnsafe(4 + value.length); buffer.writeInt32LE(value.length); buffer.write(value, 4); break;
            case 5: buffer = Buffer.allocUnsafe(8); buffer.writeBigInt64LE(value as bigint); break;
            default: throw "buffer type is not valid";
        }

		return buffer;
	}

	set buffer(data:Buffer){
		let value:stateValue;

        switch(this.type){
            case 0: value = Boolean(data[0]); break;
            case 1: value = data.readInt32LE(); break;
            case 2: value = data.readFloatLE(); break;
            case 3: value = data.readDoubleLE(); break;
            case 4: value = data.toString("utf8", 4); break;
            case 5: value = data.readBigInt64LE(); break;
            default: throw "buffer type is not valid";
        }

		if(this.conversion !== undefined){
            value = value as number;
			value *= this.conversion;
		}

        this.value = value;
	}

	callback():void {
		this.callbacks.forEach(callback => {callback();});
		this.callbacks = [];
	}
}