const Net = require("net");
const UDP = require("dgram");

class State{
    static manifest = {};

    static typeRead = [
        value => {return Boolean(value[0]);},
        value => {return value.readInt32LE();},
        value => {return value.readFloatLE();},
        value => {return value.readDoubleLE();},
        value => {return value.toString("utf8", 4);},
        value => {return value.readBigInt64LE();},
    ];

    static typeWrite = [
        value => {return Buffer.from([value]);},
        value => {let buffer = Buffer.allocUnsafe(4); buffer.writeInt32LE(value); return buffer;},
        value => {let buffer = Buffer.allocUnsafe(4); buffer.writeFloatLE(value); return buffer;},
        value => {let buffer = Buffer.allocUnsafe(8); buffer.writeDoubleLE(value); return buffer;},
        value => {let buffer = Buffer.allocUnsafe(4 + value.length); buffer.writeInt32LE(value.length); buffer.write(value, 4); return buffer;},
        value => {let buffer = Buffer.allocUnsafe(8); buffer.writeBigInt64LE(value); return buffer;},
    ];

    static processData(id, data){
        if(id === -1){
            data = data.toString().split("\n");

            data.forEach(item => {
                item = item.split(",");

                new State(item[0], item[1], item[2]);
            });
    
            console.log("Manifest Built");

            setInterval(update, 500);
        }

        let state = this.manifest[id];
        state.value = state.readType(data);

        state.callback();
        state.callback = () => {};
    
        if(id !== -1){
            //console.log(id, "Returned", state.value, state.name, data);
        }
    }

    static getState(id, callback = () => {}){
        let state = this.manifest[id];

        state.callback = callback;
        state.getState();
        
        return state.value;
    }
    static getValue(id){
        let state = this.manifest[id];

        if(state.value === undefined){
            this.getState(id);
        }

        return state.value;
    }
    static setState(id, value){
        let state = this.manifest[id];
        state.setState(value);
    }

    constructor(id, type, name){
        this.id = id;
        this.type = type;
        this.name = name;
        this.value;
        this.callback = () => {};

        this.readType = State.typeRead[type];
        this.writeType = State.typeWrite[type];

        State.manifest[id] = this;
        State.manifest[name] = this;
    }

    getState(){
        let buffer = Buffer.allocUnsafe(5);

        buffer.writeInt32LE(this.id);
        buffer[4] = 0;

        client.write(buffer, () => {
            //console.log("Tx " + this.id + "\t\t", buffer);
        });
    }

    setState(value){
        this.value = value;

        let buffer = Buffer.allocUnsafe(5);

        buffer.writeInt32LE(this.id);
        buffer[4] = 1;

        let valueBuffer = this.writeType(value);

        buffer = Buffer.concat([buffer, valueBuffer]);

        client.write(buffer, () => {
            //console.log("Tx " + this.id + " " + value + "\t", this.name + "\t", buffer);
        });
    }
}

function connect(ip){
    if(ip === undefined){
        console.log("no ip specified, searching for UDP packets...");

        const client = UDP.createSocket("udp4");

        client.on("message", buffer => {
            console.log("UDP packet found, connecting to device...");

            let message = JSON.parse(buffer.toString("utf-8"));
            let address = message.Addresses[1];

            client.close();

            connect(address);
        });

        client.bind(15000);

        return;
    }

    console.log("Attempting connection to " + ip);

    // 359 throttle int -1000 1000
    // 657 parkingbreak boolean
    // 660 spoilers int 0 2
    // 661 flaps int 0 (flap count - 1)

    client.connect({host:ip, port:10112}, () => {
        console.log("TCP connection established");
        console.log("Retrieving Manifest...");

        State.getState("manifest");
    });

    client.on("data", buffer => {
        //console.log("Rx\t\t", buffer);

        for(let number of buffer){
            dataBuffer.push(number);
        }

        validate();
    });
}

let dataBuffer = [];

function validate(){
    if(dataBuffer.length < 9){
        //console.log("IO", dataBuffer.length);
        return;
    }

    let length = Buffer.from(dataBuffer.slice(4, 8)).readInt32LE() + 8;

    if(dataBuffer.length < length){
        //console.log("ID", dataBuffer.length, length);
        return;
    }

    let id = Buffer.from(dataBuffer.slice(0, 4)).readInt32LE();
    let data = Buffer.from(dataBuffer.slice(8, length));

    dataBuffer.splice(0, length);

    State.processData(id, data);

    if(dataBuffer.length > 0){
        validate();
    }
}

