class autofunction {
    #button;
    #timeout;
    #states = {};
    #inputs = {};
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

    constructor(button, delay, inputs, states, code = () => {}){
        this.#button = button;
        this.delay = delay;
        this.#numStates = states.length;
        this.#code = code;
        this.stage = 0;

        inputs.forEach(input => {
            this.#inputs[input] = undefined;
        });

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
        this.#updateButton();

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

    #updateButton(){
        this.#button.className = this.active ? "active" : "off";
    }

    run(){
        const valid = this.#getInputs();

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

    #getInputs(){
        let valid = true;
        for(let name in this.#inputs){
            const input = document.getElementById(name);
            const value = parseFloat(input.value);

            if(isNaN(value)){
                input.classList.add("error");
                setTimeout(() => {input.classList.remove("error");}, 2000);
                valid = false;
            }
            else{
                this.#inputs[name] = parseFloat(input.value);
            }
        }

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