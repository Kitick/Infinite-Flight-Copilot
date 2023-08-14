class autofunction{
	#button;
    #timeout;
    #states = {};
    #numStates = 0;
    #validStates = 0;
    #active = false;
    #armed = false;
    #code = () => {};

    static loadButtonHTML(){
        autofunctions.forEach(autofunc => {
            autofunc.#button = document.getElementById(autofunc.#button);
        });
    }

    constructor(button, delay, states, code = () => {}){
		this.#button = button;
        this.delay = delay;
		this.#numStates = states.length;
        this.#code = code;

		this.stage = 0;

		states.forEach(state => {
			this.#states[state] = undefined;
		});
	}

    get active(){
        return this.#active;
    }

    set active(run){
        if(this.active === run){
			return;
		}

        this.#active = run;
        this.updateButton();

        if(run){
            this.stage = 0;
            this.run();
        }
        else{
            clearTimeout(this.#timeout);
        }
    }

    toggle(){
        this.active = !this.active;
    }

    updateButton(){
		this.#button.className = this.active ? "active":"off";
    }

    run(){
        this.#readStates(() => {
            const wasArmed = this.#armed;
            this.#armed = false;

            this.#code(this.#states);

            if(!this.#armed && wasArmed){
                this.updateButton();
            }

            if(this.delay === -1){
                this.active = false;
            }

            if(this.active){
                this.#timeout = setTimeout(() => {this.run();}, this.delay);
            }
        });
	}

	#readStates(callback = () => {}){
		if(this.#numStates === 0){
			this.callback();
		}
		else{
            this.#validStates = 0;
			for(let state in this.#states){
				read(state, value => {this.#stateReturn(state, value, callback);});
			}
		}
	}

	#stateReturn(state, value, callback = () => {}){
		this.#states[state] = value;
		this.#validStates++;

		if(this.#validStates === this.#numStates){
			callback();
		}
	}

    arm(){
        this.#armed = true;
        this.#button.className = "armed";
    }

	error(){
		this.active = false;
		this.#button.className = "error";
		this.#timeout = setTimeout(() => {this.updateButton();}, 2000);
	}
}

const autotrim = new autofunction("trim", 1000, ["pitch", "trim", "onground"], states => {
	if(states.onground){
		autotrim.arm();
		return;
	}

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
		levelchange.active = false;
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
    const long2 = (dist * Math.cos(hdg)) / Math.cos(toRad * (lat + lat2) * 0.5) + long;

    return [lat2, long2];
}

function calcLLdistance(lat1, long1, lat2, long2){
    const deltaY = 60 * (lat2 - lat1);
	const deltaX = 60 * (long2 - long1) * Math.cos((lat1 + lat2) * 0.5 * toRad);
	const distance = (deltaX ** 2 + deltaY ** 2) ** 0.5;

    return distance;
}

const toDeg = 180 / Math.PI;
const toRad = Math.PI / 180;

const flyto = new autofunction("flyto", 1000, ["latitude", "longitude", "variation", "groundspeed", "wind", "winddir"], states => {
	const latTarget = parseFloat(document.getElementById("lat").value);
	const longTarget = parseFloat(document.getElementById("long").value);
	const hdgTarget = cyclical(parseInt(document.getElementById("hdg").value));

	if(isNaN(latTarget) || isNaN(longTarget)){
		flyto.error();
		return;
	}

	const distance = calcLLdistance(states.latitude, states.longitude, latTarget, longTarget);

	if(distance < 1){
		flyto.active = false;
		return;
	}

    const deltaY = 60 * (latTarget - states.latitude);
	const deltaX = 60 * (longTarget - states.longitude) * Math.cos((states.latitude + latTarget) * 0.5 * toRad);
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
			course -= 5 * diffrence;
		}
		else{
			course -= 30 * Math.sign(diffrence);
		}
	}

    const winddir = cyclical(states.winddir - states.variation + 180);
	let courseMath = -course + 90;
	let windMath = -winddir + 90;

	courseMath *= toRad;
	windMath *= toRad;

	const courseX = 2 * states.groundspeed * Math.cos(courseMath);
	const courseY = 2 * states.groundspeed * Math.sin(courseMath);
	const windX = states.wind * Math.cos(windMath);
	const windY = states.wind * Math.sin(windMath);

	course = cyclical(Math.atan2(courseX - windX, courseY - windY) * toDeg);

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

	const distance = calcLLdistance(states.latitude, states.longitude, pattern[leg][0], pattern[leg][1]);

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
            autoland.active = true;
        }
    }

	document.getElementById("leg").value = legs[leg];
	document.getElementById("lat").value = pattern[leg][0];
	document.getElementById("long").value = pattern[leg][1];
	document.getElementById("hdg").value = cyclical(hdgs[leg]);

	flyto.active = true;
});

