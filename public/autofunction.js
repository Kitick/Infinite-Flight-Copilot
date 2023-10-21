class autofunction {
    #button;
    #timeout;
    #states = {};
    #inputs = [];
    #dependents = [];
    #numStates = 0;
    #validStates = 0;
    #active = false;
    #armed = false;
    #code = () => {};

    stage = 0;

    static cache = new Cache();
    static localstorage = new localstorage();

    constructor(button, delay, inputs, states, dependents, code = () => {}){
        this.#button = document.getElementById(button);
        this.#updateButton();
        this.delay = delay;
        this.#numStates = states.length;
        this.#inputs = inputs;
        this.#dependents = dependents;
        this.#code = code;

        states.forEach(state => {
            this.#states[state] = null;
        });

        autofunction.cache.addArray(inputs);
    }

    get active(){return this.#active;}
    set active(value){this.setActive(value)};

    get inputs(){return this.#inputs;}
    get dependents(){return this.#dependents;}

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
        const valid = this.validateInputs(true);

        if(!valid){
            this.error();
            return;
        }

        this.#readStates(() => {
            const wasArmed = this.#armed;
            this.#armed = false;

            this.#code({states:this.#states, inputs:autofunction.cache.loadArray(this.inputs)});

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

    validateInputs(doError = false){
        let valid = autofunction.cache.isValidArray(this.inputs, doError);

        this.#dependents.forEach(dependent => {
            valid = autofunction.cache.isValidArray(dependent.inputs, doError) && valid;
        });

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