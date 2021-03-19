
// this function runs
import Cooperator from "./cooperator";
//import Worker from "./worker";

export default class GliaSudtSwapMatcher{
    constructor() {

    }

    run = async () =>{
        new Cooperator().run()
    }
}
new GliaSudtSwapMatcher().run()
