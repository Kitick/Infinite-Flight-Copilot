class Item {
	static aliases = {
		"aircraft/0/name":"aircraft",

		"simulator/throttle":"throttle", // 1000 -1000
		"aircraft/0/systems/landing_gear/lever_state":"gear", // bool
		"aircraft/0/systems/spoilers/state":"spoilers", // 0, 1, 2
		"aircraft/0/systems/axes/elevator_trim":"trim", // 1% = 10
		"aircraft/0/systems/flaps/state":"flaps", // 0, 1, 2, ...
		"aircraft/0/systems/parking_brake/state":"parkingbrake", // bool

		"aircraft/0/indicated_airspeed":"airspeed",
		"aircraft/0/groundspeed":"groundspeed",
		"aircraft/0/altitude_msl":"altitude",
		"aircraft/0/altitude_agl":"altitudeAGL",
		"aircraft/0/heading_magnetic":"heading",
		"aircraft/0/vertical_speed":"verticalspeed",

		"aircraft/0/systems/autopilot/vnav/on":"vnavon",
		"aircraft/0/flightplan/full_info":"fplinfo",

		"aircraft/0/systems/autopilot/on":"autopilot",
		"aircraft/0/systems/autopilot/alt/on":"alton",
		"aircraft/0/systems/autopilot/vs/on":"vson",
		"aircraft/0/systems/autopilot/spd/on":"spdon",
		"aircraft/0/systems/autopilot/hdg/on":"hdgon",
        "aircraft/0/systems/autopilot/nav/on":"navon",

		"aircraft/0/systems/autopilot/alt/target":"alt",
		"aircraft/0/systems/autopilot/vs/target":"vs",
		"aircraft/0/systems/autopilot/spd/target":"spd",
		"aircraft/0/systems/autopilot/hdg/target":"hdg",

		"aircraft/0/systems/axes/pitch":"pitch",
		"aircraft/0/systems/axes/roll":"roll",
		"aircraft/0/systems/axes/yaw":"yaw",

		"aircraft/0/latitude":"latitude",
		"aircraft/0/longitude":"longitude",
		"aircraft/0/magnetic_variation":"variation",
		"environment/wind_velocity":"wind",
		"environment/wind_direction_true":"winddir",

		"aircraft/0/flightplan/route":"route",
		"aircraft/0/flightplan/coordinates":"coordinates",

		"aircraft/0/configuration/flaps/stops":"flapcount",
		"aircraft/0/systems/engines/0/n1":"n1",
		"aircraft/0/is_on_ground":"onground",
		"aircraft/0/is_on_runway":"onrunway",

		"aircraft/0/systems/auto_brakes/command_state":"autobrakes", // 0, 1, 2, 3
		"aircraft/0/systems/brakes/left/percentage":"leftbrake", // 0-1 (float)
		"aircraft/0/systems/brakes/right/percentage":"rightbrake", // 0-1 (float)

		"aircraft/0/systems/electrical_switch/master_switch/state":"master",
		"aircraft/0/systems/electrical_switch/nav_lights_switch/state":"navlights", // 0, 1
		"aircraft/0/systems/electrical_switch/strobe_lights_switch/state":"strobelights", // 0, 1
		"aircraft/0/systems/electrical_switch/landing_lights_switch/state":"landinglights", // 0, 1
		"aircraft/0/systems/electrical_switch/beacon_lights_switch/state":"beaconlights", // 0, 1
	};

	static conversions = {
		"airspeed":1.94384, // m/s to kts
		"groundspeed":1.94384, // m/s to kts
		"heading":180/Math.PI,
		"verticalspeed":196.8504, // m/s to fpm
		
		"throttle":-0.1, // 1000s to 100s
		"n1":100,

		"wind":1.94384,
		"winddir":180/Math.PI,
		"variation":180/Math.PI,

		"spd":1.94384, // m/s to kts
		"hdg":180/Math.PI, // rad to deg
		"alt":3.28084, // m to ft
		"vs":3.28084, // m/m to fpm
	};

	static readBufferType = [
		value => {return Boolean(value[0]);},
		value => {return value.readInt32LE();},
		value => {return value.readFloatLE();},
		value => {return value.readDoubleLE();},
		value => {return value.toString("utf8", 4);},
		value => {return value.readBigInt64LE();},
	];

	static writeBufferType = [
		value => {return Buffer.from([Number(value)]);},
		value => {let buffer = Buffer.allocUnsafe(4); buffer.writeInt32LE(value); return buffer;},
		value => {let buffer = Buffer.allocUnsafe(4); buffer.writeFloatLE(value); return buffer;},
		value => {let buffer = Buffer.allocUnsafe(8); buffer.writeDoubleLE(value); return buffer;},
		value => {let buffer = Buffer.allocUnsafe(4 + value.length); buffer.writeInt32LE(value.length); buffer.write(value, 4); return buffer;},
		value => {let buffer = Buffer.allocUnsafe(8); buffer.writeBigInt64LE(value); return buffer;},
	];

	constructor(id, type, name){
		this.id = parseInt(id);
		this.type = parseInt(type);
		this.name = name;
		this.alias = Item.aliases[this.name];
		this.value = undefined;
		this.conversion = Item.conversions[this.alias];
		this.callbacks = [];
	}

	get buffer(){
		let value = this.value;
		
		if(this.conversion !== undefined){
			value /= this.conversion;
		}

		return Item.writeBufferType[this.type](value);
	}

	set buffer(data){
		this.value = Item.readBufferType[this.type](data);

		if(this.conversion !== undefined){
			this.value *= this.conversion;
		}
	}

	callback(){
		this.callbacks.forEach(callback => {
			callback();
		});

		this.callbacks = [];
	}
}