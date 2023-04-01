class autofunction{
	constructor(button, timeout, states, torun = () => {}){
		this.states = {};
		this.button = button;
		this.length = states.length;
		this.timeout = timeout;
		
		this.stage = 0;
		this.counter = 0;

		this.active = false;
		this.run = torun;

		states.forEach(state => {
			this.states[state] = undefined;
		});
	}

	start(override = false){
		if(!this.active && !override){
			return;
		}

		if(this.length === 0){
			this.recurse();
		}
		else{
			for(let state in this.states){
				read(state, value => {this.callback(state, value);});
			}
		}
	}

	callback(state, value){
		this.states[state] = value;
		this.counter++;

		if(this.counter === this.length){
			this.counter = 0;
			this.recurse();
		}
	}

	recurse(){
		if(this.timeout === -1){
			this.changeActive(false);
		}

		this.run(this.states);

		if(this.active){
			setTimeout(() => {this.start();}, this.timeout);
		}
	}

	changeActive(state = !this.active){
		this.active = state;
		this.stage = 0;
		this.button.className = this.active ? "active":"off";
		this.start();
	}

	error(){
		this.active = false;
		this.button.className = "error";

		setTimeout(() => {
			this.changeActive(false);
		}, 2000);
	}
}

const autotrim = new autofunction("trim", 1000, ["pitch", "trim", "onground"], states => {
	if(states.onground){
		autotrim.button.className = "armed";
		return;
	}

	autotrim.button.className = "active";

	const deadzone = 2;
	const pitchDirection = states.pitch > 0 ? 1:-1;
	let mod = 10;

	if(Math.abs(states.pitch) < 10){
		mod = 1;
	}
	else if(Math.abs(states.pitch) < 50){
		mod = 5;
	}

	if(Math.abs(states.pitch) >= deadzone){
		let newTrim = states.trim + mod * pitchDirection;
		newTrim = Math.round(newTrim / mod) * mod;

		write("trim", newTrim);
	}
});

const autolights = new autofunction("lights", 1000, ["altitudeAGL", "onground", "onrunway"], states => {
	write("master", true);
	write("beaconlights", true);
	write("navlights", true);

	if(states.onground){
		const runway = states.onrunway;
		write("strobelights", runway);
		write("landinglights", runway);
	}
	else{
		write("strobelights", true);

		if(states.altitudeAGL <= 1500){
			write("landinglights", true);
		}
		else{
			write("landinglights", false);
		}
	}
});

const autogear = new autofunction("gear", 1000, ["gear", "altitudeAGL", "verticalspeed"], states => {
	let newState = states.gear;

	if(states.altitudeAGL < 250 || (states.verticalspeed <= -500 && states.altitudeAGL < 1500)){
		newState = true;
	}
	else if(states.verticalspeed >= 500 || states.altitudeAGL >= 2000){
		newState = false;
	}

	if(newState !== states.gear){
		read("commands/LandingGear");
	}
});

const autoflaps = new autofunction("flaps", 1000, ["flaps", "airspeed", "altitudeAGL", "flapcount", "onground", "onrunway"], states => {
	const low = parseInt(document.getElementById("flaplow").value);
	const high = parseInt(document.getElementById("flaphigh").value);
	const to = parseInt(document.getElementById("flapto").value);

	if(isNaN(low) || isNaN(high) || isNaN(to) || (to < 0 || to > states.flapcount - 1) || (high < low)){
		autoflaps.error();
		return;
	}

	let newFlaps = states.flaps;

	if(states.onground){
		if(states.onrunway){
			newFlaps = to;
		}
		else{
			newFlaps = 0;
		}
	}
	else if(states.altitudeAGL >= 250){
		const count = states.flapcount - 1;

		const mod = (high - low) / count;
		newFlaps = Math.round((high - states.airspeed) / mod);

		if(newFlaps < 0){
			newFlaps = 0;
		}
		else if(newFlaps > count){
			newFlaps = count;
		}
	}

	if(newFlaps !== states.flaps){
		write("flaps", newFlaps);
	}
});

