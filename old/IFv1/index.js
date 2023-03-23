'use-strict';

const IFC = require('ifc/ifc.js');
IFC.initIFClient('192.168.1.18', 10111);

class Preset{
    static presets = {};

    constructor(name, maxFlaps, takeoffFlaps, flapsRange = [], dryWeight, nonFuelWeight, aoa = 5){
        this.name = name;
        this.maxFlaps = maxFlaps;
        this.flapsRange = flapsRange;
        this.takeoffFlaps = takeoffFlaps;
        this.dryWeight = dryWeight;
        this.nonFuelWeight = nonFuelWeight;
        this.aoa = aoa;

        Preset.presets[this.name] = this;
    }
}

new Preset('TBM930', 2, 1, [80, 140], 2097, 62+340);
new Preset('CRJ200', 4, 2, [130, 180], 15147, 1074+1319);

class Aircraft{
    static _task = 'takeoff';
    static stage = 0;
    static get task(){return this._task;}
    static set task(value){this.stage = 0; this._task = value;}

    static get latitude(){return this.data.Location.Latitude;}
    static get longitude(){return this.data.Location.Longitude;}

    static _data = {};
    static get data(){return this._data;}
    static set data(value){this._data = value; this.update();}

    static currentAircraft = Preset.presets.CRJ200; // Aircraft

    static get weight(){return this.data.Weight;}
    static get fuel(){return this.weight - this.currentAircraft.dryWeight - this.currentAircraft.nonFuelWeight;}

    static get heading(){return this.data.HeadingMagnetic;}
    static get headingTrue(){return this.data.HeadingTrue;}
    static set heading(value){value = this.cyclical(value, 360); this.send('Autopilot.SetHeading', value); console.log('Set Heading ' + value);}

    static get altitude(){return this.data.AltitudeMSL;}
    static get altitudeAGL(){return this.data.AltitudeAGL;}
    static set altitude(value){this.send('Autopilot.SetAltitude', value); console.log('Set Altitude ' + value);}

    static get speed(){return this.data.IndicatedAirspeedKts;}
    static get groundSpeed(){return this.data.GroundSpeedKts;}
    static set speed(value){this.send('Autopilot.SetSpeed', value); console.log('Set Speed ' + value);}

    static get vs(){return this.data.VerticalSpeed;}
    static set vs(value){this.send('Autopilot.SetVS', value); console.log('Set VS ' + value);}

    static get autopilot(){return this.data.IsAutopilotOn;}
    static set autopilot(value){if(this.autopilot !== value){this.send('Autopilot.Toggle');} if(value){this.send('Autopilot.SetHeadingState', true); this.send('Autopilot.SetAltitudeState', true); this.send('Autopilot.SetVSState', true); this.send('Autopilot.SetSpeedState', true);} console.log('Set Autopilot ' + value);}

    static get gear(){return Boolean(2 - this.data.GearState);}
    static set gear(value){if(this.gear !== value){this.send('LandingGear');} console.log('Set Gear ' + value);}

    static get flaps(){return this.data.FlapsIndex;}
    static set flaps(value){this.send('Aircraft.SetFlapState', value); console.log('Set Flaps ' + value);}

    static get spoilers(){return this.data.SpoilerCommandState;}
    static set spoilers(value){value = this.cyclical(value, 3); const diffrence = value - this.spoilers; if(diffrence === 1 || diffrence === -2){this.send('Spoilers');}else if(diffrence === 2 || diffrence === -1){this.send('Spoilers'); this.send('Spoilers');} console.log('Set Spoilers ' + value);}

    static get brake(){return this.data.IsBraking;}
    static set brake(value){if(this.brake !== value){this.send('ParkingBrakes');} console.log('Set Parking Brakes ' + value);}

    static get pushback(){return this.data.IsPushbackActive;}
    static set pushback(value){if(this.pushback !== value){this.send('Pushback'); console.log('Set Pushback ' + value);}}

    static disable(hold){this.send('Autopilot.Set' + hold + 'State', false);}

    static flapsFull(){this.send('FlapsFullDown'); console.log('Set Flaps Full');}
    static roll(direction){this.send('Roll' + direction); console.log('Rolling ' + direction);}

    static send(command, value, omitCmd = false){
        const commandObj = {"Command":(omitCmd ? '':'Commands.') + command, 'Parameters':(value === undefined ? []:[{'Value':value}])};

        IFC.sendCommand(commandObj);
    }