function autoTrim(){
    if(delay < 2){
        delay++;
        return;
    }
    delay = 0;

    let onGround = State.getState("aircraft/0/is_on_ground");
    let pitch = State.getState("aircraft/0/systems/axes/pitch");
    let trim = State.getValue("aircraft/0/systems/axes/elevator_trim");

    if(onGround === undefined || pitch === undefined || trim === undefined){
        return;
    }

    if(onGround || Math.abs(pitch) < 10){
        return;
    }

    let mod = pitch >= 0 ? 1:-1;
    mod *= 10;

    State.setState("aircraft/0/systems/axes/elevator_trim", trim + mod);
}

function takeoff(){
    if(stage === 0){
        State.getState("aircraft/0/altitude_msl");

        State.setState("aircraft/0/systems/parking_brake/state", true);
        State.setState("aircraft/0/systems/flaps/state", 2);
        State.setState("aircraft/0/systems/spoilers/state", 0);
        State.setState("aircraft/0/systems/auto_brakes/command_state", 3);

        State.setState("aircraft/0/systems/electrical_switch/nav_lights_switch/state", true);
        State.setState("aircraft/0/systems/electrical_switch/strobe_lights_switch/state", true);
        State.setState("aircraft/0/systems/electrical_switch/landing_lights_switch/state", false);
        State.setState("aircraft/0/systems/electrical_switch/beacon_lights_switch/state", true);

        State.setState("aircraft/0/systems/autopilot/on", true);
        State.setState("aircraft/0/systems/autopilot/alt/on", true);
        State.setState("aircraft/0/systems/autopilot/vs/on", true);
        State.setState("aircraft/0/systems/autopilot/spd/on", true);
        State.setState("aircraft/0/systems/autopilot/hdg/on", true);

        stage++;
    }
    else if(stage === 1){
        State.setState("aircraft/0/systems/spoilers/state", 2);
        State.setState("aircraft/0/systems/parking_brake/state", false);

        let altitude = Math.round(State.getValue("aircraft/0/altitude_msl") / 100) * 100;

        State.setState("aircraft/0/systems/autopilot/alt/target", 3000 * ftm + altitude);
        State.setState("aircraft/0/systems/autopilot/spd/target", 200 * ktsms);

        stage++;
    }
    else if(stage >= 2 && stage <= 5){
        let airspeed = State.getState("aircraft/0/indicated_airspeed") * mskts;
        let altitude = State.getState("aircraft/0/altitude_agl") * mft;

        if(stage === 2 && airspeed >= 100){
            State.setState("aircraft/0/systems/autopilot/vs/target", 1000 * ftm);
            stage++;
        }
        else if(stage === 3 && altitude >= 100){
            State.getState("commands/LandingGear");
            State.setState("aircraft/0/systems/spoilers/state", 0);
            State.setState("aircraft/0/systems/auto_brakes/command_state", 0);
            stage++;
        }
        else if(stage === 4 && altitude >= 300){
            State.setState("aircraft/0/systems/flaps/state", 1);
            State.setState("aircraft/0/systems/autopilot/spd/target", 220 * ktsms);
            State.setState("aircraft/0/systems/autopilot/vs/target", 2000 * ftm);
            stage++;
        }
        else if(stage === 5 && altitude >= 500 && airspeed >= 200){
            State.setState("aircraft/0/systems/flaps/state", 0);
            State.setState("aircraft/0/systems/autopilot/spd/target", 250 * ktsms);
            State.setState("aircraft/0/systems/autopilot/vs/target", 3000 * ftm);
            stage++;
        }
    }

    if(stage === 6){
        part++;
        stage = 0;
    }
}

function calcLLfromHD(lat, long, hdg, dist, magvar = 0){
    dist /= 60;

    hdg = -(hdg + magvar) + 90;
    hdg *= degrad;

    let lat2 = dist * Math.sin(hdg) + lat;
    let long2 = dist * Math.cos(hdg) * Math.cos(degrad * (lat + lat2) * 0.5) ** -1 + long;

    return [lat2, long2];
}

function calcCourse(lat, long, lat2, long2, magvar = 0, hdg = 0){
    let dlat = 60 * (lat2 - lat);
    let dlong = 60 * (long2 - long) * Math.cos(degrad * (lat + lat2) * 0.5);

    let dist = (dlat ** 2 + dlong ** 2) ** 0.5;
    let course = Math.atan2(dlong, dlat) * raddeg;

    course -= magvar;

    hdg = cyclical(hdg);
    course = cyclical(course);

    if(hdg !== 0){
        let diffrence = course - hdg;
        let limit = 135;
        
        let correction = 2 * diffrence;
        if(dist < 2){
            correction = 3 * diffrence;
        }

        if(course + correction < hdg - limit){
            course = hdg - limit;
        }
        else if(course + correction > hdg + limit){
            course = hdg + limit;
        }
        else{
            course += correction;
        }
    }

    course = cyclical(course);

    return [course, dist];
}

