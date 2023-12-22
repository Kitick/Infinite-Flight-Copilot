class Alias {
    static storage = new Map<string, Alias>();

    static get(name:string):Alias|undefined {
        return this.storage.get(name);
    }

    constructor(name:string, public alt:string, public conversion:number|undefined = undefined){
        Alias.storage.set(name, this);
    }
}

new Alias("aircraft/0/name", "aircraft");

new Alias("simulator/throttle", "throttle", -0.1); // 1000 -1000
new Alias("aircraft/0/systems/landing_gear/lever_state", "gear"); // bool
new Alias("aircraft/0/systems/spoilers/state", "spoilers"); // 0, 1, 2
new Alias("aircraft/0/systems/axes/elevator_trim", "trim"); // 1% = 10
new Alias("aircraft/0/systems/flaps/state", "flaps"); // 0, 1, 2, ...
new Alias("aircraft/0/systems/parking_brake/state", "parkingbrake"); // bool

new Alias("aircraft/0/indicated_airspeed", "airspeed", 1.94384);
new Alias("aircraft/0/groundspeed", "groundspeed", 1.94384);
new Alias("aircraft/0/altitude_msl", "altitude");
new Alias("aircraft/0/altitude_agl", "altitudeAGL");
new Alias("aircraft/0/heading_magnetic", "heading", 180/Math.PI);
new Alias("aircraft/0/vertical_speed", "verticalspeed", 196.8504);

new Alias("aircraft/0/systems/autopilot/vnav/on", "vnavon");
new Alias("aircraft/0/flightplan/full_info", "fplinfo");

new Alias("aircraft/0/systems/autopilot/on", "autopilot");
new Alias("aircraft/0/systems/autopilot/alt/on", "alton");
new Alias("aircraft/0/systems/autopilot/vs/on", "vson");
new Alias("aircraft/0/systems/autopilot/spd/on", "spdon");
new Alias("aircraft/0/systems/autopilot/hdg/on", "hdgon");
new Alias("aircraft/0/systems/autopilot/nav/on", "navon");

new Alias("aircraft/0/systems/autopilot/alt/target", "alt", 3.28084);
new Alias("aircraft/0/systems/autopilot/vs/target", "vs", 3.28084);
new Alias("aircraft/0/systems/autopilot/spd/target", "spd", 1.94384);
new Alias("aircraft/0/systems/autopilot/hdg/target", "hdg", 180/Math.PI);

new Alias("aircraft/0/systems/axes/pitch", "pitch");
new Alias("aircraft/0/systems/axes/roll", "roll");
new Alias("aircraft/0/systems/axes/yaw", "yaw");

new Alias("aircraft/0/latitude", "latitude");
new Alias("aircraft/0/longitude", "longitude");
new Alias("aircraft/0/magnetic_variation", "variation", 180/Math.PI);
new Alias("environment/wind_velocity", "wind", 1.94384);
new Alias("environment/wind_direction_true", "winddir", 180/Math.PI);

new Alias("aircraft/0/flightplan/route", "route");
new Alias("aircraft/0/flightplan/coordinates", "coordinates");

new Alias("aircraft/0/configuration/flaps/stops", "flapcount");
new Alias("aircraft/0/systems/engines/0/n1", "n1", 100);
new Alias("aircraft/0/is_on_ground", "onground");
new Alias("aircraft/0/is_on_runway", "onrunway");

new Alias("aircraft/0/systems/auto_brakes/command_state", "autobrakes"); // 0, 1, 2, 3
new Alias("aircraft/0/systems/brakes/left/percentage", "leftbrake"); // 0-1 (float)
new Alias("aircraft/0/systems/brakes/right/percentage", "rightbrake"); // 0-1 (float)

new Alias("aircraft/0/systems/electrical_switch/master_switch/state", "master");
new Alias("aircraft/0/systems/electrical_switch/nav_lights_switch/state", "navlights"); // 0, 1
new Alias("aircraft/0/systems/electrical_switch/strobe_lights_switch/state", "strobelights"); // 0, 1
new Alias("aircraft/0/systems/electrical_switch/landing_lights_switch/state", "landinglights"); // 0, 1
new Alias("aircraft/0/systems/electrical_switch/beacon_lights_switch/state", "beaconlights"); // 0, 1

class Item {
    alias:string|undefined;
    conversion:number|undefined;
    value:stateValue|undefined = undefined;
    callbacks:(() => void)[] = [];

	constructor(public id:number, public type:number, public name:string){
        const alias = Alias.get(this.name);
        this.alias = alias?.alt;
        this.conversion = alias?.conversion;
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