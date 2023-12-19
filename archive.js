const oldautospeed = new autofunction("autospeed", 1000, ["latref", "longref", "climbspd", "spdref", "cruisespd", "cruisealt"], ["onground", "airspeed", "verticalspeed", "altitudeAGL", "altitude", "throttle", "latitude", "longitude", "spd"], [], data => {
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