const autoland = new autofunction("autoland", 500, ["onrunway", "latitude", "longitude", "altitude", "groundspeed"], states => {
    const lat = parseFloat(document.getElementById("latref").value);
	const long = parseFloat(document.getElementById("longref").value);
    const alt = parseInt(document.getElementById("altref").value);
    const vpa = parseFloat(document.getElementById("vparef").value);
    const touchdown = parseInt(document.getElementById("touchdown").value);

    if(autoland.stage === 0){
        autoland.stage++;
        document.getElementById("leg").value = "f";
        document.getElementById("flcmode").value = "v";
    }

    const finalDistance = touchdown + 6076.12 * calcLLdistance(states.latitude, states.longitude, lat, long); // nm to ft
    const altDiffrence = alt - states.altitude;

    const currentVPA = -Math.atan(altDiffrence / finalDistance) * toDeg;
    const VPADiffrence = currentVPA - vpa;

    let vpaout = vpa + 2 * VPADiffrence;
    vpaout = Math.round(vpaout * 10) / 10;

    if(vpaout > vpa + 1){
        vpaout = vpa + 1;
    }
    else if(vpaout < vpa - 1){
        vpaout = 0;
    }

    document.getElementById("flcinput").value = vpaout;

    write("spoilers", 2);
    write("alt", alt);

    if(states.altitude - alt > 100){
        levelchange.active = true;
    }

	autospeed.active = !states.onrunway;
    flypattern.active = true;
    autoflaps.active = true;
    autogear.active = true;
});

const goaround = new autofunction("goaround", -1, [], states => {
    autoland.error();
    
    let alt = parseInt(document.getElementById("climbalt").value);
    const spd = parseInt(document.getElementById("climbspd").value);
    const field = parseInt(document.getElementById("altref").value);

    document.getElementById("flcmode").value = "g";
    document.getElementById("flcinput").value = 500;

    const inmsl = document.getElementById("climbtype").value === "msl";
	const agl = Math.round(field / 100) * 100;
    alt += inmsl ? 0:agl;

    write("spoilers", 0);
    write("spd", spd);
    write("spdon", true);
    write("alt", alt);

    setTimeout(() => {levelchange.active = true;}, 500);
    autoflaps.active = true;
    autogear.active = true;
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

	let climbalt = parseInt(document.getElementById("climbalt").value);

	if(isNaN(climbalt)){
		takeoffconfig.error();
		return;
	}

	autoflaps.run();
	autolights.run();

    const inmsl = document.getElementById("climbtype").value === "msl";
	const agl = Math.round(states.altitude / 100) * 100;
    climbalt += inmsl ? 0:agl;

	write("alt", climbalt);
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
    const n1 = 2 * parseInt(document.getElementById("climbn1").value) - 100;

	if(isNaN(rotate) || isNaN(climbspd) || isNaN(flcinput) || isNaN(n1)){
		autotakeoff.error();
		return;
	}

    const spool = document.getElementById("takeoffspool").checked;

	if(stage === 0){
		if(!states.onrunway){
			autotakeoff.error();
			return;
		}

		takeoffconfig.run();
		levelchange.active = false;

		autotrim.active = true;
		autolights.active = true;
		autogear.active = true;
		autoflaps.active = true;

		write("spd", climbspd);
		write("spoilers", 2);

		write("autopilot", true);
		write("alton", true);
		write("vson", false);
		write("hdgon", true);

        write("throttle", spool ? -20:n1);

		stage++;
	}
	else if(stage === 1){
		write("vson", true);

		if(states.n1 === null){
			write("throttle", n1);
			stage++;
		}
        else if(spool && states.n1 >= 40){
            write("throttle", n1);
            stage++;
        }
        else if(!spool){
            stage++;
        }
	}
	else if(stage === 2){
		if(states.airspeed >= rotate){
			write("vs", flcinput / 2);
            stage++;
		}
	}
    else if(stage === 3){
        if(states.altitudeAGL > 50){
			levelchange.active = true;
			stage++;
		}
    }
	else if(stage === 4){
		if(Math.abs(climbspd - states.airspeed) < 10){
			if(document.getElementById("takeoffnav").checked){
                write("navon", true);
            }

			write("spdon", true);
			write("spoilers", 0);
			autospeed.active = true;
			stage++;
		}
	}
	else{
		write("spdon", true);
		autotakeoff.active = false;
	}

	autotakeoff.stage = stage;
});