let lastDeltaSPD = 0;
const levelchange = new autofunction("levelchange", 1000, ["onground", "airspeed", "altitude", "alt", "spd", "vs", "vson"], states => {
	if(levelchange.stage === 0){
		write("alton", true);
		levelchange.stage++;
	}
	if(!states.vson){
		write("vson", true);
	}

	if(states.onground){
		levelchange.button.className = "armed";
		return;
	}

	const deltaSPD = states.spd - states.airspeed;
	const deltaALT = states.alt - states.altitude;
	const spdDirection = deltaSPD > 0 ? 1:-1;
	const deadzone = 1;

	if(Math.abs(deltaALT) < 100){
		levelchange.changeActive(false);
		return;
	}

	levelchange.button.className = "active";

	let mod = 1;
	if(Math.abs(deltaSPD - lastDeltaSPD) > deadzone && (deltaSPD > 0 !== (deltaSPD - lastDeltaSPD > 0))){
		mod = -1;
	}

	lastDeltaSPD = deltaSPD;

	const newVS = states.vs + 100 * -spdDirection * mod;

	if(newVS > 0 !== deltaALT > 0){
		if(states.vs !== 0){
			write("vs", 0);
		}
	}
	else if(Math.abs(deltaSPD) >= deadzone){
		write("vs", newVS);
	}
});

const takeoffconfig = new autofunction("takeoffconfig", -1, ["onground"], states => {
	if(!states.onground){
		takeoffconfig.error();
		return;
	}

	autoflaps.start(true);
	autolights.start(true);

	write("spoilers", 2);
	write("autobrakes", 3);
	write("parkingbrake", false);
});

const rejecttakeoff = new autofunction("reject", -1, ["onrunway"], states => {
	if(states.onrunway){
		autotakeoff.error();
		write("throttle", -100);
	}
});

const autotakeoff = new autofunction("autotakeoff", 500, ["onrunway", "n1", "airspeed", "altitude", "altitudeAGL", "heading"], states => {
	let stage = autotakeoff.stage;

	const flaplow = parseInt(document.getElementById("flaplow").value);
	const flaphigh = parseInt(document.getElementById("flaphigh").value);
	const short = document.getElementById("short").checked;

	if(isNaN(flaplow) || isNaN(flaphigh)){
		autotakeoff.error();
		return;
	}
	
	if(stage === 0){
		if(!states.onrunway){
			autotakeoff.error();
			return;
		}

		takeoffconfig.start(true);
		autogear.changeActive(true);
		autoflaps.changeActive(true);
		levelchange.changeActive(true);

		write("alt", Math.round(states.altitude / 100) * 100 + 3000);
		write("vs", 0);
		write("spd", flaphigh);
		write("hdg", states.heading);

		write("autopilot", true);
		write("alton", true);
		write("vson", false);
		write("hdgon", true);

		if(short){
			write("parkingbrake", true);
			write("throttle", 100);
		}
		else{
			write("throttle", -20);
		}

		stage++;
	}
	else if(stage === 1){
		write("vson", true);

		if(short){
			if(states.n1 >= 100){
				write("parkingbrake", false);
				stage++;
			}
		}
		else{
			if(states.n1 >= 50){
				write("throttle", 80);
				stage++;
			}
		}
	}
	else if(stage === 2){
		if(states.airspeed >= flaplow - 20){
			write("vs", short ? 1000:500);
			stage++;
		}
	}
	else if(stage === 3){
		if(states.altitudeAGL >= 2000){
			stage++;
		}
	}
	else{
		write("spdon", true);
		autotakeoff.changeActive(false);
	}

	if(Math.abs(flaphigh - states.airspeed) < 10){
		write("spdon", true);
	}

	autotakeoff.stage = stage;
});

const autofunctions = [autotrim, autolights, autogear, autoflaps, takeoffconfig, autotakeoff, rejecttakeoff, levelchange];