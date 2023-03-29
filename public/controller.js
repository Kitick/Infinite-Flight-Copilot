class autofunction{
	constructor(button, timeout, states, torun = () => {}){
		this.states = {};
		this.button = button;
		this.length = states.length;
		this.timeout = timeout;
		this.counter = 0;

		this.active = false;
		this.override = false;
		this.run = torun;

		states.forEach(state => {
			this.states[state] = undefined;
		});
	}

	start(override = false){
		this.override = override;

		if(!this.active && !this.override){
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
		this.run(this.states);

		if(this.override || this.timeout === -1){
			this.override = false;
			
			if(this.timeout === -1){
				this.changeActive(false);
			}
		}
		else{
			setTimeout(() => {this.start();}, this.timeout);
		}
	}

	changeActive(state = !this.active){
		this.active = state;
		this.button.className = (this.active ? "active":"off");
		this.start();
	}
}

const autotrim = new autofunction("trim", 1000, ["pitch", "trim", "onground"], states => {
	if(!states.onground){
		const deadzone = 5;
		let mod = 10;

		if(states.pitch <= 50){
			mod = 5;
		}

		if(states.pitch >= deadzone){
			write("trim", states.trim + mod);
		}
		else if(states.pitch <= -deadzone){
			write("trim", states.trim - mod);
		}
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
	const vs = states.verticalspeed * 196.85;

	if(states.altitudeAGL < 250 || (vs <= -1000 && states.altitudeAGL < 1500)){
		newState = true;
	}
	else if(vs >= 1000 || states.altitudeAGL >= 2000){
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

	if(isNaN(low) || isNaN(high) || isNaN(to)){
		autoflaps.active = false;
		autoflaps.button.className = "error";

		setTimeout(() => {
			autoflaps.changeActive(false);
		}, 3000);
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
		const airspeed = states.airspeed * 1.94384;
		const count = states.flapcount - 1;

		const mod = (high - low) / count;
		newFlaps = Math.round((high - airspeed) / mod);

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

const takeoffconfig = new autofunction("takeoff", -1, [], states => {
	autoflaps.start(true);
	autolights.start(true);

	write("spoilers", 2);
	write("autobrakes", 3);
	write("parkingbrake", false);
});

const autofunctions = [autotrim, autolights, autogear, autoflaps, takeoffconfig];