function calcVS(dist, speed, alt, vpa = 3, tolerace = 0.5){
    let ht = (60 * dist) / speed;
    let vs = alt / ht;

    let cvpa = Math.atan2(alt, dist * nmft) * raddeg;

    console.log(dist, cvpa, vpa)

    let correction = 200;
    if(dist < 1.5){
        correction = 50;
    }
    else if(dist < 0.5){
        correction = 0;
    }

    if(cvpa > -vpa - tolerace){
        vs += correction;
    }
    else if(cvpa < -vpa + tolerace){
        vs -= correction;
    }

    return vs;
}

function dms(deg, min = 0, sec = 0){
    return deg + (min / 60) + (sec / 3600);
}

function cyclical(value, range = 360){
    value = ((value % range) + range) % range;

    return value;
}

function GPLS(){
    let lat = State.getState("aircraft/0/latitude");
    let long = State.getState("aircraft/0/longitude");
    let magvar = State.getState("aircraft/0/magnetic_variation") * raddeg;
    let airspeed = State.getState("aircraft/0/indicated_airspeed") * mskts;
    let groundspeed = State.getState("aircraft/0/groundspeed") * mskts;
    let alt = State.getState("aircraft/0/altitude_msl");

    if(lat === undefined || long === undefined || airspeed === undefined || groundspeed === undefined || alt === undefined || magvar === undefined){
        return;
    }

    if(gplsData.finalLat === undefined){
        let final = calcLLfromHD(gplsData.lat, gplsData.long, gplsData.bearing + 180, gplsData.final - gplsData.threshold * ftnm, magvar);
        gplsData.finalLat = final[0];
        gplsData.finalLong = final[1];
    }

    if(gplsData.runwayLat === undefined){
        let runway = calcLLfromHD(gplsData.lat, gplsData.long, gplsData.bearing, gplsData.threshold * ftnm, magvar);
        gplsData.runwayLat = runway[0];
        gplsData.runwayLong = runway[1];
    }

    if(stage === 0){
        let plan = calcCourse(lat, long, gplsData.finalLat, gplsData.finalLong, magvar, gplsData.bearing);
        let course = plan[0];
        let distance = plan[1];

        let newAlt = gplsData.final * Math.sin(gplsData.vpa * degrad) * nmft;
        newAlt += gplsData.altitude;

        newAlt = Math.round(newAlt / 100) * 100;

        let vs = calcVS(distance, groundspeed, newAlt - alt, gplsData.vpa);

        State.setState("aircraft/0/systems/autopilot/hdg/target", course * degrad);
        State.setState("aircraft/0/systems/autopilot/alt/target", newAlt * ftm);
        State.setState("aircraft/0/systems/autopilot/vs/target", vs * ftm);

        if(distance < 1){
            stage++;
        }
    }
    else if(stage === 1){
        let plan = calcCourse(lat, long, gplsData.runwayLat, gplsData.runwayLong, magvar, gplsData.bearing);
        let course = plan[0];
        let distance = plan[1];

        let newAlt = gplsData.altitude + gplsData.planeOffset + gplsData.flair;

        let vs = calcVS(distance, groundspeed, newAlt - alt, gplsData.vpa);

        State.setState("aircraft/0/systems/spoilers/state", 2);
        State.setState("aircraft/0/systems/auto_brakes/command_state", 2);

        State.setState("aircraft/0/systems/autopilot/hdg/target", course * degrad);
        State.setState("aircraft/0/systems/autopilot/alt/target", newAlt * ftm);
        State.setState("aircraft/0/systems/autopilot/vs/target", vs * ftm);

        if(distance < 0.1){
            stage++;
        }
    }
    else if(stage === 2){
        State.setState("aircraft/0/systems/autopilot/spd/target", 0 * ktsms);
    }
}

function update(){
    if(part === 0){
        takeoff();
    }
    else if(part === 1){
        GPLS();
    }

    autoTrim();
}

//dms(37, 36.812017), -dms(122, 21.428467), , KSFO 28R
//dms(37, 37.640532), -dms(122, 22.026650), , KSFO 19L
//dms(37, 30.505213), -dms(122, 29.716655), , KHAF 30
//dms(39, 30.830430), -dms(119, 46.004433), 1000, KRNO 16L
//dms(39, 39.675567), -dms(119, 52.042517), 1200, KRTS 32

let gplsData = {
    lat:dms(39, 39.675567),
    long:-dms(119, 52.042517),
    altitude:5049,
    bearing:320,
    threshold:1200,
    vpa:3,
    planeOffset:4,
    flair:20,
    final:5,
};

let part = 1;
let stage = 0;
let delay = 0;

const mskts = 1.94384;
const ktsms = 0.5144444;
const mft = 3.28084;
const ftm = 0.3048;
const nmft = 6076.12;
const ftnm = 0.000164579;
const raddeg = 180 / Math.PI;
const degrad = Math.PI / 180;

new State(-1, 4, "manifest");

const client = new Net.Socket();

connect("192.168.1.22");
//connect();