    static cyclical(value, range = 360){
        value = ((value % range) + range) % range;

        return value;
    }

    static initalized = false;
    static init(){
        this.setupPattern(this.dms(37, 36.812017), -this.dms(122, 21.428467), 284, "R");
    }

    static update(){
        console.clear();
console.log(this.data);
        if(!this.initalized){
            this.init();
            this.initalized = true;
        }

        /*
        if(this.task === 'init'){
            this.flapsFull();
            this.task = 'set';
        }
        else if(this.task === 'set'){
            this.maxFlaps = this.flaps;
            this.flaps = 0;

            console.log('Max Flaps Set ' + this.maxFlaps);

            this.task = 'takeoff';
        }
        */
       /*
        if(this.task === 'takeoff'){
            this.takeoff(0);
        }
        else{
            this.flapsController();
            this.aoaController(5);
        }
        */
        this.flapsController();
        this.aoaController();
        this.fuelEfficiency(true);
        this.calcEfficiencyRange(200, 1200, 100);
        //this.dms(39, 30.830430), -this.dms(119, 46.004433) // RNO 16L
        //this.dms(37, 36.812017), -this.dms(122, 21.428467) // SFO 28R
        //this.dms(33, 57.126235), -this.dms(118, 24.116935) // LAX 24R
        //this.dms(33, 56.392673), -this.dms(118, 22.786675) // LAX 25R
        //this.dms(33, 56.018963), -this.dms(118, 25.141100) // LAX 07R
        // KRNO 39.4991 -119.7681
        // KSFO 37.6188 -122.3754

        //this.flyPattern();

        //this.heading = this.calcCourse(this.dms(37, 36.812017), -this.dms(122, 21.428467), 284)[0];

        //this.approach(this.dms(37, 36.812017), -this.dms(122, 21.428467), 284, 13 + 4, 10, 3, 10);

        //console.log((this.heading - this.lastHeading).toFixed(2), this.groundSpeed.toFixed(0));
        //this.lastHeading = this.heading;
    }

    static approach(runwayLat, runwayLong, runwayHDG, runwayAlt, finalLength = 10, approachAngle = 3, flairDistance = 10){

        let final = this.calcLLfromHD(runwayLat, runwayLong, runwayHDG, -finalLength);
        let course = this.calcCourse(final[0], final[1], runwayHDG);

        this.heading = course[0];
        this.altitude = finalLength * 6076.12 * Math.sin(approachAngle * (Math.PI / 180)) + runwayAlt;
    }

    static pattern = {};

    static setupPattern(runwayLat, runwayLong, runwayHDG, direction, leg = 0, upwindDist = 4, width = 4, finalDist = 5, turnprediction = 1.5){
        let runway = [runwayLat, runwayLong];
        let pattern = this.pattern;

        pattern.runwayHDG = runwayHDG;
        pattern.turnprediction = turnprediction;
        pattern.legs = ["upwind", "crosswind", "downwind", "base", "final"];
        pattern.leg = leg;
        pattern.direction = direction.toUpperCase() === "L" ? -90 : 90;

        pattern.upwind = this.calcLLfromHD(runway[0], runway[1], runwayHDG, upwindDist);
        pattern.crosswind = this.calcLLfromHD(pattern.upwind[0], pattern.upwind[1], runwayHDG + pattern.direction, width);
        pattern.downwind = this.calcLLfromHD(pattern.crosswind[0], pattern.crosswind[1], runwayHDG + 180, finalDist + upwindDist);
        pattern.base = this.calcLLfromHD(runway[0], runway[1], runwayHDG + 180, finalDist);
        pattern.final = runway;

        pattern.upwind.push(runwayHDG);
        pattern.crosswind.push(runwayHDG + pattern.direction);
        pattern.downwind.push(runwayHDG + 180);
        pattern.base.push(runwayHDG - pattern.direction);
        pattern.final.push(runwayHDG);
    }

    static flyPattern(){
        let pattern = this.pattern;

        let leg = pattern.legs[pattern.leg];
        let legPos = pattern[leg];
        
        let course = this.calcCourse(legPos[0], legPos[1], legPos[2]);

        if(course[1] < pattern.turnprediction){
            this.pattern.leg++;
            if(this.pattern.leg >= this.pattern.legs.length){this.pattern.leg = 0;}
            
            this.flyPattern();
            return;
        }

        this.heading = course[0];
        console.log("Flying " + leg + " with " + course[1].toFixed(1) + "nm left");
    }

