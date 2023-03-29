class autofunction{
	constructor(button, states, torun = () => {}){
		this.states = {};
		this.button = button;
		this.length = states.length;
		this.counter = 0;

		this.active = false;
		this.run = torun;

		states.forEach(state => {
			this.states[state] = undefined;
		});
	}

	start(){
		if(!this.active){
			return;
		}

		for(let state in this.states){
			read(state, value => {
				this.states[state] = value;
				this.counter++;

				if(this.counter === this.length){
					this.counter = 0;
					this.run(this.states);
				}
			});
		}
	}

	changeActive(state = !this.active){
		this.active = state;
		this.button.className = (this.active ? "active":"off");
		this.start();
	}
}

function slowupdate(){
	autotrim.start();
	autolights.start();
	autogear.start();
	autoflaps.start();
}

function fastupdate(){

}

const autotrim = new autofunction("trim", ["pitch", "trim", "onground"], states => {
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

const autolights = new autofunction("lights", ["altitudeAGL", "onground", "onrunway"], states => {
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

		if(states.altitudeAGL < 1500){
			write("landinglights", true);
		}
		else{
			write("landinglights", false);
		}
	}
});

const autogear = new autofunction("gear", ["gear", "altitudeAGL", "verticalspeed"], states => {
	let newState = states.gear;
	const vs = states.verticalspeed * 196.85;

	if(states.altitudeAGL < 500 || (vs <= -1000 && states.altitudeAGL < 1500)){
		newState = true;
	}
	else if(vs >= 1000 || states.altitudeAGL >= 2000){
		newState = false;
	}

	if(newState !== states.gear){
		read("commands/LandingGear");
	}
});

const autoflaps = new autofunction("flaps", ["flaps", "airspeed", "altitudeAGL", "flapcount", "onground", "onrunway"], states => {
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
	else if(states.altitudeAGL >= 500){
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

const autofunctions = [autotrim, autolights, autogear, autoflaps];