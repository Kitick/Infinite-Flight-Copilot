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

    constructor(button, inputs, delay, states, code = () => {}){
		this.#button = button;
        this.delay = delay;
		this.#numStates = states.length;
		this.inputs = inputs;
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
			const valid = this.getInputs();
			if(valid) {
				this.stage = 0;
            	this.run();
			} else {
				this.error();
			}
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
			const valid = this.getInputs();

            if(!this.#armed && wasArmed){
                this.updateButton();
            }

            if(this.delay === -1){
                this.active = false;
            }

            if(this.active && valid){
                this.#timeout = setTimeout(() => {this.run();}, this.delay);
            }
        });
	}

	#readStates(callback = () => {}){
		if(this.#numStates === 0){
			callback();
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

	getInputs() {
		let valid = true;
		for(let i in this.inputs) {
			const input = document.getElementById(i);
			const value = parseFloat(input.value);
			if(isNaN(value)) {
				input.classList.add("error");
				setTimeout(() => {input.classList.remove("error");}, 2000);
				valid = false;
			} else {
				this.inputs[i] = parseFloat(input.value);
			}
		}
		return valid;
	}
}

const autotrim = new autofunction("trim", {}, 1000, ["pitch", "trim", "onground"], states => {
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

const autolights = new autofunction("lights", {}, 2000, ["altitudeAGL", "onground", "onrunway"], states => {
	write("master", true);
	write("beaconlights", true);
	write("navlights", true);

	if(states.onground){
		write("strobelights", states.onrunway);
		write("landinglights", states.onrunway);
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

const autogear = new autofunction("gear", {}, 1000, ["gear", "altitudeAGL", "verticalspeed"], states => {
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

const autoflaps = new autofunction("flaps", {flaplow: 0, flaphigh: 0, flapto: 0}, 1000, ["flaps", "airspeed", "altitudeAGL", "verticalspeed", "flapcount", "onground", "onrunway"], states => {
	console.log(autoflaps.inputs.flaplow, autoflaps.inputs.flaphigh, autoflaps.inputs.flapto)
	if((autoflaps.inputs.flapto < 0 || autoflaps.inputs.flapto > states.flapcount - 1) || (autoflaps.inputs.flaphigh < autoflaps.inputs.flaplow)){
		autoflaps.error();
		return;
	}

	let newFlaps = states.flaps;

	if(states.onground){
		if(states.onrunway){
			newFlaps = autoflaps.inputs.flapto;
		}
		else{
			newFlaps = 0;
		}
	}
	else if(states.altitudeAGL >= 250){
		const count = states.flapcount - 1;

		const mod = (autoflaps.inputs.flaphigh - autoflaps.inputs.flaplow) / count;
		newFlaps = Math.round((autoflaps.inputs.flaphigh - states.airspeed) / mod);

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

const levelchange = new autofunction("levelchange", {flcinput: 0},1000, ["airspeed", "altitude", "alt"], states => {
	let input = levelchange.inputs.flcinput;

	const diffrence = states.alt - states.altitude;

	if(Math.abs(diffrence) < 100){
		levelchange.active = false;
		return;
	}

	if(document.getElementById("flcmode").value === "v"){
		input = 6076.12 * Math.tan(input * toRad);
	}

	const fpm = input * Math.sign(diffrence) * (states.airspeed / 60);
	write("vs", fpm);
});

const markposition = new autofunction("markposition", {}, -1, ["latitude", "longitude", "altitude", "heading"], states => {
	document.getElementById("latref").value = states.latitude;
	document.getElementById("longref").value = states.longitude;
	document.getElementById("hdgref").value = Math.round(states.heading);
    document.getElementById("altref").value = Math.round(states.altitude);
});

const setrunway = new autofunction("setrunway", {}, -1, ["route", "coordinates"], states => {
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

function validateNaN(...inputs){
    for(let i = 0, length = inputs.length; i < length; i++){
        if(isNaN(inputs[i])){
            return true;
        }
    }

    return false;
}

const toDeg = 180 / Math.PI;
const toRad = Math.PI / 180;

const flyto = new autofunction("flyto", {flytolat: 0, flytolong: 0}, 1000, ["latitude", "longitude", "variation", "groundspeed", "wind", "winddir"], states => {
	const hdgTarget = cyclical(parseInt(document.getElementById("flytohdg").value));

	const distance = calcLLdistance(states.latitude, states.longitude, flyto.inputs.flytolat, flyto.inputs.flytolong);

	if(distance < 1){
		flyto.active = false;
		return;
	}

    const deltaY = 60 * (flyto.inputs.flytolat - states.latitude);
	const deltaX = 60 * (flyto.inputs.flytolong - states.longitude) * Math.cos((states.latitude + flyto.inputs.flytolat) * 0.5 * toRad);
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

const flypattern = new autofunction("flypattern", {latref: 0, longref: 0, hdgref: 0, updist: 0, downwidth: 0, finallength: 0, turnconst: 0}, 1000, ["latitude", "longitude", "variation", "onrunway", "groundspeed"], states => {
	const legs = ["u", "c", "d", "b", "f"];

	let leg = legs.indexOf(document.getElementById("leg").value);
	const direction = document.getElementById("direction").value === "r" ? 1:-1;

	const hdg90 = flypattern.inputs.hdgref + 90 * direction;
	const hdgs = [flypattern.inputs.hdgref, hdg90, flypattern.inputs.hdgref + 180, hdg90 + 180, flypattern.inputs.hdgref];

	let pattern = [];
	pattern[0] = calcLLfromHD(flypattern.inputs.latref, flypattern.inputs.longref, flypattern.inputs.hdgref, flypattern.inputs.updist + 1.5, states.variation);
	pattern[1] = calcLLfromHD(pattern[0][0], pattern[0][1], hdg90, flypattern.inputs.downwidth, states.variation);
	pattern[3] = calcLLfromHD(flypattern.inputs.latref, flypattern.inputs.longref, flypattern.inputs.hdgref + 180, flypattern.inputs.finallength, states.variation);
	pattern[2] = calcLLfromHD(pattern[3][0], pattern[3][1], hdg90, flypattern.inputs.downwidth, states.variation);
	pattern[4] = [flypattern.inputs.latref, flypattern.inputs.longref];

	const distance = calcLLdistance(states.latitude, states.longitude, pattern[leg][0], pattern[leg][1]);

	const speed = states.groundspeed / 60; // kts to nm/m
	const turnrate = (flypattern.inputs.turnconst / states.groundspeed) * 60 * toRad; // deg/s to rad/m

	if(distance < speed / turnrate){
		if(leg !== 4 || (leg === 4 && distance < 1)){
			leg = (leg + 1) % 5;
		}
	}

    if(leg === 4 && document.getElementById("approach").checked){
        autoland.active = true;
    }

	document.getElementById("leg").value = legs[leg];
	document.getElementById("flytolat").value = pattern[leg][0];
	document.getElementById("flytolong").value = pattern[leg][1];
	document.getElementById("flytohdg").value = cyclical(hdgs[leg]);

	flyto.active = true;
});

const autoland = new autofunction("autoland", {latref: 0, longref: 0, altref: 0, vparef: 0, touchdown: 0}, 500, ["latitude", "longitude", "altitude", "groundspeed"], states => {
    if(autoland.stage === 0){
        document.getElementById("leg").value = "f";
        document.getElementById("flcmode").value = "v";
        autoland.stage++;
    }

    const finalDistance = autoland.inputs.touchdown + 6076.12 * calcLLdistance(states.latitude, states.longitude, autoland.inputs.latref, autoland.inputs.longref); // nm to ft
    const altDiffrence = autoland.inputs.altref - states.altitude;

    const currentVPA = -Math.atan(altDiffrence / finalDistance) * toDeg;
    const VPADiffrence = currentVPA - autoland.inputs.vpa;

    let vpaout = autoland.inputs.vpa + 2 * VPADiffrence;
    vpaout = Math.round(vpaout * 10) / 10;

    if(vpaout > autoland.inputs.vpa + 1){
        vpaout = autoland.inputs.vpa + 1;
    }
    else if(vpaout < autoland.inputs.vpa - 1){
        vpaout = 0;
    }

    document.getElementById("flcinput").value = vpaout;

	if(!autospeed.active) {
		write("spoilers", 2);
	}
    write("alt", autoland.inputs.altref);

    if(states.altitude - autoland.inputs.altref > 100){
        levelchange.active = true;
    }

	autospeed.active = true;
    flypattern.active = true;
    autoflaps.active = true;
    autogear.active = true;
});

const goaround = new autofunction("goaround", {}, -1, [], states => {
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

const rejecttakeoff = new autofunction("reject", {}, -1, [], states => {
	if(autotakeoff.active){
		autotakeoff.error();
		write("throttle", -100);
	}
	else{
		rejecttakeoff.error();
	}
});

const takeoffconfig = new autofunction("takeoffconfig", {climbalt: 0}, -1, ["onrunway", "heading", "altitude"], states => {
	if(!states.onrunway){
		takeoffconfig.error();
		return;
	}

	autoflaps.run();
	autolights.run();

    const inmsl = document.getElementById("climbtype").value === "msl";
	const agl = Math.round(states.altitude / 100) * 100;
    takeoffconfig.inputs.climbalt += inmsl ? 0:agl;

	write("alt", takeoffconfig.inputs.climbalt);
	write("hdg", states.heading);
	write("vs", 0);

	write("spoilers", 0);
	write("autobrakes", 3);
	write("parkingbrake", false);
});

const autotakeoff = new autofunction("autotakeoff", {rotate: 0, climbspd: 0, climbthrottle: 0}, 500, ["onrunway", "n1", "airspeed", "altitude", "altitudeAGL"], states => {
    const throttle = 2 * autotakeoff.inputs.climbthrottle - 100;

    const spoolup = document.getElementById("takeoffspool").checked;

    let stage = autotakeoff.stage;

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

		write("spd", autotakeoff.inputs.climbspd);
		write("spoilers", 2);

		write("autopilot", true);
		write("alton", true);
		write("vson", false);
		write("hdgon", true);

        write("throttle", spoolup ? -20:throttle);

		stage++;
	}
	else if(stage === 1){
		write("vson", true);

		if(!spoolup){
            stage++;
        }
        else if(states.n1 === null){
			write("throttle", throttle);
			stage++;
		}
        else if(states.n1 >= 40){
            write("throttle", throttle);
            stage++;
        }
	}
	else if(stage === 2){
		if(states.airspeed >= autotakeoff.inputs.rotate){
            levelchange.active = true;
            stage++;
		}
	}
	else if(stage === 3){
		autospeed.active = true;
		if(states.airspeed > autotakeoff.inputs.climbspd - 10){
			if(document.getElementById("takeoffnav").checked){
                write("navon", true);
            }

			write("spoilers", 0);
			stage++;
		}
	}
	else{
		autotakeoff.active = false;
	}

	autotakeoff.stage = stage;
});

const autobrakeSwitchReset = new autofunction("abswitchreset", {}, 1000, ["leftbrake", "rightbrake", "autobrakes", "onground", "groundspeed"], states => {		
	if(states.groundspeed > 30 && states.onground && states.autobrakes > 0 && (states.leftbrake > 0.3 || states.rightbrake > 0.3)){
		write("autobrakes", 0);
	}
});

function controlThrottle(throttle, spd, spdDifference) {
	write("spdon", false);
	if(throttle > 0) {
		write("throttle", -80);
	} else {
		write("throttle", -100);
	}
	write("spd", spd);
	write("spoilers", 1)
	if(spdDifference) {
		write("spdon", true);
		write("spoilers", 2)
	}
}

const autospeed = new autofunction("autospeed", {latref: 0, longref: 0, climbspd: 0, spdref: 0, cruisespd: 0, cruisealt: 0}, 1000, ["onground", "airspeed", "verticalspeed", "altitudeAGL", "altitude", "throttle", "latitude", "longitude", "spd"], states => {
	const elevation = parseFloat(document.getElementById("altref").value);

    if(states.onground){
        autospeed.error();
        return;
    }

	const alt = isNaN(elevation) ? states.altitudeAGL : states.altitude - elevation

	let stage = autospeed.stage;

	if(stage === 0 && states.altitudeAGL > 10000){
        stage = 3;
    }

	if(states.airspeed >= states.spd + 10){
		write("spoilers", 1);
	} else if(states.airspeed <= states.spd + 10 && states.airspeed >= states.spd && states.airspeed > autospeed.inputs.spdref + 5){
		write("spoilers", 0);
	}
  
	const distance = calcLLdistance(states.latitude, states.longitude, autospeed.inputs.latref, autospeed.inputs.longref);
	
    if (states.verticalspeed < -500 && alt <= 5000 && distance <= 7) {
		    if (distance <= 4 && stage === 6) {
			      controlThrottle(states.throttle, autospeed.inputs.spdref, Math.abs(states.airspeed - autospeed.inputs.spdref) < 5);
			      if (Math.abs(states.airspeed - autospeed.inputs.spdref) < 5) {
				        stage++;
			      }
		    } else if (distance <= 6 && stage === 5) {
			      controlThrottle(states.throttle, (autospeed.inputs.spdref + 20), Math.abs(states.airspeed - (autospeed.inputs.spdref + 20)) < 5)
			      if (Math.abs(states.airspeed - (autospeed.inputs.spdref + 20)) < 5) {
				        stage++;
			      }
		    } else if (distance <= 7 && stage === 4) {
			      controlThrottle(states.throttle, (autospeed.inputs.spdref + 40), Math.abs(states.airspeed - (autospeed.inputs.spdref + 40)) < 5)
			      if (Math.abs(states.airspeed - (autospeed.inputs.spdref + 40)) < 5) {
				        stage++;
			      }
		    }
	}

	if(states.verticalspeed < -500 && alt <= 12000 && alt >= 10000 && stage === 3){
		write("spd", 250);
		stage++;
	}

    if(states.verticalspeed > 500 && alt <= 10000 && Math.abs(autospeed.inputs.climbspd - states.airspeed) < 10 && stage === 0){
        write("spd", autospeed.inputs.climbspd);
        write("spdon", true);
		    if(autospeed.inputs.cruisealt > 10000) {
			      stage++;
		    } else {
			      stage = 4;
        }
    }

    if(states.verticalspeed > 500 && alt > 10000){
        if(stage === 1){
            write("spdon", false);
			      write("spd", autospeed.inputs.cruisespd);
            write("throttle", (states.throttle + 30));
            stage++;
        }

        if(stage === 2){
            if(Math.abs(autospeed.inputs.cruisespd - states.airspeed) < 6){
                write("spd", autospeed.inputs.cruisespd);
                write("spdon", true);
                stage++;
            }
        }
    }

    autospeed.stage = stage;
});

function showfpl(id, waypoint, div){
	const input = document.createElement("input");
	const br = document.createElement("br");
	input.type = "number";
	input.id = id;
	div.innerHTML += ` ${waypoint}`;
	div.appendChild(input);
	div.appendChild(br)
}

const updatefpl = new autofunction("updatefpl", {}, -1, ["fplinfo"], states => {
	const fplinfo = JSON.parse(states.fplinfo);
	const flightPlanItems = fplinfo.detailedInfo.flightPlanItems;

	let div = document.getElementById("waypoints");
	div.innerHTML = "";

	let counter = 0;

	for(let i = 0; i < flightPlanItems.length; i++) {
		let waypoint;
		if(flightPlanItems[i].children === null){
			waypoint = fplinfo.detailedInfo.waypoints[i];
			showfpl(counter, waypoint, div);
			counter++;
		} else {
			for(let j = 0; j < flightPlanItems[i].children.length; j++){
				waypoint = flightPlanItems[i].children[j].identifier;
				showfpl(counter, waypoint, div);
				counter++;
			}
		}
	}
})

const vnav = new autofunction("vnav", {}, 1000, ["fplinfo", "onground", "autopilot", "airspeed", "groundspeed", "altitude", "vnav", "vs", "latitude", "longitude"], states => {
	const fplinfo = JSON.parse(states.fplinfo);
	const nextWaypoint = fplinfo.waypointName; 
	const flightPlanItems = fplinfo.detailedInfo.flightPlanItems;
	const remainingNMdiv = document.getElementById("remainingNM");
	const nextAltitudeRestriction = [];
	const nextRestrictionLatLong = [];
	let nextWaypointIndex;
	let nextWaypointId;
	let nextWaypointAltitude;
	let nextAltitudeRestrictionDistance;
	let stage = vnav.stage;

	if(states.onground || !states.autopilot || states.vnav || levelchange.active) {
		vnav.error();
	}

	for(let i = 0, length = flightPlanItems.length; i < length; i++) {
		if(flightPlanItems[i].children === null){
			if(flightPlanItems[i].identifier === nextWaypoint || flightPlanItems[i].name === nextWaypoint) {
				nextWaypointIndex = i;
				nextWaypointAltitude = flightPlanItems[i].altitude;
			}
			if(i >= nextWaypointIndex && flightPlanItems[i].altitude !== -1) {
				nextAltitudeRestriction.push(flightPlanItems[i].altitude);
				nextRestrictionLatLong.push([flightPlanItems[i].location.Latitude, flightPlanItems[i].location.Longitude]);
			}
		} else {
			for(let j = 0; j < flightPlanItems[i].children.length; j++){
				if(flightPlanItems[i].children[j].identifier === nextWaypoint){
					nextWaypointIndex = i+j;
					nextWaypointId = i;
					nextWaypointAltitude = flightPlanItems[i].children[j].altitude;
				}
				if(i >= nextWaypointId && flightPlanItems[i].children[j].altitude !== -1) {
					nextAltitudeRestriction.push(flightPlanItems[i].children[j].altitude);
					nextRestrictionLatLong.push([flightPlanItems[i].children[j].location.Latitude, flightPlanItems[i].children[j].location.Longitude]);
				}
			}
		}
	}

	if(nextWaypointAltitude === -1) {
		nextAltitudeRestrictionDistance = calcLLdistance(fplinfo.nextWaypointLatitude, fplinfo.nextWaypointLongitude, nextRestrictionLatLong[0][0], nextRestrictionLatLong[0][1]);
	}

	if(nextWaypointAltitude !== -1) {
		const altDiffrence = nextWaypointAltitude - states.altitude;
		const fpm = altDiffrence / fplinfo.eteToNext;
		if(fpm < 1000 && fpm > -1000) {
			const minimumNM = fpm > 0 ? (altDiffrence / 1000) * (60 / states.groundspeed) * 10 : (altDiffrence / -1000) * (60 / states.groundspeed) * 10;
			const remainingNM = fplinfo.distanceToNext - minimumNM - 2;
			remainingNMdiv.innerText = `VNAV starting in ${Math.round(remainingNM)}NM`;
		} else {
			write("alt", nextWaypointAltitude);
			write("vs", fpm);
			remainingNMdiv.innerText = "";
		}
	} else {
		const altDiffrence = nextAltitudeRestriction[0] - states.altitude;
		const eteToNext = ((fplinfo.distanceToNext + nextAltitudeRestrictionDistance) / states.groundspeed) * 60;
		const fpm = altDiffrence / eteToNext;
		if(fpm < 1000 && fpm > -1000) {
			const minimumNM = fpm > 0 ? (altDiffrence / 1000) * (60 / states.groundspeed) * 10 : (altDiffrence / -1000) * (60 / states.groundspeed) * 10;
			const remainingNM = nextAltitudeRestrictionDistance - minimumNM - 2;
			remainingNMdiv.innerHTML = `VNAV starting in ${Math.round(remainingNM)}NM`;
		} else {
			write("alt", nextAltitudeRestriction[0]);
			write("vs", fpm);
			remainingNMdiv.innerHTML = "";
		}
	}

	vnav.stage = stage;

	const nextWaypointSpeed = document.getElementById(nextWaypointIndex).value;

	if(nextWaypointSpeed !== ""){
		if(fplinfo.distanceToNext <= 10){
			write("spd", nextWaypointSpeed);
		}
	}
})

speechSynthesis.getVoices();

function speak(text){
	text = text.toString()
	const select = document.getElementById("voices");
	const voices = speechSynthesis.getVoices();
	const voiceIndex = select.selectedIndex;
	const voiceRate = document.getElementById("utterancerate").value;
	const utterance = new SpeechSynthesisUtterance(text);
	utterance.rate = voiceRate;
    utterance.voice = voices[voiceIndex];
	speechSynthesis.speak(utterance);
}

const callout = new autofunction("callout", {rotate: 0, utterancerate: 0, minumuns: 0}, 100, ["onrunway", "airspeed", "verticalspeed", "throttle", "gear", "altitudeAGL", "altitude"], states => {
	const v1 = callout.inputs.rotate - 10;
	const v2 = callout.inputs.rotate + 10;
	const elevation = parseFloat(document.getElementById("altref").value);

    const alt = isNaN(elevation) ? states.altitudeAGL : states.altitude - elevation;
	
    let stage = callout.stage;

	if(stage === 0){
		callout.flags = [false, false, false, false, false, false, false, false];
		stage++;
	}
	
	if(stage === 1 && states.airspeed >= v1 && states.onrunway && states.throttle > 40){
		speak("V1");
        stage++;
	}
    else if(stage === 2 && states.airspeed >= callout.inputs.rotate && states.onrunway && states.throttle > 40){
		speak("Rotate");
        stage++;
	}
    else if(stage === 3 && states.airspeed >= v2 && states.throttle > 40){
        speak("V2");
        stage++;
	}
	
	if(!speechSynthesis.speaking && states.verticalspeed < -500 && !states.gear && alt <= 1000) {
		speak("Landing Gear");
	}

    if(!speechSynthesis.speaking && states.verticalspeed < -500 && alt <= callout.inputs.minumuns + 10 && alt >= callout.inputs.minumuns) {
		speak("Minimums");
	}

    const alts = [1000, 500, 100, 50, 40, 30, 20, 10];

    if(states.verticalspeed < -500){
        for(let i = 0, length = alts.length - 1; i < length; i++) {
            if(!speechSynthesis.speaking && alt <= alts[i] && alt > alts[i + 1] && !callout.flags[i]){
                speak(alts[i]);
				callout.flags[i] = true;
                break;
            }
        }
    }

    callout.stage = stage;
})

const autofunctions = [autotrim, autolights, autogear, autoflaps, levelchange, markposition, setrunway, flyto, flypattern, rejecttakeoff, takeoffconfig, autotakeoff, autoland, goaround, autospeed, autobrakeSwitchReset, vnav, callout, updatefpl];