const autobrakeSwitchReset = new autofunction("abswitchreset", 1000, ["leftbrake", "rightbrake", "autobrakes", "onground", "groundspeed"], states => {		
	if(states.groundspeed > 30 && states.onground && states.autobrakes !== 0 && (states.leftbrake > 0.3 || states.rightbrake > 0.3)){
		write("autobrakes", 0);
	}
});

const autospeed = new autofunction("autospeed", 1000, ["onground", "airspeed", "verticalspeed", "altitudeAGL", "throttle", "latitude", "longitude"], states => {
	const lat = parseFloat(document.getElementById("latref").value);
	const long = parseFloat(document.getElementById("longref").value);
    const climbspd = parseInt(document.getElementById("climbspd").value);
    const landingspd = parseInt(document.getElementById("landingspd").value);
    const cruisespd = parseInt(document.getElementById("cruisespd").value);

    if (states.onground) {
        autospeed.error();
        return;
    }

	if (isNaN(climbspd) || isNaN(landingspd) || isNaN(cruisespd)) {
		autospeed.error();
		return;
	}

	let stage = autospeed.stage;

	if (stage === 0 && states.altitudeAGL > 10000) {
        autospeed.error();
		return;
    }

	const distance = calcLLdistance(states.latitude, states.longitude, lat, long);
	
    if (states.verticalspeed < -500 && states.altitudeAGL <= 5000 && distance <= 7) { // Landing
		if (stage === 3) {
			write("spdon", false);
			write("throttle", -80);
			stage++;
		}
		else if (stage === 4) {
			if (distance <= 4) {
				write("spd", landingspd);
				if(Math.abs(states.airspeed - landingspd) < 5) {
					write("spdon", true);
				}
			} else if (distance <= 6) {
				write("spd", (landingspd + 20));
				if(Math.abs(states.airspeed - (landingspd + 20) < 5)) {
					write("spdon", true);
				}
			} else if (distance <= 7) {
				write("spd", (landingspd + 40));
				if(Math.abs(states.airspeed - (landingspd + 40) < 5)) {
					write("spdon", true);
				}
			}
		}
    }

    if (states.verticalspeed > 500 && states.altitudeAGL <= 10000 && Math.abs(climbspd - states.airspeed) < 10 && stage === 0) { // Climb (below 10k)
        write("spd", climbspd);
        write("spdon", true);
        stage++;
    }

    if (states.verticalspeed > 500 && states.altitudeAGL > 10000) { // Climb (above 10k)
        if(stage === 1) {
            write("spdon", false);
            write("throttle", (states.throttle + 30));
            stage++;
        }

        if(stage === 2) {
            if(Math.abs(cruisespd - states.airspeed) < 6) {
                write("spd", cruisespd);
                write("spdon", true);
                stage++;
            }
        }
    }

    autospeed.stage = stage;
});

const autofunctions = [autotrim, autolights, autogear, autoflaps, levelchange, markposition, setrunway, flyto, flypattern, rejecttakeoff, takeoffconfig, autotakeoff, autoland, goaround, autospeed, autobrakeSwitchReset];