    static dms(deg, min = 0, sec = 0){
        return deg + (min / 60) + (sec / 3600);
    }

    static calcLLfromHD(lat, long, hdg, dist){
        dist /= 60;

        hdg = -hdg + 90 - this.data.MagneticDeviation;
        hdg *= Math.PI / 180;

        let lat2 = dist * Math.sin(hdg) + lat;
        let long2 = dist * Math.cos(hdg) * Math.cos((Math.PI / 180) * (lat + lat2) * 0.5) ** -1 + long;

        return [lat2, long2];
    }

    static calcCourse(lat, long, hdg = 0){
        let dlat = 60 * (lat - this.latitude);
        let dlong = 60 * (long - this.longitude) * Math.cos((Math.PI / 180) * (lat + this.latitude) * 0.5);

        let dist = (dlat ** 2 + dlong ** 2) ** 0.5;
        let course = Math.atan2(dlong, dlat) * (180 / Math.PI);

        course -= this.data.MagneticDeviation;

        hdg = this.cyclical(hdg);
        course = this.cyclical(course);

        console.log(dist.toFixed(2) + "nm on " + course.toFixed(2));

        if(hdg !== 0){
            let diffrence = course - hdg;
            let correction = 2 * diffrence;

            if(course + correction < hdg - 90){
                course = hdg - 90;
            }
            else if(course + correction > hdg + 90){
                course = hdg + 90;
            }
            else{
                course += correction;
            }

            console.log("Target " + hdg + " with " + diffrence.toFixed(2) + " deviation");
        }

        course = this.cyclical(course);

        return [course, dist];
    }

    static takeoff(type = 1){
        const stage = this.stage;

        if(stage === 0){
            console.log('\nStarting Takeoff Roll');
            this.stage++;

            this.spoilers = 0;
            this.flaps = 2;

            this.heading = this.heading;
            this.altitude = Math.round((this.altitude + 1500 + 1500*type) / 100) * 100;
            this.vs = 0;
            this.speed = 180;

            this.autopilot = true;

            this.brake = false;
        }

        if(stage === 1 && this.speed >= 140){
            console.log('\nTakeoff Speed Met');
            this.stage++;

            this.vs = 1000;
        }

        if(stage === 2 && this.altitudeAGL >= 100){
            console.log('\nInital Climb Met');
            this.stage++;

            this.gear = false;
            this.speed = 200;
            this.vs = 2000;
            this.flaps = 1;
        }

        if(stage === 3 && this.speed >= 190){
            console.log('\nSafe Speed Met');
            this.flaps = 0;
            this.stage++;
        }

        if(stage === 4 && this.altitudeAGL >= 1000){
            this.task = '';
            console.log('\nTakeoff Complete');
        }
    }

    static flapsController(){
        if(this.data.IsOnGround){
            if(this.data.IsOnRunway){
                this.flaps = 1;
            }
            else{
                this.flaps = 0;
            }
            return;
        }

        const down = this.currentAircraft.flapsRange[0];
        const up = this.currentAircraft.flapsRange[1];
        const max = this.currentAircraft.maxFlaps;

        const mod = (up - down) / max;
        let newFlaps = Math.round((up - this.speed) / mod);

        if(isNaN(newFlaps)){
            return;
        }

        if(newFlaps < 0){
            newFlaps = 0;
        }
        else if(newFlaps > max){
            newFlaps = max;
        }

        if(this.flaps !== newFlaps){
            this.flaps = newFlaps;
        }
    }

    static aoaController(){
        let angle = this.currentAircraft.aoa;

        angle *= this.vs < 0 ? -1:1;

        angle *= Math.PI / 180;
        const speed = this.speed * 101.269;

        this.vs = speed * Math.sin(angle);
    }

    static lastFuel = 0;
    static fuelEfficiency(log = false){
        const currentFuel = this.fuel;
        const fuelFlow = (this.lastFuel - currentFuel) * 3600;
        this.lastFuel = currentFuel;

        const relativeEfficiency = this.speed / fuelFlow;
        const trueEfficiency = this.groundSpeed / fuelFlow;
        const climbEfficiency = (this.vs * 1.94384) / fuelFlow;

        const timeRange = currentFuel / fuelFlow;
        const distanceRange = this.groundSpeed * timeRange; // OR trueEfficiency * currentFuel;

        const netEfficiency = trueEfficiency - relativeEfficiency;

        if(log){
            console.log(relativeEfficiency.toFixed(3) + 'nm/kg', trueEfficiency.toFixed(3) + 'nm/kg', climbEfficiency.toFixed(3) + '?', distanceRange.toFixed(3) + 'nm', timeRange.toFixed(3) + 'hrs', this.fuel.toFixed(0) + 'kg');
        }

        if(trueEfficiency === Infinity || isNaN(trueEfficiency)){
            return 0;
        }

        return trueEfficiency;
    }

