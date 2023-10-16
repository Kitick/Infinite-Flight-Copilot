const autotrim = new autofunction("trim", 1000, [], ["pitch", "trim", "onground"], [], data => {
    const states = data.states;

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

const autolights = new autofunction("lights", 2000, [], ["altitudeAGL", "onground", "onrunway"], [], data => {
    const states = data.states;

    write("master", true);
    write("beaconlights", true);
    write("navlights", true);

    if(states.onground){
        write("strobelights", states.onrunway);
        write("landinglights", states.onrunway);
    }
    else{
        write("strobelights", true);

        if(states.altitudeAGL < 1000){write("landinglights", true);}
        else{write("landinglights", false);}
    }
});

const autogear = new autofunction("gear", 1000, [], ["gear", "altitudeAGL", "verticalspeed"], [], data => {
    const states = data.states;

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

const autobrakeSwitchReset = new autofunction("abswitchreset", 1000, [], ["leftbrake", "rightbrake", "autobrakes", "onground", "groundspeed"], [], data => {
    const states = data.states;

    if(states.groundspeed > 30 && states.onground && states.autobrakes > 0 && (states.leftbrake > 0.3 || states.rightbrake > 0.3)){
        write("autobrakes", 0);
    }
});

const autoflaps = new autofunction("flaps", 1000, ["flaplow", "flaphigh", "flapto"], ["flaps", "airspeed", "altitudeAGL", "verticalspeed", "flapcount", "onground", "onrunway"], [], data => {
    const inputs = data.inputs;
    const states = data.states;

    if((inputs.flapto < 0 || inputs.flapto > states.flapcount - 1) || (inputs.flaphigh < inputs.flaplow)){
        autoflaps.error();
        return;
    }

    let newFlaps = states.flaps;

    if(states.onground){
        if(states.onrunway){
            newFlaps = inputs.flapto;
        }
        else{
            newFlaps = 0;
        }
    }
    else if(states.altitudeAGL >= 250){
        const count = states.flapcount - 1;

        const mod = (inputs.flaphigh - inputs.flaplow) / count;
        newFlaps = Math.round((inputs.flaphigh - states.airspeed) / mod);

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

const autospoilers = new autofunction("spoilers", 1000, [], ["spoilers", "airspeed", "spd", "altitude", "vs"], [], data => {
    const inputs = data.inputs;
    const states = data.states;

    let spoilers = 0;
    if(states.airspeed - states.spd >= 25 && states.altitude < 28000 && states.vs){spoilers = 1;}
    else if(states.airspeed - inputs.spdref <= 10){spoilers = 2;}

    if(spoilers !== states.spoilers){write("spoilers", spoilers);}
});

const levelchange = new autofunction("levelchange", 1000, ["flcinput", "flcmode"], ["airspeed", "altitude", "alt"], [], data => {
    const inputs = data.inputs;
    const states = data.states;

    let input = inputs.flcinput;

    const diffrence = states.alt - states.altitude;

    if(Math.abs(diffrence) < 100){
        levelchange.active = false;
        return;
    }

    if(inputs.flcmode === "v"){
        input = 6076.12 * Math.tan(input * toRad);
    }

    const fpm = input * Math.sign(diffrence) * (states.airspeed / 60);
    write("vs", fpm);
});

const markposition = new autofunction("markposition", -1, [], ["latitude", "longitude", "altitude", "heading"], [], data => {
    const states = data.states;

    document.getElementById("latref").value = states.latitude;
    document.getElementById("longref").value = states.longitude;
    document.getElementById("hdgref").value = Math.round(states.heading);
    document.getElementById("altref").value = Math.round(states.altitude);
});

const setrunway = new autofunction("setrunway", -1, [], ["route", "coordinates"], [], data => {
    const states = data.states;

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

const flyto = new autofunction("flyto", 1000, ["flytolat", "flytolong", "flytohdg"], ["latitude", "longitude", "variation", "groundspeed", "wind", "winddir"], [], data => {
    const inputs = data.inputs;
    const states = data.states;

    const hdgTarget = cyclical(inputs.flytohdg);
    const distance = calcLLdistance(states.latitude, states.longitude, inputs.flytolat, inputs.flytolong);

    if(distance < 1){
        flyto.active = false;
        return;
    }

    const deltaY = 60 * (inputs.flytolat - states.latitude);
    const deltaX = 60 * (inputs.flytolong - states.longitude) * Math.cos((states.latitude + inputs.flytolat) * 0.5 * toRad);
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

const flypattern = new autofunction("flypattern", 1000, ["latref", "longref", "hdgref", "updist", "downwidth", "finallength", "turnconst", "leg", "direction", "approach"], ["latitude", "longitude", "variation", "onrunway", "groundspeed"], [], data => {
    const inputs = data.inputs;
    const states = data.states;

    const legs = ["u", "c", "d", "b", "f"];

    let leg = legs.indexOf(inputs.leg);
    const direction = inputs.direction === "r" ? 1 : -1;

    const hdg90 = inputs.hdgref + 90 * direction;
    const hdgs = [inputs.hdgref, hdg90, inputs.hdgref + 180, hdg90 + 180, inputs.hdgref];

    let pattern = [];
    pattern[0] = calcLLfromHD(inputs.latref, inputs.longref, inputs.hdgref, inputs.updist + 1.5, states.variation);
    pattern[1] = calcLLfromHD(pattern[0][0], pattern[0][1], hdg90, inputs.downwidth, states.variation);
    pattern[3] = calcLLfromHD(inputs.latref, inputs.longref, inputs.hdgref + 180, inputs.finallength, states.variation);
    pattern[2] = calcLLfromHD(pattern[3][0], pattern[3][1], hdg90, inputs.downwidth, states.variation);
    pattern[4] = [inputs.latref, inputs.longref];

    const distance = calcLLdistance(states.latitude, states.longitude, pattern[leg][0], pattern[leg][1]);

    const speed = states.groundspeed / 60; // kts to nm/m
    const turnrate = (inputs.turnconst / states.groundspeed) * 60 * toRad; // deg/s to rad/m

    if(distance < speed / turnrate){
        if(leg !== 4 || (leg === 4 && distance < 1)){
            leg = (leg + 1) % 5;
        }
    }

    if(leg === 4 && inputs.approach){
        autoland.active = true;
    }

    document.getElementById("leg").value = legs[leg];
    document.getElementById("flytolat").value = pattern[leg][0].toFixed(8);
    document.getElementById("flytolong").value = pattern[leg][1].toFixed(8);
    document.getElementById("flytohdg").value = cyclical(hdgs[leg]);

    flyto.active = true;
});

const autospeed = new autofunction("autospeed", 1000, ["latref", "longref", "climbspd", "spdref", "cruisespd", "cruisealt"], ["onground", "airspeed", "verticalspeed", "altitudeAGL", "altitude", "throttle", "latitude", "longitude", "spd"], [], data => {
    const inputs = data.inputs;
    const states = data.states;

    if(states.onground){
        autospeed.arm();
        return;
    }

    // elevation is optional
    const elevation = parseFloat(document.getElementById("altref").value);
    const alt = isNaN(elevation) ? states.altitudeAGL : states.altitude - elevation;

    let stage = autospeed.stage;

    if(stage === 0 && states.altitudeAGL > 10000){
        stage = 3;
    }

    const distance = calcLLdistance(states.latitude, states.longitude, inputs.latref, inputs.longref);

    if(states.verticalspeed < -500 && alt <= 4000 && distance <= 7){
        if(distance <= 4 && stage === 6){
            controlThrottle(states.throttle, inputs.spdref, Math.abs(states.airspeed - inputs.spdref) < 5);

            if(Math.abs(states.airspeed - inputs.spdref) < 5){stage++;}
        }
        else if(distance <= 6 && stage === 5){
            controlThrottle(states.throttle, (inputs.spdref + 20), Math.abs(states.airspeed - (inputs.spdref + 20)) < 5);
            
            if(Math.abs(states.airspeed - (inputs.spdref + 20)) < 5){stage++;}
        }
        else if(distance <= 7 && stage === 4){
            controlThrottle(states.throttle, (inputs.spdref + 40), Math.abs(states.airspeed - (inputs.spdref + 40)) < 5);
            
            if(Math.abs(states.airspeed - (inputs.spdref + 40)) < 5){stage++;}
        }
    }

    if(states.verticalspeed < -500 && alt <= 12000 && alt >= 10000 && stage === 3){
        write("spd", 250);
        stage++;
    }

    if(states.verticalspeed > 500 && alt <= 10000 && Math.abs(inputs.climbspd - states.airspeed) < 10 && stage === 0){
        write("spd", inputs.climbspd);
        write("spdon", true);
        if(inputs.cruisealt > 10000){
            stage++;
        } else{
            stage = 4;
        }
    }

    if(states.verticalspeed > 500 && alt > 10000){
        if(stage === 1){
            write("spdon", false);
            write("spd", inputs.cruisespd);
            write("throttle", (states.throttle + 30));
            stage++;
        }

        if(stage === 2){
            if(Math.abs(inputs.cruisespd - states.airspeed) < 6){
                write("spd", inputs.cruisespd);
                write("spdon", true);
                stage++;
            }
        }
    }

    autospeed.stage = stage;
});

const goaround = new autofunction("goaround", -1, ["climbalt", "climbspd", "climbtype"], ["altitude"], [levelchange, autoflaps, autogear], data => {
    const inputs = data.inputs;
    const states = data.states;

    autoland.error();

    document.getElementById("flcmode").value = "g";
    document.getElementById("flcinput").value = 500;

    let alt = inputs.climbalt;
    const inmsl = inputs.climbtype === "msl";
    const agl = Math.round(states.altitude / 100) * 100;
    alt += inmsl ? 0 : agl;

    write("spoilers", 0);
    write("spd", inputs.climbspd);
    write("spdon", true);
    write("alt", alt);

    setTimeout(() => {levelchange.active = true;}, 500);
    autoflaps.active = true;
    autogear.active = true;
});

const autoland = new autofunction("autoland", 500, ["latref", "longref", "altref", "vparef", "flare", "touchdown", "option"], ["latitude", "longitude", "altitude", "groundspeed", "onrunway"], [levelchange, autoflaps, autogear, autospeed, flypattern, goaround], data => {
    const inputs = data.inputs;
    const states = data.states;

    if(autoland.stage === 0){
        document.getElementById("leg").value = "f";
        document.getElementById("flcmode").value = "v";
        autoland.stage++;
    }

    const finalDistance = inputs.touchdown + 6076.12 * calcLLdistance(states.latitude, states.longitude, inputs.latref, inputs.longref); // nm to ft
    const altDiffrence = inputs.altref - states.altitude;

    const currentVPA = -Math.atan(altDiffrence / finalDistance) * toDeg;
    const VPADiffrence = currentVPA - inputs.vparef;

    let vpaout = inputs.vparef + 2 * VPADiffrence;
    vpaout = Math.round(vpaout * 10) / 10;

    if(vpaout > inputs.vparef + 1){
        vpaout = inputs.vparef + 1;
    }
    else if(vpaout < inputs.vparef - 1){
        vpaout = 0;
    }

    document.getElementById("flcinput").value = vpaout;

    if(!autospeed.active){
        write("spoilers", 2);
    }

    const stopalt = inputs.altref + inputs.flare;

    write("alt", stopalt);

    if(states.altitude - inputs.altref > 100){
        levelchange.active = true;
    }

    const type = inputs.option;

    if(states.altitude - stopalt < 50){
        autospeed.active = false;
        levelchange.active = false;

        document.getElementById("flcmode").value = "g";
        document.getElementById("flcinput").value = 500;

        if(type === "p"){
            autoland.active = false;
            setTimeout(() => {goaround.active = true;}, 6000);
        }
        else if(type === "l"){
            autoland.active = false;
            write("spd", 0);
        }
        else if(type === "t"){
            write("spd", 0);

            if(states.onrunway){
                autoland.active = false;
                setTimeout(() => {autotakeoff.active = true;}, 3000);
            }
        }
        else if(type === "s"){
            write("spd", 0);

            if(states.groundspeed < 1){
                autoland.active = false;
                autotakeoff.active = true;
            }
        }
    }
    else{
        autospeed.active = true;
        flypattern.active = true;
        autoflaps.active = true;
        autogear.active = type !== "p";
    }
});

const rejecttakeoff = new autofunction("reject", -1, [], [], [], data => {
    if(autotakeoff.active){
        autotakeoff.error();
        write("throttle", -100);
    }
    else{
        rejecttakeoff.error();
    }
});

const takeoffconfig = new autofunction("takeoffconfig", -1, ["climbalt", "climbtype"], ["onrunway", "heading", "altitude"], [autoflaps, autolights], data => {
    const inputs = data.inputs;
    const states = data.states;

    if(!states.onrunway){
        takeoffconfig.error();
        return;
    }

    autoflaps.setActive();
    autolights.setActive();

    autoflaps.setActive();
    autolights.setActive();

    const inmsl = inputs.climbtype === "msl";
    const agl = Math.round(states.altitude / 100) * 100;
    inputs.climbalt += inmsl ? 0 : agl;

    write("alt", inputs.climbalt);
    write("hdg", states.heading);
    write("vs", 0);

    write("spoilers", 0);
    write("autobrakes", 3);
    write("parkingbrake", false);
});

const autotakeoff = new autofunction("autotakeoff", 500, ["rotate", "climbspd", "climbthrottle", "takeoffspool", "takeofflnav", "takeoffvnav"], ["onrunway", "n1", "airspeed", "altitude", "altitudeAGL"], [takeoffconfig, levelchange, autospeed, autotrim, autolights, autogear, autoflaps, rejecttakeoff], data => {
    const inputs = data.inputs;
    const states = data.states;

    const throttle = 2 * inputs.climbthrottle - 100;

    let stage = autotakeoff.stage;

    if(stage === 0){
        if(!states.onrunway){
            autotakeoff.error();
            return;
        }

        takeoffconfig.active = true;
        levelchange.active = false;

        autotrim.active = true;
        autolights.active = true;
        autogear.active = true;
        autoflaps.active = true;

        write("spd", inputs.climbspd);
        write("spoilers", 2);

        write("autopilot", true);
        write("alton", true);
        write("vson", false);
        write("hdgon", true);

        write("throttle", inputs.takeoffspool ? -20 : throttle);

        stage++;
    }
    else if(stage === 1){
        write("vson", true);

        if(!inputs.takeoffspool){
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
        if(states.airspeed >= inputs.rotate){
            levelchange.active = true;
            stage++;
        }
    }
    else if(stage === 3){
        autospeed.active = true;
        if(inputs.climbspd - states.airspeed < 10){
            if(inputs.takeofflnav){
                write("navon", true);
            }

            if(document.getElementById("takeoffvnav").checked){
                vnav.active = true;
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

const updatefpl = new autofunction("updatefpl", -1, [], ["fplinfo"], [], data => {
    const states = data.states;

    const fplinfo = JSON.parse(states.fplinfo);
	const flightPlanItems = fplinfo.detailedInfo.flightPlanItems;

	let div = document.getElementById("waypoints");
	div.innerHTML = "";

	for(let i = 0; i < flightPlanItems.length; i++) {
		let waypoint;
		if(flightPlanItems[i].children === null){
			waypoint = fplinfo.detailedInfo.waypoints[i];
			showfpl(`index${i}children0`, waypoint, div);
		} else {
			for(let j = 0; j < flightPlanItems[i].children.length; j++){
				waypoint = flightPlanItems[i].children[j].identifier;
				showfpl(`index${i}children${j}`, waypoint, div);
			}
		}
	}
});

const vnav = new autofunction("vnav", 1000, [], ["fplinfo", "onground", "autopilot", "airspeed", "groundspeed", "altitude", "vnav", "vs", "latitude", "longitude"], [], data => {
    const states = data.states;

    const fplinfo = JSON.parse(states.fplinfo);
	const nextWaypoint = fplinfo.waypointName; 
	const flightPlanItems = fplinfo.detailedInfo.flightPlanItems;
	const nextAltitudeRestriction = [];
	const nextRestrictionLatLong = [];
	let nextWaypointIndex;
	let nextWaypointChildren;
	let nextWaypointAltitude;
	let nextAltitudeRestrictionDistance;
	let stage = vnav.stage;

	if(states.onground || !states.autopilot || states.vnav || levelchange.active) {
		vnav.error();
        return;
	}

    updatefpl.active = true;

	for(let i = 0, length = flightPlanItems.length; i < length; i++) {
		if(flightPlanItems[i].children === null){
			if(flightPlanItems[i].identifier === nextWaypoint || flightPlanItems[i].name === nextWaypoint) {
				nextWaypointIndex = i;
				nextWaypointChildren = 0;
				nextWaypointAltitude = flightPlanItems[i].altitude;
			}
			if(i >= nextWaypointIndex && flightPlanItems[i].altitude !== -1) {
				nextAltitudeRestriction.push(flightPlanItems[i].altitude);
				nextRestrictionLatLong.push([flightPlanItems[i].location.Latitude, flightPlanItems[i].location.Longitude]);
			}
		} else {
			for(let j = 0; j < flightPlanItems[i].children.length; j++){
				if(flightPlanItems[i].children[j].identifier === nextWaypoint){
					nextWaypointIndex = i;
					nextWaypointChildren = j;
					nextWaypointAltitude = flightPlanItems[i].children[j].altitude;
				}
				if(i >= nextWaypointIndex && j >= nextWaypointChildren && flightPlanItems[i].children[j].altitude !== -1) {
					nextAltitudeRestriction.push(flightPlanItems[i].children[j].altitude);
					nextRestrictionLatLong.push([flightPlanItems[i].children[j].location.Latitude, flightPlanItems[i].children[j].location.Longitude]);
				}
			}
		}
	}

	const nextWaypointSpeed = document.getElementById(`index${nextWaypointIndex}children${nextWaypointChildren}`).value;

	if(nextWaypointSpeed !== ""){
		if(fplinfo.distanceToNext <= 10){
			write("spd", nextWaypointSpeed);
		}
	}

	if(nextAltitudeRestriction.length === 0){
        speak("No altitude restriction, VNAV disabled");
        vnav.error();
		return;
	}

	if(nextWaypointAltitude !== -1) {
		const altDiffrence = nextWaypointAltitude - states.altitude;
		const fpm = altDiffrence / fplinfo.eteToNext;
		write("alt", nextWaypointAltitude);
		write("vs", fpm);
	} else {
		nextAltitudeRestrictionDistance = calcLLdistance(fplinfo.nextWaypointLatitude, fplinfo.nextWaypointLongitude, nextRestrictionLatLong[0][0], nextRestrictionLatLong[0][1]);
		const altDiffrence = nextAltitudeRestriction[0] - states.altitude;
		const eteToNext = ((fplinfo.distanceToNext + nextAltitudeRestrictionDistance) / states.groundspeed) * 60;
		const fpm = altDiffrence / eteToNext;
		write("alt", nextAltitudeRestriction[0]);
		write("vs", fpm);
	}

	vnav.stage = stage;
});

const callout = new autofunction("callout", 250, ["rotate", "utterancerate", "minumuns"], ["onrunway", "airspeed", "verticalspeed", "throttle", "gear", "altitudeAGL", "altitude"], [], data => {
    const inputs = data.inputs;
    const states = data.states;

    const v1 = inputs.rotate;
    const v2 = inputs.rotate + 10;

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
    else if(stage === 2 && states.airspeed >= inputs.rotate && states.onrunway && states.throttle > 40){
        speak("Rotate");
        stage++;
    }
    else if(stage === 3 && states.airspeed >= v2 && states.throttle > 40){
        speak("V2");
        stage++;
    }

    if(!speechSynthesis.speaking && states.verticalspeed < -500 && !states.gear && alt <= 1000){
        speak("Landing Gear");
    }

    if(!speechSynthesis.speaking && states.verticalspeed < -500 && alt <= inputs.minumuns + 10 && alt >= inputs.minumuns){
        speak("Minimums");
    }

    const alts = [1000, 500, 100, 50, 40, 30, 20, 10];

    if(states.verticalspeed < -500){
        for(let i = 0, length = alts.length - 1; i < length; i++){
            if(!speechSynthesis.speaking && alt <= alts[i] && alt > alts[i + 1] && !callout.flags[i]){
                speak(alts[i]);
                callout.flags[i] = true;
                break;
            }
        }
    }

    callout.stage = stage;
});

const autofunctions = [autotrim, autolights, autogear, autoflaps, levelchange, markposition, setrunway, flyto, flypattern, rejecttakeoff, takeoffconfig, autotakeoff, autoland, goaround, autospeed, autobrakeSwitchReset, vnav, callout, updatefpl, autospoilers];