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
		if(this.active === state){
			return;
		}

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
	let mod = 10;

	if(Math.abs(states.pitch) < 10){
		mod = 1;
	}
	else if(Math.abs(states.pitch) < 50){
		mod = 5;
	}

	if(Math.abs(states.pitch) >= deadzone){
		let newTrim = states.trim + mod * Math.sign(states.pitch);
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

	if(states.altitudeAGL < 100 || (states.verticalspeed <= -500 && states.altitudeAGL < 1000)){
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

function fixflcinput(mode){
	const flcinput = document.getElementById('flcinput');
	flcinput.step = mode === 'g' ? 100:0.5;
	flcinput.value = mode === 'g' ? 500:3;
}

const levelchange = new autofunction("levelchange", 1000, ["airspeed", "altitude", "alt"], states => {
	let input = parseFloat(document.getElementById("flcinput").value);

	if(isNaN(input)){
		levelchange.error();
		return;
	}

	const diffrence = states.alt - states.altitude;

	if(Math.abs(diffrence) < 100){
		levelchange.changeActive(false);
		return;
	}

	const mode = document.getElementById("flcmode").value;

	if(mode === 'v'){
		input = 6076.12 * Math.tan(input * toRad);
	}

	const fpm = input * Math.sign(diffrence) * states.airspeed / 60;
	write("vs", fpm);
});

const markposition = new autofunction("markposition", -1, ["latitude", "longitude", "altitude", "heading"], states => {
	document.getElementById("latref").value = states.latitude;
	document.getElementById("longref").value = states.longitude;
	document.getElementById("hdgref").value = Math.round(states.heading);
    document.getElementById("altref").value = Math.round(states.altitude);
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

	document.getElementById("latref").value = runwayCoords[0];
	document.getElementById("longref").value = runwayCoords[1];
	document.getElementById("hdgref").value = parseInt(route[rwIndex][2] + route[rwIndex][3] + "0");
});

function cyclical(value, range = 360){
    value = ((value % range) + range) % range;
    return value;
}

function dms(deg, min = 0, sec = 0){
	return Math.sign(deg) * (Math.abs(deg) + (min / 60) + (sec / 3600));
}

function calcLLfromHD(lat, long, hdg, dist, magvar = 0){
    dist /= 60;

    hdg = -hdg + 90 - magvar;
    hdg *= toRad;

    const lat2 = dist * Math.sin(hdg) + lat;
    const long2 = dist * Math.cos(hdg) * Math.cos(toRad * (lat + lat2) * 0.5) ** -1 + long;

    return [lat2, long2];
}

const toDeg = 180 / Math.PI;
const toRad = Math.PI / 180;

const flyto = new autofunction("flyto", 1000, ["latitude", "longitude", "variation", "airspeed", "wind", "winddir"], states => {
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

		if(diffrence > 180){
			diffrence -= 360;
		}
		else if(diffrence < -180){
			diffrence += 360;
		}

		if(Math.abs(diffrence) < 6){
            let mod = 5;

            if(autoland.active && Math.abs(diffrence) < 3){
                mod = 10;
            }

			course -= mod * diffrence;
		}
		else{
			course -= 30 * Math.sign(diffrence);
		}
	}

	let courseMath = -course + 90;
	let windMath = -states.winddir + 90 - states.variation;

	courseMath *= toRad;
	windMath *= toRad;

	const courseX = states.airspeed * Math.cos(courseMath);
	const courseY = states.airspeed * Math.sin(courseMath);
	const windX = (states.wind / 2) * Math.cos(windMath);
	const windY = (states.wind / 2) * Math.sin(windMath);

	course = cyclical(Math.atan2(courseX + windX, courseY + windY) * toDeg);

	write("hdg", course);
});

const flypattern = new autofunction("flypattern", 1000, ["latitude", "longitude", "variation", "onrunway", "groundspeed"], states => {
	const lat = parseFloat(document.getElementById("latref").value);
	const long = parseFloat(document.getElementById("longref").value);
	const hdg = cyclical(document.getElementById("hdgref").value);

	const updist = parseFloat(document.getElementById("updist").value);
	const downwidth = parseFloat(document.getElementById("downwidth").value);
	const finallength = parseFloat(document.getElementById("finallength").value);
	const turnconst = parseInt(document.getElementById("turnconst").value);

	if(isNaN(lat) || isNaN(long) || isNaN(hdg) || isNaN(turnconst)){
		flypattern.error();
		return;
	}

	const legs = ['u', 'c', 'd', 'b', 'f'];

	let leg = legs.indexOf(document.getElementById("leg").value);
	const direction = document.getElementById("direction").value === 'r' ? 1:-1;

	const hdg90 = hdg + 90 * direction;
	const hdgs = [hdg, hdg90, hdg + 180, hdg90 + 180, hdg];

	let pattern = [];
	pattern[0] = calcLLfromHD(lat, long, hdg, updist + 1.5, states.variation);
	pattern[1] = calcLLfromHD(pattern[0][0], pattern[0][1], hdg90, downwidth, states.variation);
	pattern[3] = calcLLfromHD(lat, long, hdg + 180, finallength, states.variation);
	pattern[2] = calcLLfromHD(pattern[3][0], pattern[3][1], hdg90, downwidth, states.variation);
	pattern[4] = [lat, long];

	const deltaY = 60 * (pattern[leg][0] - states.latitude);
	const deltaX = 60 * (pattern[leg][1] - states.longitude) * Math.cos((pattern[leg][0] + states.latitude) * 0.5 * toRad);
	const distance = (deltaX ** 2 + deltaY ** 2) ** 0.5;

	const speed = states.groundspeed / 60; // kts to nm/m
	const turnrate = (turnconst / states.groundspeed) * 60 * toRad; // deg/s to rad/m

	if(distance < speed / turnrate){
		if(leg !== 4 || (leg === 4 && distance < 1)){
			leg = (leg + 1) % 5;
		}
	}

    if(document.getElementById("approach").checked){
        if(leg === 3){
            
        }
        else if(leg === 4){
            autoland.changeActive(true);
        }
    }

	document.getElementById("leg").value = legs[leg];
	document.getElementById("lat").value = pattern[leg][0];
	document.getElementById("long").value = pattern[leg][1];
	document.getElementById("hdg").value = cyclical(hdgs[leg]);

	flyto.changeActive(true);
});

const autoland = new autofunction("autoland", 500, ["onrunway", "latitude", "longitude", "altitude", "groundspeed"], states => {
    const lat = parseFloat(document.getElementById("latref").value);
	const long = parseFloat(document.getElementById("longref").value);
    const alt = parseInt(document.getElementById("altref").value);
    const spd = parseInt(document.getElementById("spdref").value);
    const vpa = parseFloat(document.getElementById("vparef").value);

    const touchdown = parseInt(document.getElementById("touchdown").value);

    if(autoland.stage === 0){
        autoland.stage++;
        document.getElementById("leg").value = "f";
        document.getElementById("flcmode").value = "v";
    }

    const deltaY = 60 * (lat - states.latitude);
	const deltaX = 60 * (long - states.longitude) * Math.cos((lat + states.latitude) * 0.5 * toRad);
	const finalDistance = touchdown + 6076.12 * (deltaX ** 2 + deltaY ** 2) ** 0.5; // nm to ft

    const altDiffrence = alt - states.altitude;

    const currentVPA = -Math.atan(altDiffrence / finalDistance) * toDeg;
    const VPADiffrence = currentVPA - vpa;

    console.log(VPADiffrence);

    let vpaout = vpa;

    if(VPADiffrence >= 1){
        autoland.error();
    }
    else if(VPADiffrence <= -1){
        vpaout = 0;
    }
    else if(Math.abs(VPADiffrence) >= 0.5){
        vpaout = vpa + 1 * Math.sign(VPADiffrence);
    }
    else if(Math.abs(VPADiffrence) >= 0.25){
        vpaout = vpa + 0.5 * Math.sign(VPADiffrence);
    }
    else if(Math.abs(VPADiffrence) >= 0.1){
        vpaout = vpa + 0.25 * Math.sign(VPADiffrence);
    }

    document.getElementById("flcinput").value = vpaout;

    write("spoilers", 2);
    write("alt", alt);

    if(states.altitude - alt > 100){
        levelchange.changeActive(true);
    }

    flypattern.changeActive(true);
    autoflaps.changeActive(true);
    autogear.changeActive(true);
});

const goaround = new autofunction("goaround", -1, [], states => {
    autoland.error();
    
    const alt = parseInt(document.getElementById("climbalt").value);
    const spd = parseInt(document.getElementById("climbspd").value);

    document.getElementById("flcmode").value = "g";
    document.getElementById("flcinput").value = 500;

    levelchange.changeActive(true);
    autoflaps.changeActive(true);
    autogear.changeActive(true);

    write("spoilers", 0);
    write("spd", spd);
    write("alt", alt);
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

	write("spoilers", 0);
	write("autobrakes", 3);
	write("parkingbrake", false);
});

const autotakeoff = new autofunction("autotakeoff", 500, ["onrunway", "n1", "airspeed", "altitude", "altitudeAGL"], states => {
	let stage = autotakeoff.stage;

	const rotate = parseInt(document.getElementById("rotate").value);
	const climbspd = parseInt(document.getElementById("climbspd").value);
	const flcinput = parseFloat(document.getElementById("flcinput").value);

	if(isNaN(rotate) || isNaN(climbspd) || isNaN(flcinput)){
		autotakeoff.error();
		return;
	}

	const short = document.getElementById("short").checked;

	if(stage === 0){
		if(!states.onrunway){
			autotakeoff.error();
			return;
		}

		takeoffconfig.start(true);
		levelchange.changeActive(false);

		autotrim.changeActive(true);
		autolights.changeActive(true);
		autogear.changeActive(true);
		autoflaps.changeActive(true);

		write("spd", climbspd);
		write("spoilers", 2);

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
			levelchange.changeActive(true);
			stage++;
		}
	}
	else if(stage === 3){
		if(Math.abs(climbspd - states.airspeed) < 10){
			write("spdon", true);
			stage++;
		}
	}
	else{
		write("spdon", true);
		autotakeoff.changeActive(false);
	}

	autotakeoff.stage = stage;
});

const autofunctions = [autotrim, autolights, autogear, autoflaps, levelchange, markposition, setrunway, flyto, flypattern, rejecttakeoff, takeoffconfig, autotakeoff, autoland, goaround];