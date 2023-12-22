class ProfileStorage {
    #selectDOM:HTMLSelectElement;

    constructor(dom:HTMLSelectElement){
        this.#selectDOM = dom;
        this.#build();
    }

    #build():void {
        let configs = [""];
        for(let i = 0, length = localStorage.length; i < length; i++){
            configs.push(localStorage.key(i) as string);
        }

        configs.sort();

        this.#selectDOM.innerHTML = "";
        configs.forEach(name => {
            let option = new Option(name, name);
            this.#selectDOM.appendChild(option);
        });
    }

    #flash(id:string, colorName:string):void {
        const dom = document.getElementById(id);
        if(dom === null){return;}

        dom.className = colorName;
        setTimeout(() => {dom.className = "off";}, 500);
    }

    add():void {
        let name = prompt("Enter the name of the profile:");
        while(name === ""){name = prompt("Name cannot be blank:");}
        if(name === null){return;}

        localStorage.setItem(name, "");
        this.#build();

        this.#selectDOM.value = name;
        this.save();
    }

    save():void {
        const name = this.#selectDOM.value;
        if(name === ""){this.add(); return;}

        const data = Autofunction.cache.loadAll();

        let profile:any = {};
        data.forEach((value, key) => {
            profile[key] = value;
        });

        localStorage.setItem(name, JSON.stringify(profile));

        this.#flash("save", "active");
    }

    load():void {
        const name = this.#selectDOM.value;
        const profileString = localStorage.getItem(name);

        if(name === "" || profileString === null){this.#flash("load", "error"); return;}

        const profile = JSON.parse(profileString);
        for(let id in profile){
            let value = profile[id];

            if(value !== null){
                let testValue = parseFloat(value.toString());
                if(!isNaN(testValue)){value = testValue;}
            }

            Autofunction.cache.save(id, value);
        }

        this.#flash("load", "active");
    }

    remove():void {
        const name = this.#selectDOM.value;
        if(name === ""){return;}

        const conf = confirm("Are you sure you want to delete: " + name);
        if(!conf){return;}

        localStorage.removeItem(name);
        this.#build();
    }
}