function flyPattern(){
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

function dms(deg, min = 0, sec = 0){
    return deg + (min / 60) + (sec / 3600);
}

function calcLLfromHD(lat, long, hdg, dist){
    dist /= 60;

    hdg = -hdg + 90 - this.data.MagneticDeviation;
    hdg *= Math.PI / 180;

    let lat2 = dist * Math.sin(hdg) + lat;
    let long2 = dist * Math.cos(hdg) * Math.cos((Math.PI / 180) * (lat + lat2) * 0.5) ** -1 + long;

    return [lat2, long2];
}

function calcCourse(lat, long, hdg = 0){
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