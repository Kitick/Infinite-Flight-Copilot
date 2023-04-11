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

		if(this.button !== null){
			this.button.className = this.active ? "active":"off";
		}

		this.start();
	}

	error(){
		this.changeActive(false);
		this.button.className = "error";

		setTimeout(() => {
			this.button.className = this.active ? "active":"off";
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

	if(states.altitudeAGL < 200 || (states.verticalspeed <= -500 && states.altitudeAGL < 1500)){
		newState = true;
	}
	else if(states.verticalspeed >= 500 || states.altitudeAGL >= 2000){
		newState = false;
	}

	if(newState !== states.gear){
		read("commands/LandingGear");
	}
});

const autoflaps = new autofunction("flaps", 1000, ["flaps", "airspeed", "altitudeAGL", "verticalspeed", "flapcount", "onground", "onrunway"], states => {
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

	if((states.verticalspeed >= 500 && newFlaps > states.flaps) || (states.verticalspeed <= -500 && newFlaps < states.flaps)){
		newFlaps = states.flaps;
	}

	if(newFlaps !== states.flaps){
		write("flaps", newFlaps);
	}
});

let lastDeltaSPD = 0;
const levelchange = new autofunction("levelchange", 1000, ["onground", "airspeed", "altitude", "alt", "spd", "vs", "throttle", "vson"], states => {
	if(levelchange.stage === 1 && !states.vson){
		levelchange.error();
		return;
	}

	if(levelchange.stage === 0){
		write("alton", true);

		if(!states.vson){
			write("vson", true);
		}

		levelchange.stage++;
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

	// IF Throttle avalable, increase vs
	// IF speed delta is increasing in the same direction as change, increase vs
	// BUT if speed delata is increaseing in the oposite direction as change, decrease vs TO a minumum change rate
	

	let newVS = states.vs + 100 * -spdDirection;

	if(Math.abs(states.throttle) !== 100 && Math.abs(deltaSPD) <= deadzone){
		//newVS = -newVS;
	}

	lastDeltaSPD = deltaSPD;

	if(newVS > 0 !== deltaALT > 0){
		newVS = 0;
	}

	newVS = Math.round(newVS / 100) * 100;
	write("vs", newVS);
});

const rejecttakeoff = new autofunction("reject", -1, ["onrunway"], states => {
	if(states.onrunway){
		autotakeoff.error();
		write("throttle", -100);
	}
	else{
		rejecttakeoff.error();
	}
});

const takeoffconfig = new autofunction("takeoffconfig", -1, ["onrunway", "heading", "altitude"], states => {
	if(!states.onrunway){
		takeoffconfig.error();
		return;
	}

	const climbalt = parseInt(document.getElementById("climbalt").value);

	if(isNaN(climbalt)){
		takeoffconfig.error();
		return;
	}

	const usemsl = document.getElementById("takeoffmsl").checked;

	autoflaps.start(true);
	autolights.start(true);

	const altitude = Math.round(states.altitude / 100) * 100;
	write("alt", climbalt + (usemsl ? 0 : altitude));
	write("hdg", states.heading);
	write("vs", 0);

	write("spoilers", 2);
	write("autobrakes", 3);
	write("parkingbrake", false);
});

const autotakeoff = new autofunction("autotakeoff", 500, ["onrunway", "n1", "airspeed", "altitude", "altitudeAGL"], states => {
	let stage = autotakeoff.stage;

	const rotate = parseInt(document.getElementById("rotate").value);
	const climbspd = parseInt(document.getElementById("climbspd").value);
	const climbrate = parseInt(document.getElementById("climbrate").value);
	const climbalt = parseInt(document.getElementById("climbalt").value);

	if(isNaN(rotate) || isNaN(climbspd) || isNaN(climbrate) || isNaN(climbalt)){
		autotakeoff.error();
		return;
	}

	const short = document.getElementById("short").checked;
	const usemsl = document.getElementById("takeoffmsl").checked;
	
	if(stage === 0){
		if(!states.onrunway){
			autotakeoff.error();
			return;
		}

		takeoffconfig.start(true);
		autogear.changeActive(true);
		autoflaps.changeActive(true);
		
		write("spd", climbspd);
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

		if(states.n1 === null){
			write("throttle", short ? 100:80);
			stage++;
		}
		else if(short){
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
		if(states.airspeed >= rotate){
			stage++;
		}
	}
	else if(stage === 3){
		const fpm = climbrate * states.airspeed / 60;

		write("vs", fpm);

		const MSL = states.altitude >= climbalt - 100;
		const AGL = states.altitudeAGL >= (climbalt > 2000 ? 2000 : climbalt - 100);
		if(AGL || (usemsl && MSL)){
			stage++;
		}
	}
	else{
		write("spdon", true);
		autotakeoff.changeActive(false);
	}

	if(Math.abs(climbspd - states.airspeed) < 10){
		write("spdon", true);
	}

	autotakeoff.stage = stage;
});

function cyclical(value, range = 360){
    value = ((value % range) + range) % range;
    return value;
}

function dms(deg, min = 0, sec = 0){
    const sign = deg >= 0 ? 1:-1;
	return sign * (Math.abs(deg) + (min / 60) + (sec / 3600));
}
/*
function calcLLfromHD(lat, long, hdg, dist){
    dist /= 60;

    hdg = -hdg + 90 - this.data.MagneticDeviation;
    hdg *= Math.PI / 180;

    let lat2 = dist * Math.sin(hdg) + lat;
    let long2 = dist * Math.cos(hdg) * Math.cos((Math.PI / 180) * (lat + lat2) * 0.5) ** -1 + long;

    return [lat2, long2];
}
*/
const setposition = new autofunction("setposition", -1, ["latitude", "longitude", "heading"], states => {
	document.getElementById("lat").value = states.latitude;
	document.getElementById("long").value = states.longitude;
	document.getElementById("hdg").value = Math.round(states.heading);
});

const setrunway = new autofunction("setrunway", -1, ["route", "coordinates"], states => {
	const route = states.route.split(",");
	let rwIndex = -1;

	for(let i = 0, length = route.length; i < length; i++){
		if(route[i].search(/RW\d\d.*/) === 0){
			rwIndex = i;
			break;
		}
	}

	if(rwIndex === -1){
		setrunway.error();
		return;
	}

	const runwayCoords = states.coordinates.split(" ")[rwIndex].split(",");

	document.getElementById("lat").value = runwayCoords[0];
	document.getElementById("long").value = runwayCoords[1];
	document.getElementById("hdg").value = parseInt(route[rwIndex][2] + route[rwIndex][3] + "0");
});

const toDeg = 180 / Math.PI;
const toRad = Math.PI / 180;

const flyto = new autofunction("flyto", 1000, ["latitude", "longitude", "variation"], states => {
	const latTarget = parseFloat(document.getElementById("lat").value);
	const longTarget = parseFloat(document.getElementById("long").value);
	const hdgTarget = cyclical(parseInt(document.getElementById("hdg").value));

	if(isNaN(latTarget) || isNaN(longTarget)){
		flyto.error();
		return;
	}

	const deltaY = 60 * (latTarget - states.latitude);
	const deltaX = 60 * (longTarget - states.longitude) * Math.cos((latTarget + states.latitude) * 0.5 * toRad);
	const distance = (deltaX ** 2 + deltaY ** 2) ** 0.5;

	if(distance < 1){
		flyto.changeActive(false);
		return;
	}

	let course = cyclical(Math.atan2(deltaX, deltaY) * toDeg - states.variation);

	if(!isNaN(hdgTarget)){
		let diffrence = hdgTarget - course;
		let sign = diffrence >= 0 ? 1:-1;

		if(diffrence > 180){
			diffrence -= 360;
		}
		else if(diffrence < -180){
			diffrence += 360;
		}

		if(Math.abs(diffrence) <= 3){
			course -= 3 * diffrence;
		}
		else{
			course -= 30 * sign;
		}
	}

	course = cyclical(course);

	write("hdg", course);
});

const autofunctions = [autotrim, autolights, autogear, autoflaps, levelchange, takeoffconfig, autotakeoff, rejecttakeoff, setposition, setrunway, flyto];