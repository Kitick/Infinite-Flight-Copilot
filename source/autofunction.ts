class autofunction {
    #button:HTMLButtonElement;
    #timeout:NodeJS.Timeout = setTimeout(() => {}, 0);
    #states:dataMap = new Map();
    #inputs:string[] = [];
    #dependents:autofunction[] = [];
    #numStates = 0;
    #validStates = 0;
    #active = false;
    #armed = false;
    #code:funcCode;

    stage = 0;

    static cache = new StateCache();

    constructor(button:string, public delay:number, inputs:string[], states:string[], dependents:autofunction[], code:funcCode){
        const element = document.getElementById(button);
        if(element === null || element.tagName !== "BUTTON"){throw "Trigger is not a button";}

        this.#button = element as HTMLButtonElement;
        this.#button.addEventListener("click", () => {dependencyCheck(button); this.setActive();});
        this.#updateButton();

        this.#numStates = states.length;
        this.#inputs = inputs;
        this.#dependents = dependents;
        this.#code = code;

        this.#inputs.forEach(input => {
            const elementInput = document.getElementById(input);
            if(elementInput !== null && elementInput.tagName === "INPUT" && (elementInput as HTMLInputElement).type === "number"){
                const input = elementInput as HTMLInputElement;
                const tooltip = document.getElementById("tooltip") as HTMLHeadingElement;

                input.addEventListener("mouseenter", () => {tooltip.innerText = input.placeholder;});
                input.addEventListener("mouseout", () => {tooltip.innerText = "Tooltip";});
            }
        });

        states.forEach(state => {
            this.#states.set(state, null);
        });

        autofunction.cache.addArray(inputs);
    }

    get active(){return this.#active;}
    set active(value){this.setActive(value)};

    get inputs(){return this.#inputs;}
    get dependents(){return this.#dependents;}

    setActive(value = !this.#active):void {
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

    #updateButton():void {
        this.#button.className = this.active ? "active" : "off";
    }

    #run():void {
        const valid = this.validateInputs(true);

        if(!valid){this.error(); return;}

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

    #readStates(callback = () => {}):void {
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

    #stateReturn(state:string, value:stateValue, callback = () => {}):void {
        this.#states.set(state, value);
        this.#validStates++;

        if(this.#validStates === this.#numStates){
            callback();
        }
    }

    validateInputs(doError = false):boolean {
        let valid = autofunction.cache.isValidArray(this.inputs, doError);

        this.#dependents.forEach(dependent => {
            valid = autofunction.cache.isValidArray(dependent.inputs, doError) && valid;
        });

        return valid;
    }

    arm():void {
        this.#armed = true;
        this.#button.className = "armed";
    }

    error():void {
        this.active = false;
        this.#button.className = "error";
        this.#timeout = setTimeout(() => {this.#updateButton();}, 2000);
    }
}