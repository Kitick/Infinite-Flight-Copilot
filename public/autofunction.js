class autofunction {
    #button;
    #timeout;
    #states = {};
    #inputs = {};
    #dependents = [];
    #numStates = 0;
    #validStates = 0;
    #inputsValid = false;
    #active = false;
    #armed = false;
    #code = () => {};

    stage = 0;

    static loadButtonHTML(){
        autofunctions.forEach(autofunc => {
            autofunc.#button = document.getElementById(autofunc.#button);
        });
    }

    constructor(button, delay, inputs, states, dependents, code = () => {}){
        this.#button = button;
        this.delay = delay;
        this.#numStates = states.length;
        this.#dependents = dependents;
        this.#code = code;

        inputs.forEach(input => {
            this.#inputs[input] = undefined;
        });

        states.forEach(state => {
            this.#states[state] = undefined;
        });
    }

    get active(){return this.#active;}

    set active(value){this.setActive(value)};

    setActive(value = !this.#active){
        if(this.active === value){return;}

        this.#active = value;
        this.#updateButton();

        if(!value){
            clearTimeout(this.#timeout);
            return;
        }

        this.stage = 0;
        this.#run();
    }

    #updateButton(){
        this.#button.className = this.active ? "active" : "off";
    }

    #run(){
        let valid = this.getInputs();
        this.#inputsValid = false;

        if(!valid){
            this.error();
            return;
        }

        this.#readStates(() => {
            const wasArmed = this.#armed;
            this.#armed = false;

            this.#code({states:this.#states, inputs:this.#inputs});

            if(!this.#armed && wasArmed){
                this.#updateButton();
            }

            if(this.delay === -1){
                this.active = false;
            }

            if(this.active && valid){
                this.#timeout = setTimeout(() => {this.#run();}, this.delay);
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

    getInputs(checkanyway = false){
        if(this.#inputsValid && !checkanyway){return true;}

        let valid = true;
        for(let name in this.#inputs){
            const input = document.getElementById(name);
            const numberValue = parseFloat(input.value);

            if(input.type === "number" && isNaN(numberValue)){
                input.classList.add("error");
                setTimeout(() => {input.classList.remove("error");}, 2000);

                valid = false;
                continue;
            }

            let value = numberValue;
            switch(input.type){
                case "checkbox": value = input.checked; break;
                case "select-one": value = input.value; break;
            }

            this.#inputs[name] = value;
        }

        this.#dependents.forEach(dependent => {
            valid = dependent.getInputs() && valid;
        });

        this.#inputsValid = valid;
        return valid;
    }

    arm(){
        this.#armed = true;
        this.#button.className = "armed";
    }

    error(){
        this.active = false;
        this.#button.className = "error";
        this.#timeout = setTimeout(() => {this.#updateButton();}, 2000);
    }
}