    static recursionData = undefined;
    static calcEfficiencyRange(low, high, step = 20, changeTime = 30, samples = 10){
        if(this.recursionData === undefined){
            console.log('Init');
            this.recursionData = {
                timer:0,
                sampleAverage:0,
                averages:[],
                run:0,
            };
        }

        const efficiency = this.fuelEfficiency();

        if(efficiency === 0){
            console.log('Skipping');
            return;
        }

        const newSpeed = this.recursionData.run * step + low;

        if(newSpeed > high){
            const averages = this.recursionData.averages;
            this.recursionData = undefined;

            let max = 0;
            let speed = 0;
            let index = 0;
            averages.forEach(average => {
                if(average > max){
                    max = average;
                    speed = index;
                }

                index++;
            });

            speed = speed * step + low;

            console.log('Finished: ', averages, 'Best: ', speed);
            return averages;
        }

        this.speed = newSpeed;

        this.recursionData.timer++;

        if(this.recursionData.timer >= changeTime){
            if(this.recursionData.timer === samples + changeTime){
                this.recursionData.timer = 0;
                this.recursionData.run++;

                const average = this.recursionData.sampleAverage / samples;

                this.recursionData.averages.push(average);
                this.recursionData.sampleAverage = 0;

                console.log('Sample Average ', average);
            }
            else{
                this.recursionData.sampleAverage += efficiency;
                console.log('Sample ', efficiency);
            }
        }
    }

    static log(){console.log(this.data);}
}

IFC.infiniteFlight.clientSocket.on('data', function(data){
    data = IFC._ab2str(data);

    data = data.split('');

    const length = data.length;

    for(let i = 0; i < length; i++){
        const character = data[i];

        if(character === undefined){
            continue;
        }

        if(character.search(/\w|"|:|,|\.|-|\{|\}/) === -1){
            data.splice(i, 1);
            i--;
        }
    }

    data = data.join('');

    try{
        data = JSON.parse(data);
        Aircraft.data = data;
    }
    catch(ERROR){
        console.log('JSON Parse Error');
    }
});

setInterval(() => {
    Aircraft.send('Airplane.GetState', undefined, true);
}, 1000);

/*
{
    Result: 0,
    Type: 'Fds.IFAPI.APIAircraftState',
    AccelerationX: 6.11762061e-7,
    AccelerationY: 0.0000587964132,
    AccelerationZ: -0.0000347372,
    AltitudeAGL: 0,
    AltitudeMSL: 170.626648,
    ApproachAirportICAO: null,
    ApproachDistance: 0,
    ApproachHorizontalAngle: 0,
    ApproachRunway: null,
    ApproachVerticalAngle: 0,
    Bank: -0.00421888754,
    CourseTrue: 12.91995,
    FlapsIndex: 0,
    GForce: 1.00035965,
    GearState: 1,
    GroundSpeed: 0.00007071249,
    GroundSpeedKts: 0.000137454088,
    HeadingMagnetic: 15.6876955,
    HeadingTrue: 5.9118824,
    IndicatedAirspeed: 1.505927,
    IndicatedAirspeedKts: 2.92728782,
    IsAutopilotOn: false,
    IsBraking: true,
    IsCrashed: false,
    IsLanded: true,
    IsOnGround: true,
    IsOnRunway: true,
    IsOverLandingWeight: false,
    IsOverTakeoffWeight: false,
    IsPushbackActive: false,
    Location: {
        Altitude: 2979.78174,
        Latitude: 18.236674804349573,
        Longitude: -72.51897811187227
    },
    MachNumber: 0.004991978,
    MagneticDeviation: -9.775813,
    Pitch: -0.8046643,
    ReverseThrustState: false,
    SideForce: 0.0000037416637,
    SpoilerCommandState: 0,
    SpoilersPosition: 0,
    StallProximity: 10,
    StallWarning: false,
    Stalling: false,
    TrueAirspeed: 1.73345387,
    Velocity: 0.000186505014,
    VerticalSpeed: -0.0001725798,
    Weight: 21311.5938,
    WeightPercentage: 0.69215107
}
*/