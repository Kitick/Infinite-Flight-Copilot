class autofunction{
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
			document.getElementById("trim").className = "off";
			return;
		}

		document.getElementById("trim").className = "active";

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
}

const autotrim = new autofunction(["pitch", "trim", "onground"], states => {
	if(!states.onground){
		const deadzone = 10;

		if(states.pitch >= deadzone){
			write("trim", states.trim + 1);
		}
		else if(states.pitch <= -deadzone){
			write("trim", states.trim - 1);
		}
	}
});

function update(){
	autotrim.start();
}