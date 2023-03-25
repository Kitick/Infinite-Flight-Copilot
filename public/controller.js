class autofunction{
	static cache = {};
	
	constructor(states, torun = () => {}){
		this.states = {};
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

	changeActive(button, state = !this.active){
		this.active = state;
		document.getElementById(button).className = (this.active ? "active":"off");
	}
}

function slowupdate(){
	autotrim.start();
	autolights.start();
	autogear.start();
}

function fastupdate(){

}

const autotrim = new autofunction(["pitch", "trim", "onground"], states => {
	if(!states.onground){
		const deadzone = 10;

		if(states.pitch >= deadzone){
			write("trim", states.trim + 10);
		}
		else if(states.pitch <= -deadzone){
			write("trim", states.trim - 10);
		}
	}
});

const autolights = new autofunction(["altitudeAGL", "onground", "onrunway"], states => {
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

const autogear = new autofunction(["gear", "altitudeAGL", "verticalspeed"], states => {
	let newState = states.gear;
	let vs = states.verticalspeed * 196.85;

	if(states.altitudeAGL < 500 || (vs <= -1000 && states.altitudeAGL < 1500)){
		newState = true;
	}
	else if(vs >= 1000 || states.altitudeAGL >= 2000){
		newState = false;
	}

	if(states.gear !== newState){
		read("commands/LandingGear");
	}
});